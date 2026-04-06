import { createWorker, PSM } from 'tesseract.js'
import { matchService } from './services'

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: TYPES
// OcrResult and DetectedService are unchanged — existing consumers are unaffected.
// OcrDebugInfo is new and only used for debug output.
// ═══════════════════════════════════════════════════════════════════════════════

export type OcrResult = {
  rawText: string
  numbers: number[]
  detectedServices: DetectedService[]
}

export type DetectedService = {
  description: string
  amount: number
  payment: 'cash' | 'transfer'
}

export type OcrDebugInfo = {
  attempts: Array<{
    variant: string   // preprocessing variant name
    config: string    // Tesseract PSM/OEM config name
    rawText: string   // raw OCR output for this attempt
    score: number     // quality score (higher = better Thai text quality)
  }>
  selectedAttempt: number  // index of the winning attempt
  cleanedText: string      // after conservative post-processing
  finalText: string        // after optional LLM cleanup (or same as cleanedText)
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: PIPELINE CONFIG — TUNING PANEL
// All OCR behaviour can be adjusted here without touching logic.
// ═══════════════════════════════════════════════════════════════════════════════

const OCR_CONFIG = {
  // ── Multi-attempt ───────────────────────────────────────────────────────────
  // Set to true to try multiple preprocessing × Tesseract config combinations
  // and pick the best result. Slower but more accurate.
  // Each additional attempt adds ~5-10 seconds. Default: enabled (2-3 attempts).
  MULTI_ATTEMPT: true,

  // Maximum number of attempts to run (stop early if GOOD_ENOUGH_SCORE is hit).
  // Tune this to balance speed vs accuracy. Lower = faster, higher = more thorough.
  MAX_ATTEMPTS: 3,

  // Score threshold for early stopping. If an attempt scores this high,
  // stop trying and use that result. Set to Infinity to always run all attempts.
  GOOD_ENOUGH_SCORE: 45,

  // ── Image preprocessing ─────────────────────────────────────────────────────
  // Minimum image dimension (px) before upscaling. Larger = slower but more accurate.
  // Current: 1600px (same as original). Try 2000+ if accuracy is still poor.
  MIN_DIM: 1600,

  // ── Debug ───────────────────────────────────────────────────────────────────
  // Set to true to write detailed debug info to window.__lep_ocr_debug.
  // Inspect in browser console: window.__lep_ocr_debug
  // Does not affect the UI in any way.
  DEBUG: true,

  // LLM_CLEANUP is not implemented. Left as false permanently.
  LLM_CLEANUP: false,
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: IMAGE PROCESSING UTILITIES
// Pure helper functions used by preprocessing variants below.
// None of these are called from existing code — they are additive only.
// ═══════════════════════════════════════════════════════════════════════════════

/** Convert all pixels to grayscale in-place using luminance weights. */
function toGrayscale(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    data[i] = g; data[i + 1] = g; data[i + 2] = g
  }
}

/**
 * Compute Otsu's optimal global threshold for a grayscale image.
 * Returns a value 0-255. Pixels above threshold = white (paper),
 * pixels at or below = black (ink).
 * Tune: this is fully automatic — no parameters needed.
 */
function computeOtsuThreshold(data: Uint8ClampedArray): number {
  const hist = new Array(256).fill(0)
  const n = data.length / 4
  for (let i = 0; i < data.length; i += 4) hist[data[i]]++

  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * hist[i]

  let sumB = 0, wB = 0, best = 0, threshold = 0
  for (let t = 0; t < 256; t++) {
    wB += hist[t]
    if (!wB) continue
    const wF = n - wB
    if (!wF) break
    sumB += t * hist[t]
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const v = wB * wF * (mB - mF) ** 2
    if (v > best) { best = v; threshold = t }
  }
  return threshold
}

/** Apply binary threshold to a grayscale image in-place. */
function applyThreshold(data: Uint8ClampedArray, threshold: number): void {
  for (let i = 0; i < data.length; i += 4) {
    const v = data[i] > threshold ? 255 : 0
    data[i] = v; data[i + 1] = v; data[i + 2] = v
  }
}

/**
 * Apply a 3×3 sharpen kernel to a grayscale image.
 * Returns a new Uint8ClampedArray — original is not mutated.
 * Tune: adjust kernel values for stronger/weaker sharpening.
 *   Current kernel: [0,-1,0, -1,5,-1, 0,-1,0] (standard sharpen)
 *   Stronger option: [−1,−1,−1, −1,9,−1, −1,−1,−1]
 */
function applySharpen(data: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray<ArrayBuffer> {
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0]
  const out = new Uint8ClampedArray(data.length) as Uint8ClampedArray<ArrayBuffer>
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const ny = Math.min(h - 1, Math.max(0, y + ky))
          const nx = Math.min(w - 1, Math.max(0, x + kx))
          sum += data[(ny * w + nx) * 4] * kernel[(ky + 1) * 3 + (kx + 1)]
        }
      }
      const i = (y * w + x) * 4
      const v = Math.min(255, Math.max(0, sum))
      out[i] = v; out[i + 1] = v; out[i + 2] = v; out[i + 3] = 255
    }
  }
  return out
}

/**
 * Morphological dilation of dark (ink) pixels by 1 pixel in all directions.
 * Makes handwritten strokes slightly thicker so Tesseract reads thin pens better.
 * Returns a new Uint8ClampedArray — original is not mutated.
 * Tune: increase the loop range (-1/+1) to dilate by 2px, etc.
 */
function dilateDark(data: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(data) as Uint8ClampedArray<ArrayBuffer>
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let hasDark = false
      outer: for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (data[((y + dy) * w + (x + dx)) * 4] < 128) { hasDark = true; break outer }
        }
      }
      if (hasDark) {
        const i = (y * w + x) * 4
        out[i] = 0; out[i + 1] = 0; out[i + 2] = 0
      }
    }
  }
  return out
}

/**
 * Shared canvas setup for all preprocessing variants.
 * Handles image loading, upscaling, and PNG export.
 * The process() callback receives ImageData and does the actual pixel work.
 */
function preprocessWithCanvas(
  file: File,
  process: (imageData: ImageData, w: number, h: number) => ImageData
): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      let { width: w, height: h } = img
      if (w < OCR_CONFIG.MIN_DIM && h < OCR_CONFIG.MIN_DIM) {
        const r = OCR_CONFIG.MIN_DIM / Math.max(w, h)
        w = Math.round(w * r); h = Math.round(h * r)
      }
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)
      const imageData = ctx.getImageData(0, 0, w, h)
      const processed = process(imageData, w, h)
      ctx.putImageData(processed, 0, 0)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => resolve(blob!), 'image/png')
    }
    img.src = url
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: PREPROCESSING VARIANTS
// Each variant produces a different processed image for Tesseract.
// Add new variants here to test different approaches — existing code is unaffected.
//
// Variant A = exact original v2 behavior (the "buggy" inversion formula that
//             accidentally improves Tesseract accuracy on Saly's notebook).
//             This is also used by the original preprocessImage() fallback below.
// Variants B, C, D are new additive options.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * VARIANT A — Original v2 behavior (unchanged from production).
 * Grayscale + the v2 contrast formula (intentionally inverts tones).
 * This matches what preprocessImage() does — kept separate so both paths
 * can evolve independently without affecting each other.
 * Tune: adjust `contrast` constant (1.8 = original).
 */
function preprocessVariantA(file: File): Promise<Blob> {
  return preprocessWithCanvas(file, (imageData) => {
    const d = imageData.data
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      const contrast = 1.8 // tune here
      const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255))
      const v = Math.min(255, Math.max(0, factor * (gray - 128) + 128))
      d[i] = v; d[i + 1] = v; d[i + 2] = v
    }
    return imageData
  })
}

/**
 * VARIANT B — Grayscale + Otsu global threshold.
 * Binarises the image to pure black/white automatically.
 * Works best when ink is clearly darker than paper (good lighting).
 * Tune: no parameters — Otsu selects the optimal threshold automatically.
 */
function preprocessVariantB(file: File): Promise<Blob> {
  return preprocessWithCanvas(file, (imageData) => {
    toGrayscale(imageData.data)
    const t = computeOtsuThreshold(imageData.data)
    applyThreshold(imageData.data, t)
    return imageData
  })
}

/**
 * VARIANT C — Grayscale + sharpen + Otsu threshold.
 * Sharpens edges before binarising — helps with blurry phone photos.
 * Tune: adjust kernel in applySharpen() for stronger/weaker sharpening.
 */
function preprocessVariantC(file: File): Promise<Blob> {
  return preprocessWithCanvas(file, (imageData, w, h) => {
    toGrayscale(imageData.data)
    const sharpened = applySharpen(imageData.data, w, h)
    const result = new ImageData(sharpened, w, h)
    const t = computeOtsuThreshold(result.data)
    applyThreshold(result.data, t)
    return result
  })
}

/**
 * VARIANT D — Grayscale + Otsu threshold + stroke dilation.
 * Thickens handwritten strokes after binarisation.
 * Helps when Saly uses a thin pen and Tesseract misses fine strokes.
 * Tune: adjust dilation radius inside dilateDark() (currently 1px).
 */
function preprocessVariantD(file: File): Promise<Blob> {
  return preprocessWithCanvas(file, (imageData, w, h) => {
    toGrayscale(imageData.data)
    const t = computeOtsuThreshold(imageData.data)
    applyThreshold(imageData.data, t)
    const dilated = dilateDark(imageData.data, w, h)
    return new ImageData(dilated, w, h)
  })
}

/**
 * VARIANT E — Dot-removal for dotted/ruled notebook paper, then Otsu threshold.
 *
 * The problem: dotted ruled lines in Saly's notebook are light grey. Tesseract
 * interprets each dot as a character and generates pages of garbage noise.
 *
 * The fix: push light-grey pixels (dots) to white BEFORE thresholding, so only
 * darker ink (the actual handwriting) survives into the binarised image.
 *
 * How it works:
 *   1. Grayscale conversion
 *   2. "Dot kill" pass — any pixel brighter than DOT_THRESHOLD becomes white.
 *      Blue ink on white paper converts to ~50-150 grey; dots are ~190-230 grey.
 *      Setting DOT_THRESHOLD = 185 kills dots while keeping ink.
 *      Tune: raise DOT_THRESHOLD if ink is being erased; lower if dots remain.
 *   3. Otsu global threshold on the dot-removed image.
 *
 * This variant is placed FIRST in ATTEMPT_PLANS so it runs before others.
 */
const DOT_THRESHOLD = 185 // tune here — pixels above this are treated as dots/background
function preprocessVariantE(file: File): Promise<Blob> {
  return preprocessWithCanvas(file, (imageData) => {
    const d = imageData.data
    // Step 1: grayscale
    toGrayscale(d)
    // Step 2: kill dots — push light grey to white before thresholding
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] > DOT_THRESHOLD) { d[i] = 255; d[i + 1] = 255; d[i + 2] = 255 }
    }
    // Step 3: Otsu threshold on the cleaned image
    const t = computeOtsuThreshold(d)
    applyThreshold(d, t)
    return imageData
  })
}

/**
 * VARIANT F — Blue ink isolation (best for Saly's blue pen on white ruled paper).
 *
 * The problem: page bleed-through from previous entries + dotted ruled lines
 * generate huge amounts of noise. Both appear as grey/black in greyscale,
 * indistinguishable from ink after thresholding.
 *
 * The fix: Saly writes in blue ink. Blue pixels have a noticeably higher B
 * channel relative to R compared to grey (bleed-through, dots, shadows).
 * By isolating blue-ish pixels BEFORE greyscale conversion, we keep only
 * the actual handwriting and discard everything else.
 *
 * How it works:
 *   1. For each pixel, check if it looks "blue-ish":
 *      - B channel must exceed R by at least BLUE_ADVANTAGE (ink is bluer than grey)
 *      - Overall brightness must be below BLUE_MAX_BRIGHTNESS (not white paper)
 *   2. Non-blue pixels → forced to white (paper)
 *   3. Blue pixels → forced to black (ink)
 *   This produces a clean binary image with only the blue handwriting.
 *
 * Tune:
 *   BLUE_ADVANTAGE — how much bluer than red a pixel must be to count as ink.
 *     Lower = more permissive (catches faint blue), higher = stricter.
 *     Current: 15. Try 10 if ink is being lost, 25 if bleed-through survives.
 *   BLUE_MAX_BRIGHTNESS — pixels brighter than this are treated as white paper.
 *     Current: 200. Lower if light grey dots are surviving.
 */
const BLUE_ADVANTAGE = 15
const BLUE_MAX_BRIGHTNESS = 200
function preprocessVariantF(file: File): Promise<Blob> {
  return preprocessWithCanvas(file, (imageData) => {
    const d = imageData.data
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2]
      const brightness = (r + g + b) / 3
      const isBlueInk = b > r + BLUE_ADVANTAGE && brightness < BLUE_MAX_BRIGHTNESS
      const v = isBlueInk ? 0 : 255
      d[i] = v; d[i + 1] = v; d[i + 2] = v
    }
    return imageData
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: TESSERACT CONFIG VARIANTS
// PSM = Page Segmentation Mode, OEM = OCR Engine Mode.
// Add new configs here to test different Tesseract settings.
// Tune: adjust psm values below. OEM 1 (LSTM) is the best for modern Tesseract.
// ═══════════════════════════════════════════════════════════════════════════════

type TesseractConfig = {
  name: string
  lang: string
  psm: PSM     // passed to tessedit_pageseg_mode
  oem: number  // passed to createWorker — 1 = LSTM only (recommended)
}

// PSM reference:
//   SINGLE_COLUMN — one column of variable-size text
//   SINGLE_BLOCK  — uniform block of text (default, good for logs)
//   SPARSE_TEXT   — sparse text, good for irregular layouts
// Tune: add or remove configs to change which combinations are tried.
const TESSERACT_CONFIGS: TesseractConfig[] = [
  { name: 'psm6-oem1',  lang: 'tha', psm: PSM.SINGLE_BLOCK,  oem: 1 },
  { name: 'psm11-oem1', lang: 'tha', psm: PSM.SPARSE_TEXT,   oem: 1 },
  { name: 'psm4-oem1',  lang: 'tha', psm: PSM.SINGLE_COLUMN, oem: 1 },
]

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6: OCR QUALITY SCORING
// Score a raw OCR text string for likely quality on handwritten Thai logs.
// Used by multi-attempt to pick the best result. Higher score = better.
// Tune: adjust weights below.
// ═══════════════════════════════════════════════════════════════════════════════

function scoreOcrText(text: string): number {
  if (!text?.trim()) return 0

  const lines = text.split('\n').filter(l => l.trim())
  let score = 0

  // Thai character density — the primary quality signal.
  // Tune: the multiplier (currently 50) controls how much this dominates.
  const thaiChars = (text.match(/[\u0E00-\u0E7F]/g) ?? []).length
  const totalChars = text.replace(/\s/g, '').length
  if (totalChars > 0) score += (thaiChars / totalChars) * 50

  // Reward numbers in the service price range — each one is likely real data.
  const prices = [...text.matchAll(/\d+/g)]
    .map(m => Number(m[0]))
    .filter(n => n >= 50 && n <= 2000)
  score += prices.length * 5

  // Reward lines that look like complete service entries (Thai text + number).
  for (const line of lines) {
    if (/[\u0E00-\u0E7F]/.test(line) && /\d{2,4}/.test(line)) score += 8
  }

  // Penalise garbage symbols that indicate poor OCR quality.
  const garbage = (text.match(/[|[\]{}\\^~`<>!@#$%^&*]/g) ?? []).length
  score -= garbage * 2

  // Penalise very long lines with no Thai — likely noise/borders.
  for (const line of lines) {
    if (line.length > 20 && !/[\u0E00-\u0E7F]/.test(line)) score -= 3
  }

  return Math.round(score)
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7: POST-PROCESSING CLEANUP
// Conservative Thai-focused cleanup applied after Tesseract output.
// Philosophy: only remove what is clearly garbage; never modify Thai text or numbers.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Clean up raw Tesseract output while preserving Thai characters and numbers.
 * Conservative: only removes lines with zero Thai AND zero digit content.
 * Does not translate, rewrite, or guess at content.
 */
// Thai digit → Arabic digit mapping (๐=0, ๑=1, ... ๙=9)
const THAI_DIGIT_MAP: Record<string, string> = {
  '๐':'0','๑':'1','๒':'2','๓':'3','๔':'4','๕':'5','๖':'6','๗':'7','๘':'8','๙':'9'
}
function normalizeThaiDigits(text: string): string {
  return text.replace(/[๐-๙]/g, c => THAI_DIGIT_MAP[c] ?? c)
}

export function cleanOcrText(text: string): string {
  return normalizeThaiDigits(text)
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .filter(line => {
      if (!line) return false
      // Discard very short pure-symbol lines ("|", "---", "===")
      if (line.length <= 2 && !/[\u0E00-\u0E7F\d]/.test(line)) return false

      const hasThai  = /[\u0E00-\u0E7F]/.test(line)
      const hasDigit = /\d/.test(line)

      // Always keep lines with Thai characters
      if (hasThai) return true

      // Keep digit-only lines only if they contain a plausible price (50-2000)
      // This prevents date numbers, noise numbers etc. from surviving
      if (hasDigit) {
        const nums = [...line.matchAll(/\d+/g)].map(m => Number(m[0]))
        return nums.some(n => n >= 50 && n <= 2000)
      }

      return false
    })
    .join('\n')
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8: MULTI-ATTEMPT OCR ENGINE
// Creates one Tesseract worker, runs it across multiple preprocessing variants
// and PSM configs, scores each result, and returns the best.
// Additive: the original single-pass path in runOcr() still exists as fallback.
// ═══════════════════════════════════════════════════════════════════════════════

type AttemptPlan = {
  variantName: string
  preprocessFn: (f: File) => Promise<Blob>
  config: TesseractConfig
}

// Define which preprocessing × Tesseract config combinations to try.
// Tune: reorder, add, or remove entries to change the attempt strategy.
// Earlier entries run first. Attempts stop early if GOOD_ENOUGH_SCORE is hit.
const ATTEMPT_PLANS: AttemptPlan[] = [
  { variantName: 'F-blue-ink',     preprocessFn: preprocessVariantF, config: TESSERACT_CONFIGS[0] }, // blue pen isolation — best for Saly's notebook
  { variantName: 'E-dot-removal',  preprocessFn: preprocessVariantE, config: TESSERACT_CONFIGS[0] }, // dot removal fallback
  { variantName: 'A-original',     preprocessFn: preprocessVariantA, config: TESSERACT_CONFIGS[0] }, // original v2 fallback
]

async function runMultiAttemptOcr(file: File): Promise<{
  rawText: string
  debugAttempts: OcrDebugInfo['attempts']
  selectedAttempt: number
}> {
  const plans = ATTEMPT_PLANS.slice(0, OCR_CONFIG.MAX_ATTEMPTS)
  const debugAttempts: OcrDebugInfo['attempts'] = []

  // All planned attempts use OEM 1 (LSTM only). If you need different OEM per
  // attempt, use worker.reinitialize(lang, oem) between attempts.
  // Tune: change the oem argument to createWorker() here.
  const worker = await createWorker('tha', 1, { logger: () => {} })

  try {
    for (const plan of plans) {
      try {
        const blob = await plan.preprocessFn(file)

        // Tune: add or remove setParameters keys here (see Tesseract docs).
        await worker.setParameters({
          tessedit_pageseg_mode: plan.config.psm,
          user_defined_dpi: '150', // prevents DPI warning and forces model initialisation
        })

        const { data } = await worker.recognize(blob)
        const rawText = data.text.trim()
        const score   = scoreOcrText(rawText)

        debugAttempts.push({ variant: plan.variantName, config: plan.config.name, rawText, score })

        if (score >= OCR_CONFIG.GOOD_ENOUGH_SCORE) break // good enough — stop early
      } catch (e) {
        console.warn(`[OCR] Attempt "${plan.variantName}" failed:`, e)
        debugAttempts.push({ variant: plan.variantName, config: plan.config.name, rawText: '', score: 0 })
      }
    }
  } finally {
    await worker.terminate()
  }

  // Pick the attempt with the highest score.
  let selectedAttempt = 0
  for (let i = 1; i < debugAttempts.length; i++) {
    if (debugAttempts[i].score > debugAttempts[selectedAttempt].score) selectedAttempt = i
  }

  return {
    rawText: debugAttempts[selectedAttempt]?.rawText ?? '',
    debugAttempts,
    selectedAttempt,
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 10: LINE PARSING — ROW-FIRST APPROACH
//
// Priority order per row:
//   1. Row detection  — a line qualifies as a service row if it has a valid number
//   2. Cash/transfer  — extracted independently, defaults to transfer
//   3. Amount         — the last valid number on the line
//   4. Service name   — attempted but never blocks row creation; blank if unsure
//
// A row is created as long as it passes the row-detection gate (has a number
// in range and is not a summary line). All other fields are best-effort.
// ═══════════════════════════════════════════════════════════════════════════════

/** Returns true if this line looks like a summary/total row that should be skipped. */
function isSummaryLine(line: string): boolean {
  // Lines with known summary keywords
  if (/รวม|total|subtotal/.test(line)) return true
  // Lines that are only numbers/symbols (no Thai at all) — headers, borders, etc.
  // But: if there ARE Thai chars, don't skip — it might be a garbled service line.
  if (!/[\u0E00-\u0E7F]/.test(line) && !/\d/.test(line)) return true
  // Lines with 3+ distinct valid numbers are almost certainly totals rows
  const nums = [...line.matchAll(/\d+/g)]
    .map(m => Number(m[0]))
    .filter(n => n >= 50 && n <= 2000)
  if (nums.length >= 3) return true
  return false
}

/** Extract cash/transfer from a line. Checks brackets (open or closed) first,
 *  then falls back to inline keywords. Defaults to transfer. */
function extractPayment(line: string): 'cash' | 'transfer' {
  // Priority 1: bracket content — (เงินสด) or unclosed (เงนล์ด
  const bracketContent = line.match(/\(([^)]+)\)?/)
  const checkText = bracketContent ? bracketContent[1] : line
  // เง* catches garbled variants of เงินสด seen in OCR output (ไงนแ, เงนล์ด, etc.)
  if (/เงินสด|เงนสด|เง[นง]|งน|สด|cash/i.test(checkText)) return 'cash'
  // Priority 2: inline keyword anywhere on line (no bracket needed)
  if (/เงินสด|สด|cash/i.test(line)) return 'cash'
  // โอน variants seen in OCR: ไอน, โอน, ใอน — all mean transfer (default anyway, but explicit is better)
  // No action needed — transfer is already the default return value
  return 'transfer'
}

/** Extract the best price from a line. Takes the last valid number (50-2000)
 *  since price appears at the end of the line after the service name.
 *  Returns null if no valid number found — used to gate row detection. */
function extractAmount(line: string): { amount: number; idx: number } | null {
  // Strip bracket section first so (โอน) numbers don't interfere
  const lineNoBracket = line.replace(/\([^)]*\)?$/g, ' ')
  const nums = [...lineNoBracket.matchAll(/\d+/g)]
    .map(m => ({ val: Number(m[0]), idx: m.index! }))
    .filter(n => n.val >= 50 && n.val <= 2000)
  if (nums.length === 0) return null
  const last = nums[nums.length - 1]
  return { amount: last.val, idx: last.idx }
}

// ─────────────────────────────────────────────────────────────────────────────
// DASH-FORMAT PARSER
// Handles the structured format Saly is being asked to write:
//   ชื่อบริการ - ราคา - สด/โอน
//
// Detection: a line is treated as dash-format if it contains 2+ dashes AND
// one of the segments contains a valid price number.
//
// Each segment is trimmed and parsed independently:
//   Segment 0 → service name (matched against service list, blank if no match)
//   Segment 1 → price (first valid number 50-2000)
//   Segment 2 → payment (สด = cash, โอน = transfer, default transfer)
//
// OCR often reads dashes as other characters (–, —, /, |, \).
// DASH_PATTERN covers all common OCR substitutions for a dash separator.
// Tune: add more characters to DASH_PATTERN if Saly's dashes get misread.
// ─────────────────────────────────────────────────────────────────────────────
const DASH_PATTERN = /\s*[-–—\/|\\]\s*/  // covers -, –, —, /, |, \

function isDashFormat(line: string): boolean {
  const parts = line.split(DASH_PATTERN)
  if (parts.length < 2) return false
  // At least one segment must contain a number in price range
  return parts.some(p => {
    const n = Number(p.trim().match(/\d+/)?.[0])
    return n >= 50 && n <= 2000
  })
}

function parseDashLine(line: string): DetectedService | null {
  const parts = line.split(DASH_PATTERN).map(p => p.trim())

  // Find which segment holds the price
  let amount = 0
  let priceIdx = -1
  for (let i = 0; i < parts.length; i++) {
    const n = Number(parts[i].match(/\d+/)?.[0])
    if (n >= 50 && n <= 2000) { amount = n; priceIdx = i; break }
  }
  if (!amount) return null

  // Service name = segment before the price
  const serviceText = priceIdx > 0 ? parts[priceIdx - 1] : ''
  const matched = matchService(serviceText)
  const description = matched ? matched.th : ''

  // Payment = segment after the price, or fall back to scanning all segments
  const paymentText = parts.slice(priceIdx + 1).join(' ')
  let payment: 'cash' | 'transfer' = 'transfer'
  if (/สด|เงินสด|cash/i.test(paymentText) || /สด|เงินสด|cash/i.test(line)) payment = 'cash'

  return { description, amount, payment }
}

function parseLines(rawText: string): DetectedService[] {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean)
  const results: DetectedService[] = []

  for (const line of lines) {
    // GATE 1: Skip summary/total lines — these are never service rows
    if (isSummaryLine(line)) continue

    // GATE 2: Must have Thai characters — prevents dates, headers, and noise rows
    if (!/[\u0E00-\u0E7F]/.test(line)) continue

    // ── Path A: structured dash format (ชื่อ - ราคา - สด/โอน) ─────────────
    // Try this first — it is more precise than the freeform parser below.
    if (isDashFormat(line)) {
      const result = parseDashLine(line)
      if (result) { results.push(result); continue }
    }

    // ── Path B: freeform fallback — existing row-first logic ─────────────────
    // GATE 3: Must have a valid price number — the numeric row-detection signal
    const amountResult = extractAmount(line)
    if (!amountResult) continue

    // Field 1: cash/transfer
    const payment = extractPayment(line)

    // Field 2: amount
    const { amount, idx: numIdx } = amountResult

    // Field 3: service name — best effort, blank if not confident
    const lineNoBracket = line.replace(/\([^)]*\)?$/g, ' ')
    const serviceText = lineNoBracket.slice(0, numIdx).trim()
    const textForMatching = serviceText.length >= 2 ? serviceText : line
    const matched = matchService(textForMatching)
    const description = matched ? matched.th : ''

    results.push({ description, amount, payment })
  }

  return results
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 11: ORIGINAL PREPROCESSING (EXISTING — UNCHANGED)
// This function is the original v2 preprocessImage(), kept exactly as-is.
// Used by the fallback path in runOcr() if multi-attempt fails or is disabled.
// Also preserved so nothing in the existing codebase breaks if it's referenced.
// ═══════════════════════════════════════════════════════════════════════════════

function preprocessImage(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const minDim = 1600
      let { width, height } = img
      if (width < minDim && height < minDim) {
        const ratio = minDim / Math.max(width, height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      const imageData = ctx.getImageData(0, 0, width, height)
      const data = imageData.data
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
        const contrast = 1.8
        const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255))
        const boosted = Math.min(255, Math.max(0, factor * (gray - 128) + 128))
        data[i] = boosted
        data[i + 1] = boosted
        data[i + 2] = boosted
      }
      ctx.putImageData(imageData, 0, 0)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => resolve(blob!), 'image/png')
    }
    img.src = url
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 12: MAIN OCR ENTRY POINT (ENHANCED)
// runOcr() is the only public OCR function — its signature is unchanged.
// Enhancement: tries multi-attempt pipeline first, falls back to original on error.
// The fallback guarantees the app never breaks due to the new pipeline.
// ═══════════════════════════════════════════════════════════════════════════════

export async function runOcr(imageFile: File): Promise<OcrResult> {
  let rawText = ''
  let debugInfo: OcrDebugInfo | null = null

  // ── Enhanced path: multi-attempt OCR ──────────────────────────────────────
  if (OCR_CONFIG.MULTI_ATTEMPT) {
    try {
      const result = await runMultiAttemptOcr(imageFile)
      rawText = result.rawText
      debugInfo = {
        attempts: result.debugAttempts,
        selectedAttempt: result.selectedAttempt,
        cleanedText: '',  // filled in below
        finalText: '',
      }
    } catch (e) {
      console.warn('[OCR] Multi-attempt pipeline failed — falling back to original single-pass:', e)
      rawText = '' // trigger fallback below
    }
  }

  // ── Fallback path: single-pass OCR using same createWorker path for consistency ──
  if (!rawText) {
    try {
      const preprocessed = await preprocessImage(imageFile)
      const fallbackWorker = await createWorker('tha', 1, { logger: () => {} })
      try {
        await fallbackWorker.setParameters({ user_defined_dpi: '150' })
        const { data } = await fallbackWorker.recognize(preprocessed)
        rawText = data.text.trim()
      } finally {
        await fallbackWorker.terminate()
      }
    } catch (e) {
      console.error('[OCR] Fallback single-pass also failed:', e)
      rawText = ''
    }
  }

  // ── Post-processing cleanup ───────────────────────────────────────────────
  const cleanedText = cleanOcrText(rawText)

  const finalText = cleanedText

  // ── Debug output (browser only, does not affect UI) ───────────────────────
  // Inspect in browser console: window.__lep_ocr_debug
  if (OCR_CONFIG.DEBUG && typeof window !== 'undefined') {
    if (debugInfo) {
      debugInfo.cleanedText = cleanedText
      debugInfo.finalText   = finalText
    }
    ;(window as any).__lep_ocr_debug = debugInfo ?? { rawText, cleanedText, finalText }
    console.debug(
      '[Lep OCR]',
      debugInfo?.attempts.map(a => `${a.variant}: score=${a.score}`).join(' | ') ?? 'single-pass',
      `→ selected: ${debugInfo?.attempts[debugInfo.selectedAttempt]?.variant ?? 'fallback'}`,
    )
  }

  // ── Extract numbers and parse service lines ───────────────────────────────
  const matches = finalText.match(/\d+(\.\d+)?/g) ?? []
  const numbers = [...new Set(
    matches.map(Number).filter((n) => n >= 50 && n <= 100000)
  )].sort((a, b) => b - a)

  const detectedServices = parseLines(finalText)

  return { rawText: finalText, numbers, detectedServices }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 13: IMAGE COMPRESSION (EXISTING — UNCHANGED)
// compressImage() is called from review/page.tsx after OCR completes.
// This function is preserved exactly as-is.
// ═══════════════════════════════════════════════════════════════════════════════

export function compressImage(file: File, maxKB = 400): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let { width, height } = img
      const maxDim = 1200
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      let quality = 0.8
      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) return resolve(new Blob())
            if (blob.size <= maxKB * 1024 || quality <= 0.3) {
              URL.revokeObjectURL(url)
              resolve(blob)
            } else {
              quality -= 0.1
              tryCompress()
            }
          },
          'image/jpeg',
          quality
        )
      }
      tryCompress()
    }
    img.src = url
  })
}
