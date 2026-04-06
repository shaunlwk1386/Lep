import Tesseract from 'tesseract.js'

export type OcrResult = {
  rawText: string
  numbers: number[]
}

export async function runOcr(imageFile: File): Promise<OcrResult> {
  const { data } = await Tesseract.recognize(imageFile, 'tha+eng', {
    logger: () => {}, // suppress logs
  })

  const rawText = data.text.trim()

  // Extract all numbers from the text
  const matches = rawText.match(/\d+(\.\d+)?/g) ?? []
  const numbers = [...new Set(matches.map(Number))].filter((n) => n > 0).sort((a, b) => b - a)

  return { rawText, numbers }
}

export function compressImage(file: File, maxKB = 400): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let { width, height } = img

      // Scale down if too large
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

      // Try compressing at decreasing quality until under maxKB
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
