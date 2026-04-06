import Tesseract from 'tesseract.js'

export type OcrResult = {
  rawText: string
  numbers: number[]
}

// Preprocess image: grayscale + contrast boost before OCR
function preprocessImage(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')

      // Upscale small images for better OCR accuracy
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

      // Get pixel data
      const imageData = ctx.getImageData(0, 0, width, height)
      const data = imageData.data

      for (let i = 0; i < data.length; i += 4) {
        // Convert to grayscale
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]

        // Boost contrast: push pixels toward black or white
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

export async function runOcr(imageFile: File): Promise<OcrResult> {
  // Preprocess for better accuracy
  const preprocessed = await preprocessImage(imageFile)

  const { data } = await Tesseract.recognize(preprocessed, 'tha+eng', {
    logger: () => {},
  })

  const rawText = data.text.trim()

  // Smarter number extraction:
  // - Only keep numbers >= 50 (ignore noise like single digits)
  // - Deduplicate
  // - Sort largest first (total is likely the biggest)
  const matches = rawText.match(/\d+(\.\d+)?/g) ?? []
  const numbers = [...new Set(
    matches
      .map(Number)
      .filter((n) => n >= 50 && n <= 100000) // ignore noise, ignore unrealistic values
  )].sort((a, b) => b - a)

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
