import type { ExtractedItems } from '@/lib/ai/extraction'
import type { EvalStatus, ExtractionEvalResult, ExtractionFixture, MustIncludeRule } from '@/lib/evals/types'

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
}

function itemText(item: ExtractedItems['items'][number]) {
  return normalize([item.name, item.brand, item.model].filter(Boolean).join(' '))
}

function matchesRule(items: ExtractedItems['items'], rule: MustIncludeRule) {
  const needle = normalize(rule.nameContains)
  return items.some((item) => {
    const haystack = itemText(item)
    if (!haystack.includes(needle)) return false
    if (rule.category && item.category !== rule.category) return false
    if (rule.brand && !normalize(item.brand ?? '').includes(normalize(rule.brand))) return false
    return true
  })
}

function containsForbidden(items: ExtractedItems['items'], forbidden: string) {
  const needle = normalize(forbidden)
  return items.some((item) => itemText(item).includes(needle))
}

export function scoreExtraction(
  fixture: ExtractionFixture,
  output: ExtractedItems,
  durationMs: number
): ExtractionEvalResult {
  const items = output.items
  const failures: string[] = []
  let hallucinationCount = 0
  let missCount = 0

  if (items.length < fixture.expected.minItems) {
    failures.push(`Expected at least ${fixture.expected.minItems} items, got ${items.length}`)
    missCount++
  }
  if (items.length > fixture.expected.maxItems) {
    failures.push(`Expected at most ${fixture.expected.maxItems} items, got ${items.length}`)
    hallucinationCount++
  }

  for (const rule of fixture.expected.mustInclude ?? []) {
    if (!matchesRule(items, rule)) {
      failures.push(`Missing required item matching: ${JSON.stringify(rule)}`)
      missCount++
    }
  }

  for (const forbidden of fixture.expected.mustNotInclude ?? []) {
    if (containsForbidden(items, forbidden)) {
      failures.push(`Hallucinated or forbidden item containing: "${forbidden}"`)
      hallucinationCount++
    }
  }

  const wrongCategories = (fixture.expected.mustInclude ?? []).filter(
    (rule) => rule.category && items.some((item) => itemText(item).includes(normalize(rule.nameContains)) && item.category !== rule.category)
  )

  let status: EvalStatus = 'pass'
  if (failures.length > 0) {
    status = wrongCategories.length === 1 && hallucinationCount === 0 && missCount === 0 ? 'partial' : 'fail'
    if (hallucinationCount > 0 || missCount > 0 || items.length < fixture.expected.minItems || items.length > fixture.expected.maxItems) {
      status = 'fail'
    }
  }

  return {
    id: fixture.id,
    status,
    itemCount: items.length,
    extractedNames: items.map((i) => i.name),
    failures,
    notes: fixture.notes,
    durationMs,
  }
}

export function summarizeExtraction(results: ExtractionEvalResult[]) {
  const hallucinationCount = results.filter((r) =>
    r.failures.some((f) => f.includes('Hallucinated') || f.includes('at most'))
  ).length
  const missCount = results.filter((r) =>
    r.failures.some((f) => f.includes('Missing required') || f.includes('at least'))
  ).length

  return {
    total: results.length,
    passed: results.filter((r) => r.status === 'pass').length,
    partial: results.filter((r) => r.status === 'partial').length,
    failed: results.filter((r) => r.status === 'fail').length,
    errors: results.filter((r) => r.status === 'error').length,
    hallucinationCount,
    missCount,
    passRate: results.length ? results.filter((r) => r.status === 'pass').length / results.length : 0,
    results,
  }
}
