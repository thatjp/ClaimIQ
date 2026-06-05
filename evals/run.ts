import fixtures from './fixtures/items.json'

interface Fixture {
  name: string
  brand: string
  model: string
  condition: string
  age: number
  expectedPrice: number
  tolerance: number
}

interface PriceResult {
  price?: number
  sources?: string[]
  status?: string
  source?: string
}

interface EvalResult {
  item: string
  expected: number
  actual: number | null
  withinTolerance: boolean
  hasSource: boolean
  sourceIsUrl: boolean
  staleness: boolean
  pass: boolean
  notes: string
}

async function lookupPrice(fixture: Fixture): Promise<PriceResult> {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

  const res = await fetch(`${baseUrl}/api/price`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // In a real eval, pass a valid session cookie or API key
      Cookie: process.env.EVAL_SESSION_COOKIE || '',
    },
    body: JSON.stringify({
      item: {
        name: fixture.name,
        brand: fixture.brand,
        model: fixture.model,
        condition: fixture.condition,
        estimatedAge: fixture.age,
      },
    }),
  })

  if (!res.ok) {
    return {}
  }

  return res.json()
}

async function runPriceEval(): Promise<{ passRate: number; results: EvalResult[] }> {
  console.log(`Running price eval on ${fixtures.length} fixtures...\n`)
  const results: EvalResult[] = []

  for (const fixture of fixtures as Fixture[]) {
    const { price, sources } = await lookupPrice(fixture)

    const withinTolerance =
      price !== undefined &&
      Math.abs(price - fixture.expectedPrice) / fixture.expectedPrice <= fixture.tolerance

    const hasSource = Array.isArray(sources) && sources.length > 0
    const sourceIsUrl = hasSource && sources!.every((s) => s.startsWith('http'))

    // Staleness check: if price was served from cache, verify it's within 90 days
    // This is a structural check — the actual TTL enforcement happens in the API
    const staleness = true // Placeholder — in production, check cached_at against NOW()

    const pass = Boolean(withinTolerance && hasSource && sourceIsUrl)

    const result: EvalResult = {
      item: fixture.name,
      expected: fixture.expectedPrice,
      actual: price ?? null,
      withinTolerance: Boolean(withinTolerance),
      hasSource,
      sourceIsUrl,
      staleness,
      pass,
      notes: [
        !withinTolerance && price !== undefined
          ? `Price ${price} outside ${fixture.tolerance * 100}% tolerance of ${fixture.expectedPrice}`
          : '',
        !hasSource ? 'No sources returned' : '',
        !sourceIsUrl && hasSource ? 'Sources are not valid URLs' : '',
      ]
        .filter(Boolean)
        .join('; '),
    }

    results.push(result)

    const status = pass ? 'PASS' : 'FAIL'
    console.log(
      `[${status}] ${fixture.name}: expected=$${fixture.expectedPrice}, actual=${price ? `$${price}` : 'N/A'}, sources=${sources?.length ?? 0}`
    )
    if (!pass && result.notes) {
      console.log(`       Notes: ${result.notes}`)
    }
  }

  const passRate = results.filter((r) => r.pass).length / results.length

  console.log(`\n=== RESULTS ===`)
  console.log(`Pass rate: ${(passRate * 100).toFixed(1)}% (${results.filter((r) => r.pass).length}/${results.length})`)
  console.log(`Price accuracy: ${results.filter((r) => r.withinTolerance).length}/${results.length}`)
  console.log(`Source grounding: ${results.filter((r) => r.hasSource && r.sourceIsUrl).length}/${results.length}`)

  return { passRate, results }
}

// Run if called directly
runPriceEval()
  .then(({ passRate }) => {
    process.exit(passRate >= 0.8 ? 0 : 1)
  })
  .catch((err) => {
    console.error('Eval failed:', err)
    process.exit(1)
  })
