import type { EvalStatus, PricingParseFixture, PricingParseResult } from '@/lib/evals/types'

// Mirrors the parsing logic in src/workflows/price.ts — must stay in sync.

type PriceHit = { price: number; sources: string[] }

function parseAmazon(data: unknown): PriceHit | null {
  type R = { extracted_price?: number; price?: string; link?: string; asin?: string }
  const results: R[] = (data as Record<string, unknown>)?.organic_results as R[] ?? []
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

function parseWalmart(data: unknown): PriceHit | null {
  type R = { primary_price?: number; price?: number; product_page_url?: string }
  const results: R[] = (data as Record<string, unknown>)?.organic_results as R[] ?? []
  const priced = results.filter((r) => r.primary_price != null || r.price != null)
  if (!priced.length) return null

  const prices = priced.map((r) => r.primary_price ?? r.price ?? 0).filter((p) => p > 0)
  if (!prices.length) return null

  const price = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
  const sources = priced.map((r) => r.product_page_url).filter((u): u is string => !!u).slice(0, 3)

  return { price, sources }
}

function parseEbay(data: unknown): PriceHit | null {
  type R = { price?: { raw?: number }; link?: string }
  const results: R[] = (data as Record<string, unknown>)?.organic_results as R[] ?? []
  const priced = results.filter((r) => r.price?.raw != null && r.price.raw > 0)
  if (!priced.length) return null

  const prices = priced.map((r) => r.price!.raw!)
  const price = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
  const sources = priced.map((r) => r.link).filter((u): u is string => !!u).slice(0, 3)

  return { price, sources }
}

function parseHomeDepot(data: unknown): PriceHit | null {
  type R = { price?: number; link?: string }
  const results: R[] = (data as Record<string, unknown>)?.products as R[] ?? []
  const priced = results.filter((r) => r.price != null && r.price > 0)
  if (!priced.length) return null

  const prices = priced.map((r) => r.price!)
  const price = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
  const sources = priced.map((r) => r.link).filter((u): u is string => !!u).slice(0, 3)

  return { price, sources }
}

const PARSERS: Record<string, (data: unknown) => PriceHit | null> = {
  amazon:     parseAmazon,
  walmart:    parseWalmart,
  home_depot: parseHomeDepot,
  ebay:       parseEbay,
}

export function scorePricingParse(fixture: PricingParseFixture, durationMs: number): PricingParseResult {
  const failures: string[] = []
  let price: number | null = null
  let sourceCount: number | null = null

  try {
    const parser = PARSERS[fixture.source]
    if (!parser) {
      failures.push(`No parser registered for source "${fixture.source}"`)
    } else {
      const result = parser(fixture.input)
      const hit = result !== null
      price = result?.price ?? null
      sourceCount = result?.sources.length ?? null

      if (hit !== fixture.expected.hit) {
        failures.push(`Expected hit=${fixture.expected.hit} but got hit=${hit}`)
      }

      if (fixture.expected.hit && fixture.expected.price != null) {
        if (price === null) {
          failures.push('Expected a price but got null')
        } else {
          const delta = Math.abs(price - fixture.expected.price)
          if (delta > 1) {
            failures.push(`Expected price ~${fixture.expected.price}, got ${price} (delta ${delta})`)
          }
        }
      }

      if (fixture.expected.hit && fixture.expected.sourceCount != null) {
        if (sourceCount !== fixture.expected.sourceCount) {
          failures.push(`Expected ${fixture.expected.sourceCount} sources, got ${sourceCount ?? 0}`)
        }
      }
    }
  } catch (err) {
    failures.push(`Parser threw: ${err instanceof Error ? err.message : String(err)}`)
  }

  const status: EvalStatus = failures.length === 0 ? 'pass' : 'fail'

  return {
    id: fixture.id,
    source: fixture.source,
    status,
    price,
    sourceCount,
    expected: fixture.expected,
    failures,
    notes: fixture.notes ?? fixture.description,
    durationMs,
  }
}

export function summarizePricing(results: PricingParseResult[]) {
  return {
    total: results.length,
    passed: results.filter((r) => r.status === 'pass').length,
    failed: results.filter((r) => r.status === 'fail').length,
    errors: results.filter((r) => r.status === 'error').length,
    passRate: results.length ? results.filter((r) => r.status === 'pass').length / results.length : 0,
    results,
  }
}
