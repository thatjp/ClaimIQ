import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { extractItems } from '@/lib/ai/extraction'
import extractionFixtures from '@/lib/evals/fixtures/extraction.json'
import pricingFixtures from '@/lib/evals/fixtures/pricing-parse.json'
import { scoreExtraction, summarizeExtraction } from '@/lib/evals/scorers/extraction'
import { scorePricingParse, summarizePricing } from '@/lib/evals/scorers/pricing'
import type {
  EvalRunReport,
  ExtractionEvalResult,
  ExtractionFixture,
  PricingParseFixture,
  PricingParseResult,
  RunEvalsOptions,
} from '@/lib/evals/types'

const DELAY_MS = 100
const PASS_THRESHOLD = 0.75
const RESULTS_DIR = resolve(process.cwd(), 'evals/results')

let latestReport: EvalRunReport | null = null

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export function getLatestEvalReport(): EvalRunReport | null {
  return latestReport
}

function persistReport(report: EvalRunReport) {
  latestReport = report
  try {
    mkdirSync(RESULTS_DIR, { recursive: true })
    writeFileSync(resolve(RESULTS_DIR, 'latest.json'), JSON.stringify(report, null, 2))
  } catch {
    // Ephemeral filesystem on serverless — in-memory copy is sufficient
  }
}

async function runExtractionEvals(
  fixtures: ExtractionFixture[],
  onProgress?: RunEvalsOptions['onProgress']
): Promise<ExtractionEvalResult[]> {
  const results: ExtractionEvalResult[] = []

  for (let i = 0; i < fixtures.length; i++) {
    if (i > 0) await delay(DELAY_MS)
    const fixture = fixtures[i]
    onProgress?.({ phase: 'extraction', current: i + 1, total: fixtures.length, fixtureId: fixture.id })

    const t0 = performance.now()
    try {
      const output = await extractItems(fixture.input)
      results.push(scoreExtraction(fixture, output, Math.round(performance.now() - t0)))
    } catch (err) {
      results.push({
        id: fixture.id,
        status: 'error',
        itemCount: 0,
        extractedNames: [],
        failures: [err instanceof Error ? err.message : String(err)],
        notes: fixture.notes,
        durationMs: Math.round(performance.now() - t0),
      })
    }
  }

  return results
}

// Pricing evals are pure parse tests — no network, no tokens.
function runPricingEvals(
  fixtures: PricingParseFixture[],
  onProgress?: RunEvalsOptions['onProgress']
): PricingParseResult[] {
  return fixtures.map((fixture, i) => {
    onProgress?.({ phase: 'pricing', current: i + 1, total: fixtures.length, fixtureId: fixture.id })
    const t0 = performance.now()
    return scorePricingParse(fixture, Math.round(performance.now() - t0))
  })
}

export async function runEvals(options: RunEvalsOptions = {}): Promise<EvalRunReport> {
  const { extractionOnly, pricingOnly, onProgress } = options

  // Extraction requires the AI gateway; pricing parse does not.
  if (!pricingOnly && !process.env.AI_GATEWAY_API_KEY) {
    throw new Error('AI_GATEWAY_API_KEY is required for extraction evals')
  }

  let extractionResults: ExtractionEvalResult[] = []
  let pricingResults: PricingParseResult[] = []

  if (!pricingOnly) {
    extractionResults = await runExtractionEvals(
      extractionFixtures as ExtractionFixture[],
      onProgress
    )
  }

  if (!extractionOnly) {
    pricingResults = runPricingEvals(
      pricingFixtures as PricingParseFixture[],
      onProgress
    )
  }

  const report: EvalRunReport = {
    runAt: new Date().toISOString(),
    extraction: summarizeExtraction(extractionResults),
    pricing: summarizePricing(pricingResults),
  }

  persistReport(report)
  return report
}

export function evalsPassed(report: EvalRunReport, options: RunEvalsOptions = {}): boolean {
  const extractionOk = options.pricingOnly || report.extraction.passRate >= PASS_THRESHOLD
  const pricingOk = options.extractionOnly || report.pricing.passRate >= PASS_THRESHOLD
  return extractionOk && pricingOk
}
