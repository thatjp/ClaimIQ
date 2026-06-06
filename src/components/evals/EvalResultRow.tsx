import type { EvalStatus } from '@/lib/evals/types'

interface Props {
  id: string
  status: EvalStatus
  summary: string
  failures: string[]
  durationMs: number
  notes?: string
}

const STATUS_STYLES: Record<EvalStatus, string> = {
  pass: 'bg-green-100 text-green-800',
  partial: 'bg-yellow-100 text-yellow-800',
  fail: 'bg-red-100 text-red-800',
  error: 'bg-gray-100 text-gray-800',
}

export function EvalResultRow({ id, status, summary, failures, durationMs, notes }: Props) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium text-gray-900">{id}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[status]}`}>
              {status}
            </span>
          </div>
          <p className="text-sm text-gray-700 mt-1">{summary}</p>
          {notes && <p className="text-xs text-gray-500 mt-1">{notes}</p>}
        </div>
        <span className="text-xs text-gray-400 shrink-0">{durationMs}ms</span>
      </div>
      {failures.length > 0 && (
        <ul className="mt-2 text-xs text-red-700 list-disc list-inside space-y-0.5">
          {failures.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
