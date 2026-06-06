import { generateText, Output, stepCountIs } from 'ai'
import { z } from 'zod'
import { kv } from '@/lib/kv'
import { db } from '@/lib/db'
import { embedItem } from '@/lib/ai/embed'
import { MODELS, anthropic } from '@/lib/ai/models'
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

interface EbayResult {
  price: number
  sources: string[]
}

async function lookupEbay(item: ClaimItemInput): Promise<EbayResult | null> {
  'use step'

  if (!process.env.EBAY_APP_ID) return null

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
    if (!res.ok) return null
    const data = await res.json()

    const listings: unknown[] = data.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item ?? []
    if (!listings.length) return null

    type EbayItem = { sellingStatus: [{ currentPrice: [{ __value__: string }] }]; viewItemURL: [string] }
    const typed = listings as EbayItem[]
    const prices = typed.map((i) => parseFloat(i.sellingStatus[0].currentPrice[0].__value__))
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length
    const sources = typed.map((i) => i.viewItemURL[0])

    return { price: Math.round(avg), sources }
  } catch {
    return null
  }
}

async function lookupPrice(item: ClaimItemInput) {
  'use step'

  const preferred = PREFERRED_SOURCES[item.category ?? 'other'] ?? PREFERRED_SOURCES.other

  const schema = z.object({
    price: z.number().describe('Current retail replacement cost in USD'),
    sources: z.array(z.string().url()).min(1).describe('URLs of retailer listings where this item can be purchased — must include at least one'),
  })

  const { experimental_output } = await generateText({
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

  return experimental_output
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

  // Layer 3a: eBay sold listings (structured API, actual market prices)
  const ebay = await lookupEbay(item)
  if (ebay) {
    await cachePrice(item, ebay.price, ebay.sources)
    return { price: ebay.price, sources: ebay.sources, source: 'ebay' }
  }

  // Layer 3b: Anthropic web search fallback
  const result = await lookupPrice(item)
  if (!result) throw new Error('Price lookup returned no output')
  await cachePrice(item, result.price, result.sources)

  return { price: result.price, sources: result.sources, source: 'web_search' }
}
