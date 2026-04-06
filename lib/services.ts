export type ServiceOption = {
  th: string
  en: string
}

export const SERVICE_LIST: ServiceOption[] = [
  { th: "ล้างสี มือ", en: "Remove colour - Hands" },
  { th: "ล้างสี เท้า", en: "Remove colour - Feet" },
  { th: "ทาสีปกติ มือ", en: "Apply regular colour - Hands" },
  { th: "ทาสีปกติ เท้า", en: "Apply regular colour - Feet" },
  { th: "ทาสีแฟลช มือ", en: "Apply flash colour - Hands" },
  { th: "ทาสีแฟลช เท้า", en: "Apply flash colour - Feet" },
  { th: "ทาลูกเกด มือ", en: "Apply gel design - Hands" },
  { th: "ทาลูกเกด เท้า", en: "Apply gel design - Feet" },
  { th: "เพ้นท์ มือ", en: "Nail art - Hands" },
  { th: "เพ้นท์ เท้า", en: "Nail art - Feet" },
  { th: "ติดอะไหล่ มือ", en: "Accessories - Hands" },
  { th: "ติดอะไหล่ เท้า", en: "Accessories - Feet" },
  { th: "ติดสติเกอร์ มือ", en: "Stickers - Hands" },
  { th: "ติดสติเกอร์ เท้า", en: "Stickers - Feet" },
  { th: "ต่อ PVC เว้นโคน มือ", en: "PVC extension - Hands" },
  { th: "ต่อ PVC เว้นโคน เท้า", en: "PVC extension - Feet" },
  { th: "ล้าง + ทาสีปกติ มือ", en: "Remove + apply regular - Hands" },
  { th: "ล้าง + ทาสีปกติ เท้า", en: "Remove + apply regular - Feet" },
  { th: "ล้าง + ทาสีแฟลช มือ", en: "Remove + apply flash - Hands" },
  { th: "ล้าง + ทาสีแฟลช เท้า", en: "Remove + apply flash - Feet" },
  { th: "ล้าง + ทาลูกเกด มือ", en: "Remove + apply gel design - Hands" },
  { th: "ล้าง + ทาลูกเกด เท้า", en: "Remove + apply gel design - Feet" },
  { th: "ล้าง + เพ้นท์ มือ", en: "Remove + nail art - Hands" },
  { th: "ล้าง + เพ้นท์ เท้า", en: "Remove + nail art - Feet" },
  { th: "ทำมือ + ล้าง", en: "Full manicure + remove" },
  { th: "ทำเท้า + ล้าง", en: "Full pedicure + remove" },
  { th: "ทำมือ + ล้าง + ทาสีปกติ", en: "Full manicure + regular colour" },
  { th: "ทำมือ + ล้าง + ทาสีแฟลช", en: "Full manicure + flash colour" },
  { th: "ทำเท้า + ล้าง + ทาสีปกติ", en: "Full pedicure + regular colour" },
  { th: "ทำเท้า + ล้าง + ทาสีแฟลช", en: "Full pedicure + flash colour" },
]

// Find closest matching service from OCR text
export function matchService(ocrText: string): ServiceOption | null {
  if (!ocrText) return null
  const lower = ocrText.toLowerCase()

  let bestMatch: ServiceOption | null = null
  let bestScore = 0

  for (const service of SERVICE_LIST) {
    const thLower = service.th.toLowerCase()
    const enLower = service.en.toLowerCase()

    // Count matching characters
    let score = 0
    for (const char of lower) {
      if (thLower.includes(char) || enLower.includes(char)) score++
    }

    // Bonus for key word matches
    if (lower.includes('มือ') && thLower.includes('มือ')) score += 5
    if (lower.includes('เท้า') && thLower.includes('เท้า')) score += 5
    if (lower.includes('ล้าง') && thLower.includes('ล้าง')) score += 5
    if (lower.includes('ทา') && thLower.includes('ทา')) score += 3
    if (lower.includes('แฟลช') && thLower.includes('แฟลช')) score += 5
    if (lower.includes('ลูกเกด') && thLower.includes('ลูกเกด')) score += 5
    if (lower.includes('pvc') && thLower.includes('pvc')) score += 8
    if (lower.includes('เพ้นท์') && thLower.includes('เพ้นท์')) score += 8

    if (score > bestScore) {
      bestScore = score
      bestMatch = service
    }
  }

  return bestScore > 3 ? bestMatch : null
}
