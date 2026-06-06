export type EvalStatus = 'pass' | 'partial' | 'fail' | 'error'

export interface MustIncludeRule {
  nameContains: string
  category?: string
  brand?: string
}

export interface ExtractionFixture {
  id: string
  input: string
  expected: {
    minItems: number
    maxItems: number
    mustInclude?: MustIncludeRule[]
    mustNotInclude?: string[]
  }
  notes?: string
}

export interface ExtractionEvalResult {
  id: string
  status: EvalStatus
  itemCount: number
  extractedNames: string[]
  failures: string[]
  notes?: string
  durationMs: number
}

export interface PricingEstimateFixture {
  id: string
  item: {
    name: string
    brand?: string
    model?: string
    condition: string
    estimatedAge?: number
    category?: string
  }
  acceptableRange: [number, number]
  notes?: string
}

export interface PricingEvalResult {
  id: string
  status: EvalStatus
  price: number | null
  acceptableRange: [number, number]
  failures: string[]
  notes?: string
  durationMs: number
}

export interface EvalRunReport {
  runAt: string
  extraction: {
    total: number
    passed: number
    partial: number
    failed: number
    errors: number
    hallucinationCount: number
    missCount: number
    passRate: number
    results: ExtractionEvalResult[]
  }
  pricing: {
    total: number
    passed: number
    failed: number
    errors: number
    passRate: number
    results: PricingEvalResult[]
  }
}

export interface EvalProgress {
  phase: 'extraction' | 'pricing'
  current: number
  total: number
  fixtureId: string
}

export interface RunEvalsOptions {
  extractionOnly?: boolean
  pricingOnly?: boolean
  onProgress?: (progress: EvalProgress) => void
}
