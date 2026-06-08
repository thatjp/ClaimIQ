import { kv } from '@/lib/kv'
import { db } from '@/lib/db'
import { embedItem } from '@/lib/ai/embed'
import { traceStep, type PriceTraceStep, type PriceLayer } from '@/lib/pricing/trace'
import { updateLiveTrace } from '@/lib/pricing/live-trace'
import { fetchSerpPrice, getEnginesForCategory, type SerpEngine } from '@/lib/pricing/serp'
import type { ClaimItemInput } from '@/lib/workflow'

function log(layer: string, hit: boolean, durationMs: number, meta?: Record<string, unknown>) {
  console.log(JSON.stringify({ service: 'price-workflow', layer, hit, durationMs, ...meta }))
}

async function lookupSerpEngine(engine: SerpEngine, item: ClaimItemInput) {
  'use step'

  const result = await fetchSerpPrice(engine, item)
  log(engine, !!result.value, result.durationMs, {
    item: item.name,
    price: result.value?.price,
    ...(result.detail ? { detail: result.detail } : {}),
  })
  return result
}

async function cachePrice(item: ClaimItemInput, price: number, sources: string[]) {
  'use step'

  const cacheKey = `price:${item.name}:${item.brand || ''}:${item.condition}`
  const t0 = Date.now()

  await Promise.allSettled([
    kv.set(cacheKey, { price, sources, cached_at: new Date().toISOString() }, { ex: 60 * 60 * 24 * 7 }),
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
  log('cache_write', true, Math.round(Date.now() - t0), { item: item.name, price })
}

async function publishLiveTrace(traceKey: string | undefined, steps: PriceTraceStep[]) {
  'use step'

  if (!traceKey) return
  try {
    await updateLiveTrace(traceKey, { workflowTrace: steps })
  } catch (err) {
    console.warn('[price-workflow] live trace update failed:', err instanceof Error ? err.message : err)
  }
}

export async function priceItemWorkflow(item: ClaimItemInput) {
  'use workflow'

  const workflowTrace: PriceTraceStep[] = []
  const traceKey = item.traceKey

  const engines = getEnginesForCategory(item.category)

  for (const engine of engines) {
    const layer = engine as PriceLayer
    await publishLiveTrace(traceKey, [...workflowTrace, traceStep(layer, 'running')])
    const result = await lookupSerpEngine(engine, item)
    workflowTrace.push(traceStep(layer, result.value ? 'hit' : 'miss', result.durationMs, result.detail))
    await publishLiveTrace(traceKey, workflowTrace)

    if (result.value) {
      await cachePrice(item, result.value.price, result.value.sources)
      return { price: result.value.price, sources: result.value.sources, source: engine, trace: workflowTrace }
    }
  }

  return { price: null, sources: [], source: 'not_found' as const, trace: workflowTrace }
}
