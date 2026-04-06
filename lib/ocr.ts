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

// Parse each line of OCR text to extract service, amount, payment
function parseLines(rawText: string): DetectedService[] {
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean)
  const results: DetectedService[] = []

  for (const line of lines) {
    // Skip lines that look like totals/summaries
    if (/รวม|total|50%|=/i.test(line)) continue

    // Extract number from line (price)
    const numMatch = line.match(/(\d{2,6})/)
    if (!numMatch) continue
    const amount = Number(numMatch[1])
    if (amount < 50 || amount > 50000) continue

    // Detect payment method
    let payment: 'cash' | 'transfer' = 'transfer'
    if (/เงินสด|สด|cash/i.test(line)) payment = 'cash'
    if (/โอน|transfer/i.test(line)) payment = 'transfer'

    // Match service name
    const matched = matchService(line)
    const description = matched ? matched.th : ''

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
