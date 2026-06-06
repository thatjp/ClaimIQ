'use client'

import { useState } from 'react'

interface Fixture {
  name: string
  brand: string
  model: string
  condition: string
  age: number
  expectedPrice: number
  tolerance: number
}

export interface EvalResult {
  item: string
  expected: number
  actual: number | null
  withinTolerance: boolean
  hasSource: boolean
  sourceIsUrl: boolean
  pass: boolean
  notes: string
  source?: string
}

async function evalFixture(fixture: Fixture): Promise<EvalResult> {
  const base: EvalResult = {
    item: fixture.name,
    expected: fixture.expectedPrice,
    actual: null,
    withinTolerance: false,
    hasSource: false,
    sourceIsUrl: false,
    pass: false,
    notes: '',
  }

  try {
    const res = await fetch('/api/price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

    let data = await res.json()

    if (data.status === 'pending' && data.workflowRunId) {
      const deadline = Date.now() + 60_000
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 2000))
        const pollRes = await fetch(`/api/price/${data.workflowRunId}`)
        const pollData = await pollRes.json()
        if (pollData.status === 'completed' || pollData.status === 'failed') {
          data = pollData
          break
        }
      }
    }

    const price: number | undefined = data.price
    const sources: string[] | undefined = data.sources
    const withinTolerance =
      price !== undefined &&
      Math.abs(price - fixture.expectedPrice) / fixture.expectedPrice <= fixture.tolerance
    const hasSource = Array.isArray(sources) && sources.length > 0
    const sourceIsUrl = hasSource && sources!.every((s: string) => s.startsWith('http'))
    const pass = Boolean(withinTolerance && hasSource && sourceIsUrl)

    const notes: string[] = []
    if (!withinTolerance && price !== undefined)
      notes.push(`$${price} outside ${fixture.tolerance * 100}% tolerance of $${fixture.expectedPrice}`)
    if (!hasSource) notes.push('No sources returned')
    if (!sourceIsUrl && hasSource) notes.push('Sources are not valid URLs')
    if (data.status === 'pending') notes.push('Price lookup pending (workflow triggered)')

    return {
      item: fixture.name,
      expected: fixture.expectedPrice,
      actual: price ?? null,
      withinTolerance: Boolean(withinTolerance),
      hasSource,
      sourceIsUrl,
      pass,
      notes: notes.join('; '),
      source: data.source,
    }
  } catch (err) {
    return { ...base, notes: err instanceof Error ? err.message : 'Request failed' }
  }
}

export function useEvalRunner(fixtures: Fixture[]) {
  const [results, setResults] = useState<EvalResult[]>([])
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)

  async function runEvals() {
    setRunning(true)
    setDone(false)
    setResults([])

    await Promise.all(
      fixtures.map(async (fixture) => {
        const result = await evalFixture(fixture)
        setResults((prev) => [...prev, result])
      })
    )

    setRunning(false)
    setDone(true)
  }

  return { results, running, done, runEvals }
}
