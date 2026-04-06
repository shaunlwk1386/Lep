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

// Phrase keywords for matching — ordered from most specific to least
const KEYWORDS: Array<{ pattern: RegExp; weight: number }> = [
  // Highly specific — rarely confused
  { pattern: /เพ้นท์/, weight: 20 },
  { pattern: /ลูกเกด/, weight: 20 },
  { pattern: /สติเกอร์/, weight: 20 },
  { pattern: /อะไหล่/, weight: 20 },
  { pattern: /pvc/i, weight: 20 },
  { pattern: /แฟลช/, weight: 15 },
  // Compound actions
  { pattern: /ทำมือ/, weight: 15 },
  { pattern: /ทำเท้า/, weight: 15 },
  // Remove
  { pattern: /ล้างสี/, weight: 12 },
  { pattern: /ล้าง/, weight: 8 },
  // Apply
  { pattern: /ทาสี/, weight: 10 },
  { pattern: /ทา/, weight: 4 },
  // Location — critical discriminator
  { pattern: /มือ/, weight: 10 },
  { pattern: /เท้า/, weight: 10 },
]

// Find closest matching service from OCR text using phrase matching
export function matchService(ocrText: string): ServiceOption | null {
  if (!ocrText) return null

  let bestMatch: ServiceOption | null = null
  let bestScore = 0

  for (const service of SERVICE_LIST) {
    const th = service.th
    let score = 0

    for (const kw of KEYWORDS) {
      const inOcr = kw.pattern.test(ocrText)
      const inService = kw.pattern.test(th)
      if (inOcr && inService) score += kw.weight
      // Penalty: OCR has keyword but service does not (wrong match)
      if (inOcr && !inService) score -= kw.weight * 0.5
    }

    // Extra penalty for wrong location when location is clear
    const ocrHasMue = /มือ/.test(ocrText)
    const ocrHasTao = /เท้า/.test(ocrText)
    if (ocrHasMue && /เท้า/.test(th) && !/มือ/.test(th)) score -= 15
    if (ocrHasTao && /มือ/.test(th) && !/เท้า/.test(th)) score -= 15

    if (score > bestScore) {
      bestScore = score
      bestMatch = service
    }
  }

  // Require a meaningful minimum score
  return bestScore >= 10 ? bestMatch : null
}
