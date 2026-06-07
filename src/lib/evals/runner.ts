import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { generateObject } from 'ai'
import { z } from 'zod'
import { extractItems } from '@/lib/ai/extraction'
import { MODELS, gatewayProviderOptions } from '@/lib/ai/models'
import extractionFixtures from '@/lib/evals/fixtures/extraction.json'
import pricingFixtures from '@/lib/evals/fixtures/pricing-estimate.json'
import { scoreExtraction, summarizeExtraction } from '@/lib/evals/scorers/extraction'
import { scorePricingEstimate, summarizePricing } from '@/lib/evals/scorers/pricing'
import type {
  EvalRunReport,
  ExtractionEvalResult,
  ExtractionFixture,
  PricingEstimateFixture,
  PricingEvalResult,
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

async function runPricingEvals(
  fixtures: PricingEstimateFixture[],
  onProgress?: RunEvalsOptions['onProgress']
): Promise<PricingEvalResult[]> {
  const results: PricingEvalResult[] = []

  for (let i = 0; i < fixtures.length; i++) {
    if (i > 0) await delay(DELAY_MS)
    const fixture = fixtures[i]
    onProgress?.({ phase: 'pricing', current: i + 1, total: fixtures.length, fixtureId: fixture.id })

    const t0 = performance.now()
    try {
      const { object } = await generateObject({
        model: MODELS.priceNorm,
        providerOptions: gatewayProviderOptions,
        schema: z.object({ price: z.number() }),
        prompt: `Estimate the current retail replacement cost in USD for: ${fixture.item.name} (${fixture.item.brand ?? 'unknown brand'}, ${fixture.item.condition} condition). Be conservative.`,
      })
      const price = object.price
      results.push(scorePricingEstimate(fixture, price, Math.round(performance.now() - t0)))
    } catch (err) {
      results.push(
        scorePricingEstimate(
          fixture,
          null,
          Math.round(performance.now() - t0),
          err instanceof Error ? err.message : String(err)
        )
      )
    }
  }

  return results
}

export async function runEvals(options: RunEvalsOptions = {}): Promise<EvalRunReport> {
  if (!process.env.AI_GATEWAY_API_KEY) {
    throw new Error('AI_GATEWAY_API_KEY is required')
  }

  const { extractionOnly, pricingOnly, onProgress } = options

  let extractionResults: ExtractionEvalResult[] = []
  let pricingResults: PricingEvalResult[] = []

  if (!pricingOnly) {
    extractionResults = await runExtractionEvals(
      extractionFixtures as ExtractionFixture[],
      onProgress
    )
  }

  if (!extractionOnly) {
    pricingResults = await runPricingEvals(
      pricingFixtures as PricingEstimateFixture[],
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
