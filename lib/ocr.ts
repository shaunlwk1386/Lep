import Tesseract from 'tesseract.js'
import { SERVICE_LIST, matchService } from './services'

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

// Preprocess image: grayscale + contrast boost before OCR
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

      // Contrast factor: contrast is a value like 50 (range -255 to 255)
      const contrastLevel = 60
      const factor = (259 * (contrastLevel + 255)) / (255 * (259 - contrastLevel))
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
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

// Parse each line of OCR text to extract service, amount, payment
function parseLines(rawText: string): DetectedService[] {
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean)
  const results: DetectedService[] = []

  for (const line of lines) {
    // Rule 1: Skip summary/total lines
    if (/รวม|total|subtotal|50%|=|%/.test(line)) continue

    // Rule 2: Skip lines with no Thai characters (likely noise)
    if (!/[\u0E00-\u0E7F]/.test(line)) continue

    // Rule 3: Extract payment from brackets anywhere on line — (เงินสด) or (โอน)
    let payment: 'cash' | 'transfer' = 'transfer'
    const bracketMatch = line.match(/\(([^)]+)\)/)
    if (bracketMatch) {
      const bracketText = bracketMatch[1]
      if (/เงินสด|สด|cash/i.test(bracketText)) payment = 'cash'
      else if (/โอน|transfer/i.test(bracketText)) payment = 'transfer'
    } else {
      // Also detect inline keywords without brackets
      if (/สด|เงินสด|cash/i.test(line)) payment = 'cash'
    }

    // Rule 4: Strip bracket section and find numbers between 50-3000
    const lineNoBracket = line.replace(/\([^)]*\)/g, ' ')
    const allNums = [...lineNoBracket.matchAll(/\d+/g)]
      .map((m) => ({ val: Number(m[0]), idx: m.index! }))
      .filter((n) => n.val >= 50 && n.val <= 3000)

    if (allNums.length === 0) continue

    // Price is at the END of the line — take the LAST valid number
    const { val: amount, idx: numIdx } = allNums[allNums.length - 1]

    // Rule 5: Service text = everything BEFORE that last number
    const serviceText = lineNoBracket.slice(0, numIdx).trim()

    // Rule 6: The whole line must have Thai content (service text may be garbled)
    // Match service against the full line for better coverage
    const textForMatching = serviceText.length >= 2 ? serviceText : line

    // Rule 7: Match service name from known list
    const matched = matchService(textForMatching)
    const description = matched ? matched.th : ''

    // Only push if we got either a matched description or clear service text
    if (!description && !/[\u0E00-\u0E7F]/.test(serviceText)) continue

    results.push({ description, amount, payment })
  }

  return results
}

export async function runOcr(imageFile: File): Promise<OcrResult> {
  const preprocessed = await preprocessImage(imageFile)

  const { data } = await Tesseract.recognize(preprocessed, 'tha+eng', {
    logger: () => {},
  })

  const rawText = data.text.trim()

  // Extract all numbers >= 50
  const matches = rawText.match(/\d+(\.\d+)?/g) ?? []
  const numbers = [...new Set(
    matches.map(Number).filter((n) => n >= 50 && n <= 100000)
  )].sort((a, b) => b - a)

  // Parse lines into structured services
  const detectedServices = parseLines(rawText)

  return { rawText, numbers, detectedServices }
}

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
