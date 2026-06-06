import type { EvalStatus, PricingEvalResult, PricingEstimateFixture } from '@/lib/evals/types'

export function scorePricingEstimate(
  fixture: PricingEstimateFixture,
  price: number | null,
  durationMs: number,
  error?: string
): PricingEvalResult {
  const [min, max] = fixture.acceptableRange
  const failures: string[] = []

  if (error) {
    return {
      id: fixture.id,
      status: 'error',
      price: null,
      acceptableRange: fixture.acceptableRange,
      failures: [error],
      notes: fixture.notes,
      durationMs,
    }
  }

  if (price === null || Number.isNaN(price)) {
    failures.push('No price returned')
  } else if (price < min) {
    failures.push(`Price $${price} below minimum $${min}`)
  } else if (price > max) {
    failures.push(`Price $${price} above maximum $${max}`)
  }

  const status: EvalStatus = failures.length === 0 ? 'pass' : 'fail'

  return {
    id: fixture.id,
    status,
    price,
    acceptableRange: fixture.acceptableRange,
    failures,
    notes: fixture.notes,
    durationMs,
  }
}

export function summarizePricing(results: PricingEvalResult[]) {
  return {
    total: results.length,
    passed: results.filter((r) => r.status === 'pass').length,
    failed: results.filter((r) => r.status === 'fail').length,
    errors: results.filter((r) => r.status === 'error').length,
    passRate: results.length ? results.filter((r) => r.status === 'pass').length / results.length : 0,
    results,
  }
}
