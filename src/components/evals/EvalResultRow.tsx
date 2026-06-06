interface Fixture {
  name: string
  brand: string
  condition: string
  expectedPrice: number
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

interface Props {
  fixture: Fixture
  result?: EvalResult
  running: boolean
}

export function EvalResultRow({ fixture, result, running }: Props) {
  return (
    <tr className="hover:bg-gray-50">
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
        ) : running ? (
          <span className="text-xs text-blue-600">Testing...</span>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-gray-500 max-w-xs">
        {result?.notes || ''}
      </td>
    </tr>
  )
}
