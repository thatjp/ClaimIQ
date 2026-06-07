export type EvalStatus = 'pass' | 'partial' | 'fail' | 'error'

// ── Extraction ────────────────────────────────────────────────────────────────

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

// ── Pricing parse (no LLM — tests SerpAPI response parsing) ──────────────────

export interface PricingParseFixture {
  id: string
  source: 'amazon' | 'walmart' | 'home_depot' | 'ebay'
  description: string
  input: unknown
  expected: {
    hit: boolean
    price?: number | null
    sourceCount?: number
    notes?: string
  }
  notes?: string
}

export interface PricingParseResult {
  id: string
  source: 'amazon' | 'walmart' | 'home_depot' | 'ebay'
  status: EvalStatus
  price: number | null
  sourceCount: number | null
  expected: PricingParseFixture['expected']
  failures: string[]
  notes?: string
  durationMs: number
}

// ── Report ────────────────────────────────────────────────────────────────────

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
    results: PricingParseResult[]
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
