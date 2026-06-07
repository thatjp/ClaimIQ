import { generateText, Output, stepCountIs } from 'ai'
import { z } from 'zod'
import { kv } from '@/lib/kv'
import { db } from '@/lib/db'
import { embedItem } from '@/lib/ai/embed'
import { MODELS, anthropic } from '@/lib/ai/models'
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

async function lookupAmazon(item: ClaimItemInput): Promise<StepOutcome<{ price: number; sources: string[] }>> {
  'use step'

  const schema = z.object({
    price: z.number().describe('Current retail replacement cost in USD on Amazon'),
    sources: z
      .array(z.string().url())
      .min(1)
      .describe('Amazon product listing URLs (amazon.com) where this item can be purchased'),
  })

  const t0 = performance.now()
  try {
    const { experimental_output } = await generateText({
      model: MODELS.priceSearch,
      experimental_output: Output.object({ schema }),
      tools: { webSearch: anthropic.tools.webSearch_20260209({ maxUses: 4 }) },
      stopWhen: stepCountIs(4),
      prompt: `You are an insurance pricing assistant. Search Amazon (amazon.com) for the current retail replacement cost of this item.

Item: ${item.name}
Brand: ${item.brand || 'unknown'}
Model: ${item.model || 'unknown'}
Condition: ${item.condition}
Estimated age: ${item.estimatedAge ? `${item.estimatedAge} years` : 'unknown'}
Category: ${item.category || 'unknown'}

Search ONLY on amazon.com — find the closest matching new or like-new retail listing.
Return the price in USD and at least one amazon.com product URL from your search results.
Do NOT estimate — only return a price you found on Amazon.`,
    })

    const durationMs = stepElapsed(t0)
    const sources = (experimental_output?.sources ?? []).filter((url) => url.includes('amazon.com'))
    const hit = !!experimental_output?.price && sources.length > 0

    log('amazon', hit, durationMs, { item: item.name, price: experimental_output?.price })

    if (!hit) {
      return {
        value: null,
        durationMs,
        detail: sources.length ? 'no price on Amazon' : 'no Amazon listings',
      }
    }

    return {
      value: { price: experimental_output!.price, sources },
      durationMs,
      detail: `${sources.length} listing${sources.length === 1 ? '' : 's'}`,
    }
  } catch (err) {
    const durationMs = stepElapsed(t0)
    log('amazon', false, durationMs, { item: item.name, error: err instanceof Error ? err.message : String(err) })
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

async function publishLiveTrace(traceKey: string | undefined, workflowTrace: PriceTraceStep[]) {
  'use step'

  if (!traceKey) return
  try {
    await updateLiveTrace(traceKey, { workflowTrace })
  } catch (err) {
    console.warn('[price-workflow] live trace update failed:', err instanceof Error ? err.message : err)
  }
}

export async function priceItemWorkflow(item: ClaimItemInput) {
  'use workflow'

  const workflowTrace: PriceTraceStep[] = []
  const traceKey = item.traceKey

  // Layer 3a: eBay sold listings
  const ebay = await lookupEbay(item)
  if (ebay.value) {
    workflowTrace.push(traceStep('ebay', 'hit', ebay.durationMs, ebay.detail))
    await publishLiveTrace(traceKey, workflowTrace)
    await cachePrice(item, ebay.value.price, ebay.value.sources)
    return { price: ebay.value.price, sources: ebay.value.sources, source: 'ebay' as const, trace: workflowTrace }
  }
  workflowTrace.push(traceStep('ebay', 'miss', ebay.durationMs, ebay.detail))
  await publishLiveTrace(traceKey, workflowTrace)

  // Layer 3b: Amazon retail search via AI SDK web search tool
  const amazon = await lookupAmazon(item)
  if (amazon.value) {
    workflowTrace.push(traceStep('amazon', 'hit', amazon.durationMs, amazon.detail))
    await publishLiveTrace(traceKey, workflowTrace)
    await cachePrice(item, amazon.value.price, amazon.value.sources)
    return { price: amazon.value.price, sources: amazon.value.sources, source: 'amazon' as const, trace: workflowTrace }
  }
  workflowTrace.push(traceStep('amazon', 'miss', amazon.durationMs, amazon.detail))
  await publishLiveTrace(traceKey, workflowTrace)

  return { price: null, sources: [], source: null, trace: workflowTrace }
}
