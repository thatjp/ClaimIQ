import type { EvalStatus, PricingParseFixture, PricingParseResult } from '@/lib/evals/types'

// Mirror the parsing logic from price.ts so the eval tests the real behaviour.
// Must stay in sync with parseSerpResults in src/workflows/price.ts.

function parseSerpResponse(data: unknown): { price: number; sources: string[] } | null {
  const results: { price?: string; extracted_price?: number; link?: string; product_link?: string }[] =
    (data as Record<string, unknown>)?.shopping_results as typeof results ?? []

  if (!results.length) return null

  const priced = results.filter((r) => r.extracted_price != null || r.price)
  if (!priced.length) return null

  const prices = priced
    .map((r) => r.extracted_price ?? parseFloat(r.price!.replace(/[^0-9.]/g, '')))
    .filter((p) => !isNaN(p) && p > 0)

  if (!prices.length) return null

  const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
  const sources = priced.map((r) => r.product_link ?? r.link).filter((u): u is string => !!u).slice(0, 3)
  return { price: avg, sources }
}

export function scorePricingParse(fixture: PricingParseFixture, durationMs: number): PricingParseResult {
  const failures: string[] = []
  let price: number | null = null
  let sourceCount: number | null = null

  try {
    const result = parseSerpResponse(fixture.input)

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
