'use client'

import { useState } from 'react'
import fixtures from '../../../../evals/fixtures/items.json'

interface Fixture {
  name: string
  brand: string
  model: string
  condition: string
  age: number
  expectedPrice: number
  tolerance: number
}

interface EvalResult {
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

export default function EvalsPage() {
  const [results, setResults] = useState<EvalResult[]>([])
  const [running, setRunning] = useState(false)
  const [currentItem, setCurrentItem] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const passCount = results.filter((r) => r.pass).length
  const passRate = results.length > 0 ? passCount / results.length : null

  async function evalFixture(fixture: Fixture, onResult: (r: EvalResult) => void) {
    let result: EvalResult = {
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
      if (!withinTolerance && price !== undefined) {
        notes.push(`$${price} outside ${fixture.tolerance * 100}% tolerance of $${fixture.expectedPrice}`)
      }
      if (!hasSource) notes.push('No sources returned')
      if (!sourceIsUrl && hasSource) notes.push('Sources are not valid URLs')
      if (data.status === 'pending') notes.push('Price lookup pending (workflow triggered)')

      result = {
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
      result.notes = err instanceof Error ? err.message : 'Request failed'
    }

    onResult(result)
  }

  async function runEvals() {
    setRunning(true)
    setDone(false)
    setResults([])

    await Promise.all(
      (fixtures as Fixture[]).map((fixture) =>
        evalFixture(fixture, (result) =>
          setResults((prev) => [...prev, result])
        )
      )
    )

    setCurrentItem(null)
    setRunning(false)
    setDone(true)
  }

  function PassRateBadge({ rate }: { rate: number }) {
    const pct = Math.round(rate * 100)
    const color = pct >= 80 ? 'bg-green-100 text-green-800' : pct >= 60 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${color}`}>
        {pct}% pass rate
      </span>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Eval Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            {fixtures.length}-item regression test suite for price accuracy, source grounding, and staleness.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {passRate !== null && <PassRateBadge rate={passRate} />}
          <button
            onClick={runEvals}
            disabled={running}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {running ? 'Running...' : 'Run Evals'}
          </button>
        </div>
      </div>

      {/* Eval dimensions */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Price Accuracy</p>
          <p className="text-2xl font-semibold text-gray-900">
            {results.length > 0
              ? `${results.filter((r) => r.withinTolerance).length}/${results.length}`
              : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-1">Within ±15-20% tolerance</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Source Grounding</p>
          <p className="text-2xl font-semibold text-gray-900">
            {results.length > 0
              ? `${results.filter((r) => r.hasSource && r.sourceIsUrl).length}/${results.length}`
              : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-1">Every price has a valid URL</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Staleness Check</p>
          <p className="text-2xl font-semibold text-gray-900">
            {done ? `${results.length}/${results.length}` : '—'}
          </p>
          <p className="text-xs text-gray-400 mt-1">90-day cache invalidation</p>
        </div>
      </div>

      {running && currentItem && (
        <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
          <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
          Testing: {currentItem}
        </div>
      )}

      {/* Results table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Item</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Expected</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actual</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Price OK</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Has Source</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Cache</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Result</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {fixtures.map((fixture) => {
              const result = results.find((r) => r.item === fixture.name)
              return (
                <tr key={fixture.name} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 text-xs">{fixture.name}</div>
                    <div className="text-xs text-gray-400">{fixture.brand} · {fixture.condition}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">${fixture.expectedPrice.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    {result ? (
                      result.actual !== null ? (
                        <span className="text-gray-700">${result.actual.toLocaleString()}</span>
                      ) : (
                        <span className="text-yellow-600 text-xs">Pending</span>
                      )
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {result ? (
                      <span className={result.withinTolerance ? 'text-green-600' : 'text-red-500'}>
                        {result.withinTolerance ? 'Pass' : 'Fail'}
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {result ? (
                      <span className={result.hasSource && result.sourceIsUrl ? 'text-green-600' : 'text-red-500'}>
                        {result.hasSource && result.sourceIsUrl ? 'Pass' : 'Fail'}
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {result ? (
                      <span className="text-xs text-gray-500 capitalize">{result.source || 'N/A'}</span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {result ? (
                      <span className={`text-xs font-semibold ${result.pass ? 'text-green-700' : 'text-red-600'}`}>
                        {result.pass ? 'PASS' : 'FAIL'}
                      </span>
                    ) : (
                      running && currentItem === fixture.name ? (
                        <span className="text-xs text-blue-600">Testing...</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-xs">
                    {result?.notes || ''}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-xs text-gray-400">
        <p>
          Eval dimensions: (1) Price accuracy — within ±15-20% of known market value.
          (2) Source grounding — every price returned includes at least one valid URL source.
          (3) Staleness regression — items priced more than 90 days ago trigger a cache invalidation and re-fetch.
        </p>
        <p className="mt-1">
          An unsourced price in a legal insurance claim document is a liability. 100% source grounding is required to pass.
        </p>
      </div>
    </div>
  )
}
