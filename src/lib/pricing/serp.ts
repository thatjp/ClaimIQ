import type { ClaimItemInput } from '@/lib/workflow'

export type SerpEngine = 'ebay' | 'amazon' | 'walmart' | 'home_depot'

export type PriceHit = { price: number; sources: string[] }

export interface MarketplaceListing {
  title: string
  price: number
  url: string
}

export interface MarketplaceSearchResult {
  engine: SerpEngine
  listings: MarketplaceListing[]
  averagePrice: number | null
}

export const CATEGORY_SOURCES: Record<string, SerpEngine[]> = {
  electronics: ['ebay', 'amazon', 'walmart'],
  appliances: ['home_depot', 'amazon', 'walmart'],
  furniture: ['ebay', 'amazon', 'walmart'],
  clothing: ['amazon', 'walmart'],
  jewelry: ['ebay', 'amazon'],
  tools: ['home_depot', 'amazon', 'walmart'],
  other: ['ebay', 'amazon', 'walmart'],
}

export function getEnginesForCategory(category?: string): SerpEngine[] {
  return CATEGORY_SOURCES[category ?? 'other'] ?? CATEGORY_SOURCES.other
}

export function serpQuery(item: Pick<ClaimItemInput, 'name' | 'brand' | 'model'>): string {
  return [item.name, item.brand, item.model].filter(Boolean).join(' ')
}

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

  type EbayResult = { title?: string; price?: { raw?: number }; link?: string }
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

  type AmazonResult = { title?: string; extracted_price?: number; price?: string; link?: string; asin?: string }
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

  type WalmartResult = { title?: string; primary_price?: number; price?: number; product_page_url?: string }
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

  type HomeDepotResult = { title?: string; price?: number; link?: string }
  const results: HomeDepotResult[] = data.products ?? []
  const priced = results.filter((r) => r.price != null && r.price > 0)
  if (!priced.length) return null

  const prices = priced.map((r) => r.price!)
  const price = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
  const sources = priced.map((r) => r.link).filter((u): u is string => !!u).slice(0, 3)

  return { price, sources }
}

const ENGINE_FETCHERS: Record<SerpEngine, (item: ClaimItemInput, apiKey: string) => Promise<PriceHit | null>> = {
  ebay: fetchEbay,
  amazon: fetchAmazon,
  walmart: fetchWalmart,
  home_depot: fetchHomeDepot,
}

export interface SerpStepOutcome {
  value: PriceHit | null
  durationMs: number
  detail?: string
}

export async function fetchSerpPrice(engine: SerpEngine, item: ClaimItemInput): Promise<SerpStepOutcome> {
  const t0 = performance.now()

  if (!process.env.SERP_API_KEY) {
    return { value: null, durationMs: Math.round(performance.now() - t0), detail: 'SERP_API_KEY not configured' }
  }

  try {
    const result = await ENGINE_FETCHERS[engine](item, process.env.SERP_API_KEY)
    const durationMs = Math.round(performance.now() - t0)
    return result
      ? { value: result, durationMs, detail: `${result.sources.length} listing${result.sources.length !== 1 ? 's' : ''}` }
      : { value: null, durationMs, detail: 'no results' }
  } catch (err) {
    return {
      value: null,
      durationMs: Math.round(performance.now() - t0),
      detail: err instanceof Error ? err.message : String(err),
    }
  }
}

/** Resolver-facing search: one engine, returns listing details for the model. */
export async function searchMarketplaceListings(
  item: Pick<ClaimItemInput, 'name' | 'brand' | 'model' | 'category' | 'condition'>,
  engine?: SerpEngine
): Promise<MarketplaceSearchResult> {
  const resolvedEngine = engine ?? getEnginesForCategory(item.category)[0]
  const outcome = await fetchSerpPrice(resolvedEngine, item as ClaimItemInput)

  if (!outcome.value) {
    return { engine: resolvedEngine, listings: [], averagePrice: null }
  }

  const listings: MarketplaceListing[] = outcome.value.sources.map((url, i) => ({
    title: `${item.name} (listing ${i + 1})`,
    price: outcome.value!.price,
    url,
  }))

  return {
    engine: resolvedEngine,
    listings,
    averagePrice: outcome.value.price,
  }
}
