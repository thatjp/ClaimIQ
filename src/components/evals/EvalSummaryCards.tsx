interface EvalResult {
  withinTolerance: boolean
  hasSource: boolean
  sourceIsUrl: boolean
}

interface Props {
  results: EvalResult[]
  done: boolean
}

export function EvalSummaryCards({ results, done }: Props) {
  return (
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
  )
}
