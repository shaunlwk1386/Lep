import { NextResponse } from 'next/server'

// Token-cost optimisation notes:
// - Model: claude-haiku-4-5-20251001 — cheapest Claude model, ~$0.001 per image
// - Image is resized to max 800px before sending (done client-side in ocr.ts)
// - System prompt is short and directive — no examples, no explanation
// - Response is compact JSON only — no prose

const SYSTEM_PROMPT = `You are reading a handwritten Thai nail salon daily log image.
Extract each service entry and return ONLY a JSON array. No explanation, no markdown.

Each entry must follow this shape:
{"description":"thai service name or empty string","amount":number,"payment":"cash" or "transfer"}

Rules:
- One object per service line
- Skip the date line and the total/รวม line
- payment is "cash" if line contains สด or เงินสด, otherwise "transfer"
- amount is the price number on that line (integer)
- description is the Thai service name text, or empty string if unreadable
- Return [] if no entries found`

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  console.log('[OCR] API key present:', !!apiKey, '| key prefix:', apiKey?.slice(0, 10))
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 })
  }

  let body: { image?: string; mediaType?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.image) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 })
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512, // service list is small — 512 is plenty
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: body.mediaType ?? 'image/jpeg',
                  data: body.image,
                },
              },
              {
                type: 'text',
                text: 'Extract the service entries.',
              },
            ],
          },
        ],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[OCR API] Anthropic error:', err)
      return NextResponse.json({ error: 'Anthropic API error' }, { status: 502 })
    }

    const data = await res.json()
    const text = data.content?.[0]?.text ?? '[]'

    // Parse the JSON array Claude returned
    let services: Array<{ description: string; amount: number; payment: string }> = []
    try {
      const parsed = JSON.parse(text.trim())
      if (Array.isArray(parsed)) services = parsed
    } catch {
      // Claude returned something unexpected — return empty
      console.warn('[OCR API] Failed to parse Claude response:', text)
    }

    // Sanitise each entry
    services = services
      .filter(s => typeof s.amount === 'number' && s.amount >= 50)
      .map(s => ({
        description: typeof s.description === 'string' ? s.description : '',
        amount: Math.round(s.amount),
        payment: s.payment === 'cash' ? 'cash' : 'transfer',
      }))

    return NextResponse.json({ services })
  } catch (e) {
    console.error('[OCR API] Error:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
