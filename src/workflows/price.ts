import { generateText, Output, stepCountIs } from 'ai'
import { z } from 'zod'
import { kv } from '@/lib/kv'
import { db } from '@/lib/db'
import { embedItem } from '@/lib/ai/embed'
import { estimateItemPrice } from '@/lib/ai/pricing-estimate'
import { MODELS, anthropic } from '@/lib/ai/models'
import { traceStep, type PriceTraceStep } from '@/lib/pricing/trace'
import type { ClaimItemInput } from '@/lib/workflow'

const PREFERRED_SOURCES: Record<string, string[]> = {
  electronics:  ['bestbuy.com', 'amazon.com', 'bhphotovideo.com', 'newegg.com'],
  appliances:   ['homedepot.com', 'lowes.com', 'bestbuy.com', 'appliancesconnection.com'],
  furniture:    ['wayfair.com', 'ikea.com', 'amazon.com', 'ashleyfurniture.com'],
  clothing:     ['nordstrom.com', 'amazon.com', 'zappos.com', 'macys.com'],
  jewelry:      ['jared.com', 'kay.com', 'bluenile.com', 'tiffany.com'],
  tools:        ['homedepot.com', 'lowes.com', 'amazon.com', 'acmetools.com'],
  vehicles:     ['kbb.com', 'edmunds.com', 'ebay.com/motors', 'autotrader.com'],
  other:        ['amazon.com', 'walmart.com', 'target.com'],
}

// eBay category IDs for Finding API
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

interface EbayResult {
  price: number
  sources: string[]
}

interface WebSearchResult {
  price: number
  sources: string[]
  source: 'web_search'
}

async function lookupEbay(item: ClaimItemInput): Promise<StepOutcome<EbayResult>> {
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

    log('ebay', true, durationMs, {
      item: item.name,
      category: item.category,
      listingCount: listings.length,
      priceMin: Math.min(...prices),
      priceMax: Math.max(...prices),
      priceAvg: price,
    })

    return { value: { price, sources }, durationMs, detail: `${sources.length} listings` }
  } catch (err) {
    const durationMs = stepElapsed(t0)
    log('ebay', false, durationMs, { error: err instanceof Error ? err.message : String(err) })
    return { value: null, durationMs, detail: err instanceof Error ? err.message : String(err) }
  }
}

async function lookupPrice(item: ClaimItemInput): Promise<StepOutcome<WebSearchResult>> {
  'use step'

  const preferred = PREFERRED_SOURCES[item.category ?? 'other'] ?? PREFERRED_SOURCES.other

  const schema = z.object({
    price: z.number().describe('Current retail replacement cost in USD'),
    sources: z.array(z.string().url()).min(1).describe('URLs of retailer listings where this item can be purchased — must include at least one'),
  })

  const t0 = performance.now()
  try {
    const { experimental_output, steps } = await generateText({
      model: MODELS.priceSearch,
      experimental_output: Output.object({ schema }),
      tools: { webSearch: anthropic.tools.webSearch_20260209({ maxUses: 5 }) },
      stopWhen: stepCountIs(5),
      prompt: `You are an insurance pricing assistant. Search for the current retail replacement cost of this item.

Item: ${item.name}
Brand: ${item.brand || 'unknown'}
Model: ${item.model || 'unknown'}
Condition: ${item.condition}
Estimated age: ${item.estimatedAge ? `${item.estimatedAge} years` : 'unknown'}
Category: ${item.category || 'unknown'}

Preferred sources for this category: ${preferred.join(', ')}.
Search these sites first — they provide the most accurate pricing for this item type.
Fall back to other retailers only if the item is not found on the preferred sites.
You MUST return at least one source URL from your actual search results — do not estimate without searching first.`,
    })

    const durationMs = stepElapsed(t0)
    const hit = !!experimental_output?.price

    log('web_search', hit, durationMs, {
      item: item.name,
      category: item.category,
      searchSteps: steps.length,
      price: experimental_output?.price,
    })

    if (!hit) {
      return { value: null, durationMs, detail: 'no price found' }
    }

    return {
      value: { ...experimental_output!, source: 'web_search' as const },
      durationMs,
    }
  } catch (err) {
    const durationMs = stepElapsed(t0)
    log('web_search', false, durationMs, {
      item: item.name,
      error: err instanceof Error ? err.message : String(err),
      fallback: 'estimation',
    })
    return { value: null, durationMs, detail: err instanceof Error ? err.message : String(err) }
  }
}

async function estimatePrice(item: ClaimItemInput): Promise<StepOutcome<{ price: number }>> {
  'use step'

  const t0 = performance.now()
  const price = await estimateItemPrice(item)
  const durationMs = stepElapsed(t0)

  log('estimation', !!price, durationMs, {
    item: item.name,
    category: item.category,
    price,
  })

  return { value: { price }, durationMs, detail: 'fallback estimate' }
}

async function cachePrice(item: ClaimItemInput, price: number, sources: string[]) {
  'use step'

  const cacheKey = `price:${item.name}:${item.brand || ''}:${item.condition}`
  const cached_at = new Date().toISOString()

  const t0 = performance.now()
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
  log('cache_write', true, stepElapsed(t0), { item: item.name, price })
}

export async function priceItemWorkflow(item: ClaimItemInput) {
  'use workflow'

  const workflowTrace: PriceTraceStep[] = []

  // Layer 3a: eBay sold listings (structured API, actual market prices)
  const ebay = await lookupEbay(item)
  if (ebay.value) {
    workflowTrace.push(traceStep('ebay', 'hit', ebay.durationMs, ebay.detail))
    await cachePrice(item, ebay.value.price, ebay.value.sources)
    return { price: ebay.value.price, sources: ebay.value.sources, source: 'ebay' as const, trace: workflowTrace }
  }
  workflowTrace.push(traceStep('ebay', 'miss', ebay.durationMs, ebay.detail))

  // Layer 3b: Anthropic web search (with AI Gateway model fallback)
  const webResult = await lookupPrice(item)
  if (webResult.value) {
    workflowTrace.push(traceStep('web_search', 'hit', webResult.durationMs, webResult.detail))
    await cachePrice(item, webResult.value.price, webResult.value.sources)
    return {
      price: webResult.value.price,
      sources: webResult.value.sources,
      source: 'web_search' as const,
      trace: workflowTrace,
    }
  }
  workflowTrace.push(traceStep('web_search', 'miss', webResult.durationMs, webResult.detail))

  // Layer 3c: AI estimation — no live data available, model reasons from training knowledge
  const estimate = await estimatePrice(item)
  workflowTrace.push(traceStep('estimated', 'hit', estimate.durationMs, estimate.detail))
  return { price: estimate.value!.price, sources: [], source: 'estimated' as const, trace: workflowTrace }
}
