import { kv } from '@/lib/kv'
import { db } from '@/lib/db'

export async function POST(req: Request) {
  const signature = req.headers.get('x-vercel-signature')

  // TODO: Verify signature against WEBHOOK_SECRET to prevent unauthorized calls
  // const isValid = verifySignature(signature, await req.text(), process.env.WEBHOOK_SECRET)
  // if (!isValid) return Response.json({ error: 'Invalid signature' }, { status: 401 })

  if (!signature) {
    // In development, allow unsigned requests
    console.warn('Webhook received without signature — skipping verification in development')
  }

  let body: {
    step?: string
    workflowRunId?: string
    item?: {
      name: string
      brand?: string
      condition: string
    }
    result?: {
      price: number
      sources: string[]
    }
  }

  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { step, workflowRunId, item, result } = body

  // Handle workflow step completion callbacks
  if (step === 'cache-result' && item && result) {
    // Store normalized price result in DB and KV cache
    try {
      await db`
        INSERT INTO item_prices (name, brand, condition, price, sources, cached_at)
        VALUES (${item.name}, ${item.brand || null}, ${item.condition}, ${result.price}, ${JSON.stringify(result.sources)}, NOW())
        ON CONFLICT DO NOTHING
      `
    } catch {
      console.error('Failed to store price in DB via webhook')
    }

    try {
      const cacheKey = `price:${item.name}:${item.brand || ''}:${item.condition}`
      await kv.set(cacheKey, result, { ex: 60 * 60 * 24 * 7 }) // 7 days
    } catch {
      console.error('Failed to store price in KV via webhook')
    }
  }

  console.log(`Workflow webhook received: run=${workflowRunId} step=${step}`)

  return Response.json({ received: true, workflowRunId, step })
}
