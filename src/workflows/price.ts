import { generateObject } from 'ai'
import { z } from 'zod'
import { kv } from '@/lib/kv'
import { db } from '@/lib/db'
import { embedItem } from '@/lib/ai/embed'
import { MODELS, anthropic } from '@/lib/ai/models'
import type { ClaimItemInput } from '@/lib/workflow'

const PriceResult = z.object({
  price: z.number(),
  sources: z.array(z.string()),
})

async function lookupPrice(item: ClaimItemInput) {
  'use step'

  const { object } = await generateObject({
    model: MODELS.priceSearch,
    schema: z.object({
      price: z.number().describe('Current retail replacement cost in USD'),
      sources: z.array(z.string().url()).min(1).describe('URLs of retailer listings where this item can be purchased — must include at least one'),
    }),
    tools: { webSearch: anthropic.tools.webSearch_20260209({ maxUses: 5 }) },
    maxSteps: 5,
    prompt: `You are an insurance pricing assistant. Search for the current retail replacement cost of this item.

Item: ${item.name}
Brand: ${item.brand || 'unknown'}
Model: ${item.model || 'unknown'}
Condition: ${item.condition}
Estimated age: ${item.estimatedAge ? `${item.estimatedAge} years` : 'unknown'}

Search retailers like Amazon, Best Buy, Home Depot, or the manufacturer's site. You MUST return at least one source URL from your search results — do not estimate without searching first.`,
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
