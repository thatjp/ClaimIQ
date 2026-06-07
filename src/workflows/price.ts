import { kv } from '@/lib/kv'
import { db } from '@/lib/db'
import { embedItem } from '@/lib/ai/embed'
import { traceStep, type PriceTraceStep } from '@/lib/pricing/trace'
import { updateLiveTrace } from '@/lib/pricing/live-trace'
import type { ClaimItemInput } from '@/lib/workflow'

const EBAY_CATEGORY_MAP: Record<string, string> = {
  electronics: '293',
  appliances:  '20710',
  furniture:   '3197',
  clothing:    '11450',
  jewelry:     '281',
  tools:       '631',
  vehicles:    '6001',
  other:       '',
}

function log(layer: string, hit: boolean, durationMs: number, meta?: Record<string, unknown>) {
  console.log(JSON.stringify({ service: 'price-workflow', layer, hit, durationMs, ...meta }))
}

function stepElapsed(t0: number) {
  return Math.round(performance.now() - t0)
}

interface StepOutcome<T> {
  value: T | null
  durationMs: number
  detail?: string
}

async function lookupEbay(item: ClaimItemInput): Promise<StepOutcome<{ price: number; sources: string[] }>> {
  'use step'

  const t0 = performance.now()

  if (!process.env.EBAY_APP_ID) {
    return { value: null, durationMs: stepElapsed(t0), detail: 'EBAY_APP_ID not configured' }
  }

  const keywords = [item.name, item.brand, item.model].filter(Boolean).join(' ')
  const categoryId = EBAY_CATEGORY_MAP[item.category ?? 'other']

  const params = new URLSearchParams({
    'OPERATION-NAME': 'findCompletedItems',
    'SERVICE-VERSION': '1.0.0',
    'SECURITY-APPNAME': process.env.EBAY_APP_ID,
    'RESPONSE-DATA-FORMAT': 'JSON',
    'keywords': keywords,
    'itemFilter(0).name': 'SoldItemsOnly',
    'itemFilter(0).value': 'true',
    'sortOrder': 'EndTimeSoonest',
    'paginationInput.entriesPerPage': '5',
  })
  if (categoryId) params.set('categoryId', categoryId)

  try {
    const res = await fetch(`https://svcs.ebay.com/services/search/FindingService/v1?${params}`)
    if (!res.ok) {
      const durationMs = stepElapsed(t0)
      log('ebay', false, durationMs, { status: res.status, item: item.name })
      return { value: null, durationMs, detail: `HTTP ${res.status}` }
    }
    const data = await res.json()

    const listings: unknown[] = data.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item ?? []
    if (!listings.length) {
      const durationMs = stepElapsed(t0)
      log('ebay', false, durationMs, { reason: 'no_results', item: item.name })
      return { value: null, durationMs, detail: 'no sold listings' }
    }

    type EbayItem = { sellingStatus: [{ currentPrice: [{ __value__: string }] }]; viewItemURL: [string] }
    const typed = listings as EbayItem[]
    const prices = typed.map((i) => parseFloat(i.sellingStatus[0].currentPrice[0].__value__))
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length
    const sources = typed.map((i) => i.viewItemURL[0])
    const price = Math.round(avg)
    const durationMs = stepElapsed(t0)

    log('ebay', true, durationMs, { item: item.name, listingCount: listings.length, price })
    return { value: { price, sources }, durationMs, detail: `${sources.length} listings` }
  } catch (err) {
    const durationMs = stepElapsed(t0)
    log('ebay', false, durationMs, { error: err instanceof Error ? err.message : String(err) })
    return { value: null, durationMs, detail: err instanceof Error ? err.message : String(err) }
  }
}


async function lookupSerp(item: ClaimItemInput): Promise<StepOutcome<{ price: number; sources: string[] }>> {
  'use step'

  const t0 = performance.now()

  if (!process.env.SERP_API_KEY) {
    return { value: null, durationMs: stepElapsed(t0), detail: 'SERP_API_KEY not configured' }
  }

  const query = [item.name, item.brand, item.model].filter(Boolean).join(' ')

  try {
    const params = new URLSearchParams({
      api_key: process.env.SERP_API_KEY,
      engine: 'google_shopping',
      q: query,
      num: '5',
    })

    const res = await fetch(`https://serpapi.com/search?${params}`)
    if (!res.ok) {
      const durationMs = stepElapsed(t0)
      log('serp', false, durationMs, { status: res.status, item: item.name })
      return { value: null, durationMs, detail: `HTTP ${res.status}` }
    }

    const data = await res.json()
    const results: { price?: string; extracted_price?: number; link?: string; product_link?: string }[] =
      data.shopping_results ?? []

    if (!results.length) {
      const durationMs = stepElapsed(t0)
      log('serp', false, durationMs, { reason: 'no_results', item: item.name })
      return { value: null, durationMs, detail: 'no shopping results' }
    }

    const priced = results.filter((r) => r.extracted_price != null || r.price)
    if (!priced.length) {
      return { value: null, durationMs: stepElapsed(t0), detail: 'no prices in results' }
    }

    const prices = priced.map((r) => r.extracted_price ?? parseFloat(r.price!.replace(/[^0-9.]/g, ''))).filter((p) => !isNaN(p) && p > 0)
    if (!prices.length) {
      return { value: null, durationMs: stepElapsed(t0), detail: 'could not parse prices' }
    }

    const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
    const sources = priced.map((r) => r.product_link ?? r.link).filter((u): u is string => !!u).slice(0, 3)
    const durationMs = stepElapsed(t0)

    log('serp', true, durationMs, { item: item.name, resultCount: priced.length, avg })
    return { value: { price: avg, sources }, durationMs, detail: `${priced.length} listings` }
  } catch (err) {
    const durationMs = stepElapsed(t0)
    log('serp', false, durationMs, { error: err instanceof Error ? err.message : String(err) })
    return { value: null, durationMs, detail: err instanceof Error ? err.message : String(err) }
  }
}

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

export async function priceItemWorkflow(item: ClaimItemInput) {
  'use workflow'

  const workflowTrace: PriceTraceStep[] = []
  const traceKey = item.traceKey

  // eBay — free, no tokens
  await publishLiveTrace(traceKey, [...workflowTrace, traceStep('ebay', 'running')])
  const ebayResult = await lookupEbay(item)
  workflowTrace.push(traceStep('ebay', ebayResult.value ? 'hit' : 'miss', ebayResult.durationMs, ebayResult.detail))
  await publishLiveTrace(traceKey, workflowTrace)

  if (ebayResult.value) {
    await cachePrice(item, ebayResult.value.price, ebayResult.value.sources)
    return { price: ebayResult.value.price, sources: ebayResult.value.sources, source: 'ebay' as const, trace: workflowTrace }
  }

  // SerpAPI — Google Shopping, ~$0.001/call
  await publishLiveTrace(traceKey, [...workflowTrace, traceStep('serp', 'running')])
  const serpResult = await lookupSerp(item)
  workflowTrace.push(traceStep('serp', serpResult.value ? 'hit' : 'miss', serpResult.durationMs, serpResult.detail))
  await publishLiveTrace(traceKey, workflowTrace)

  if (serpResult.value) {
    await cachePrice(item, serpResult.value.price, serpResult.value.sources)
    return { price: serpResult.value.price, sources: serpResult.value.sources, source: 'serp' as const, trace: workflowTrace }
  }

  return { price: null, sources: [], source: 'not_found' as const, trace: workflowTrace }
}
