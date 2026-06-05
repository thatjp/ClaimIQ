import { generateObject } from 'ai'
import { z } from 'zod'
import { kv } from '@/lib/kv'
import { db } from '@/lib/db'
import { embedItem } from '@/lib/ai/embed'
import { MODELS } from '@/lib/ai/models'
import type { ClaimItemInput } from '@/lib/workflow'

const PriceResult = z.object({
  price: z.number(),
  sources: z.array(z.string()),
})

async function lookupPrice(item: ClaimItemInput) {
  'use step'

  const { object } = await generateObject({
    model: MODELS.priceNorm,
    schema: PriceResult,
    prompt: `You are an insurance pricing assistant. Estimate the current replacement cost for the following item.
Return a realistic market price in USD and list 1-3 example retailer URLs where this item can be purchased.

Item: ${item.name}
Brand: ${item.brand || 'unknown'}
Model: ${item.model || 'unknown'}
Condition: ${item.condition}
Estimated age: ${item.estimatedAge ? `${item.estimatedAge} years` : 'unknown'}

Return the replacement cost as a number (no currency symbol) and source URLs.`,
  })

  return object
}

async function cachePrice(item: ClaimItemInput, price: number, sources: string[]) {
  'use step'

  const cacheKey = `price:${item.name}:${item.brand || ''}:${item.condition}`
  const cached_at = new Date().toISOString()

  await Promise.allSettled([
    kv.set(cacheKey, { price, sources, cached_at }, { ex: 60 * 60 * 24 * 7 }),
    (async () => {
      const embedding = await embedItem(item)
      await db`
        INSERT INTO item_prices (name, brand, condition, price, sources, embedding, cached_at)
        VALUES (${item.name}, ${item.brand || ''}, ${item.condition}, ${price}, ${JSON.stringify(sources)}, ${JSON.stringify(embedding)}::vector, NOW())
        ON CONFLICT (name, brand, condition) DO UPDATE
        SET price = EXCLUDED.price, sources = EXCLUDED.sources, embedding = EXCLUDED.embedding, cached_at = NOW()
      `
    })(),
  ])
}

export async function priceItemWorkflow(item: ClaimItemInput) {
  'use workflow'

  const { price, sources } = await lookupPrice(item)
  await cachePrice(item, price, sources)

  return { price, sources }
}
