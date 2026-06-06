'use client'

import fixtures from '../../../../evals/fixtures/items.json'
import { useEvalRunner } from '@/lib/hooks/useEvalRunner'
import { EvalSummaryCards } from '@/components/evals/EvalSummaryCards'
import { EvalResultRow } from '@/components/evals/EvalResultRow'

function PassRateBadge({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100)
  const color =
    pct >= 80 ? 'bg-green-100 text-green-800' :
    pct >= 60 ? 'bg-yellow-100 text-yellow-800' :
    'bg-red-100 text-red-800'
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${color}`}>
      {pct}% pass rate
    </span>
  )
}

export default function EvalsPage() {
  const { results, running, done, runEvals } = useEvalRunner(fixtures)

  const passCount = results.filter((r) => r.pass).length
  const passRate = results.length > 0 ? passCount / results.length : null

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

      <EvalSummaryCards results={results} done={done} />

      {running && (
        <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
          <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
          Running evals in parallel...
        </div>
      )}

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
            {fixtures.map((fixture) => (
              <EvalResultRow
                key={fixture.name}
                fixture={fixture}
                result={results.find((r) => r.item === fixture.name)}
                running={running}
              />
            ))}
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
