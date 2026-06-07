import { kv } from '@/lib/kv'
import { db } from '@/lib/db'
import { embedItem } from '@/lib/ai/embed'
import { traceStep, type PriceTraceStep, type PriceLayer } from '@/lib/pricing/trace'
import { updateLiveTrace } from '@/lib/pricing/live-trace'
import type { ClaimItemInput } from '@/lib/workflow'

// Which SerpAPI engines to try per category, in waterfall order.
type SerpEngine = 'ebay' | 'amazon' | 'walmart' | 'home_depot'

const CATEGORY_SOURCES: Record<string, SerpEngine[]> = {
  electronics: ['ebay', 'amazon', 'walmart'],
  appliances:  ['home_depot', 'amazon', 'walmart'],
  furniture:   ['ebay', 'amazon', 'walmart'],
  clothing:    ['amazon', 'walmart'],
  jewelry:     ['ebay', 'amazon'],
  tools:       ['home_depot', 'amazon', 'walmart'],
  other:       ['ebay', 'amazon', 'walmart'],
}

function log(layer: string, hit: boolean, durationMs: number, meta?: Record<string, unknown>) {
  console.log(JSON.stringify({ service: 'price-workflow', layer, hit, durationMs, ...meta }))
}

function stepElapsed(t0: number) {
  return Math.round(performance.now() - t0)
}

type PriceHit = { price: number; sources: string[] }

interface StepOutcome<T> {
  value: T | null
  durationMs: number
  detail?: string
}

function serpQuery(item: ClaimItemInput): string {
  return [item.name, item.brand, item.model].filter(Boolean).join(' ')
}

// --- SerpAPI engine fetchers ---

async function fetchEbay(item: ClaimItemInput, apiKey: string): Promise<PriceHit | null> {
  const params = new URLSearchParams({
    api_key: apiKey,
    engine: 'ebay',
    _nkw: serpQuery(item),
    LH_Sold: '1',
    LH_Complete: '1',
  })
  const res = await fetch(`https://serpapi.com/search?${params}`)
  if (!res.ok) return null
  const data = await res.json()

  type EbayResult = { price?: { raw?: number }; link?: string }
  const results: EbayResult[] = data.organic_results ?? []
  const priced = results.filter((r) => r.price?.raw != null && r.price.raw > 0)
  if (!priced.length) return null

  const prices = priced.map((r) => r.price!.raw!)
  const price = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
  const sources = priced.map((r) => r.link).filter((u): u is string => !!u).slice(0, 3)

  return { price, sources }
}

async function fetchAmazon(item: ClaimItemInput, apiKey: string): Promise<PriceHit | null> {
  const params = new URLSearchParams({
    api_key: apiKey,
    engine: 'amazon',
    k: serpQuery(item),
    amazon_domain: 'amazon.com',
  })
  const res = await fetch(`https://serpapi.com/search?${params}`)
  if (!res.ok) return null
  const data = await res.json()

  type AmazonResult = { extracted_price?: number; price?: string; link?: string; asin?: string }
  const results: AmazonResult[] = data.organic_results ?? []
  const priced = results.filter((r) => r.extracted_price != null || r.price)
  if (!priced.length) return null

  const prices = priced
    .map((r) => r.extracted_price ?? parseFloat((r.price ?? '').replace(/[^0-9.]/g, '')))
    .filter((p) => !isNaN(p) && p > 0)
  if (!prices.length) return null

  const price = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
  const sources = priced
    .map((r) => r.link ?? (r.asin ? `https://www.amazon.com/dp/${r.asin}` : null))
    .filter((u): u is string => !!u)
    .slice(0, 3)

  return { price, sources }
}

async function fetchWalmart(item: ClaimItemInput, apiKey: string): Promise<PriceHit | null> {
  const params = new URLSearchParams({
    api_key: apiKey,
    engine: 'walmart',
    query: serpQuery(item),
  })
  const res = await fetch(`https://serpapi.com/search?${params}`)
  if (!res.ok) return null
  const data = await res.json()

  type WalmartResult = { primary_price?: number; price?: number; product_page_url?: string }
  const results: WalmartResult[] = data.organic_results ?? []
  const priced = results.filter((r) => r.primary_price != null || r.price != null)
  if (!priced.length) return null

  const prices = priced.map((r) => r.primary_price ?? r.price ?? 0).filter((p) => p > 0)
  if (!prices.length) return null

  const price = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
  const sources = priced.map((r) => r.product_page_url).filter((u): u is string => !!u).slice(0, 3)

  return { price, sources }
}

async function fetchHomeDepot(item: ClaimItemInput, apiKey: string): Promise<PriceHit | null> {
  const params = new URLSearchParams({
    api_key: apiKey,
    engine: 'home_depot',
    q: serpQuery(item),
  })
  const res = await fetch(`https://serpapi.com/search?${params}`)
  if (!res.ok) return null
  const data = await res.json()

  type HomeDepotResult = { price?: number; link?: string }
  const results: HomeDepotResult[] = data.products ?? []
  const priced = results.filter((r) => r.price != null && r.price > 0)
  if (!priced.length) return null

  const prices = priced.map((r) => r.price!)
  const price = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
  const sources = priced.map((r) => r.link).filter((u): u is string => !!u).slice(0, 3)

  return { price, sources }
}

const ENGINE_FETCHERS: Record<SerpEngine, (item: ClaimItemInput, apiKey: string) => Promise<PriceHit | null>> = {
  ebay:       fetchEbay,
  amazon:     fetchAmazon,
  walmart:    fetchWalmart,
  home_depot: fetchHomeDepot,
}

async function lookupSerpEngine(engine: SerpEngine, item: ClaimItemInput): Promise<StepOutcome<PriceHit>> {
  'use step'

  const t0 = performance.now()

  if (!process.env.SERP_API_KEY) {
    return { value: null, durationMs: stepElapsed(t0), detail: 'SERP_API_KEY not configured' }
  }

  try {
    const result = await ENGINE_FETCHERS[engine](item, process.env.SERP_API_KEY)
    const durationMs = stepElapsed(t0)
    log(engine, !!result, durationMs, { item: item.name, price: result?.price })
    return result
      ? { value: result, durationMs, detail: `${result.sources.length} listing${result.sources.length !== 1 ? 's' : ''}` }
      : { value: null, durationMs, detail: 'no results' }
  } catch (err) {
    const durationMs = stepElapsed(t0)
    log(engine, false, durationMs, { item: item.name, error: err instanceof Error ? err.message : String(err) })
    return { value: null, durationMs, detail: err instanceof Error ? err.message : String(err) }
  }
}

// --- Cache write ---

async function cachePrice(item: ClaimItemInput, price: number, sources: string[]) {
  'use step'

  const cacheKey = `price:${item.name}:${item.brand || ''}:${item.condition}`
  const t0 = performance.now()

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
  log('cache_write', true, Math.round(performance.now() - t0), { item: item.name, price })
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

// --- Main workflow ---

export async function priceItemWorkflow(item: ClaimItemInput) {
  'use workflow'

  const workflowTrace: PriceTraceStep[] = []
  const traceKey = item.traceKey

  const engines = CATEGORY_SOURCES[item.category ?? 'other'] ?? CATEGORY_SOURCES.other

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
