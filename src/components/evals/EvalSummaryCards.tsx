import type { EvalRunReport } from '@/lib/evals/types'

interface Props {
  report: EvalRunReport
}

export function EvalSummaryCards({ report }: Props) {
  const ext = report.extraction
  const prc = report.pricing

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <SummaryCard
        label="Extraction pass rate"
        value={`${Math.round(ext.passRate * 100)}%`}
        detail={`${ext.passed}/${ext.total} passed`}
        tone={ext.passRate >= 0.9 ? 'good' : ext.passRate >= 0.75 ? 'warn' : 'bad'}
      />
      <SummaryCard
        label="Hallucination cases"
        value={String(ext.hallucinationCount)}
        detail="Forbidden or extra items"
        tone={ext.hallucinationCount === 0 ? 'good' : 'bad'}
      />
      <SummaryCard
        label="Miss cases"
        value={String(ext.missCount)}
        detail="Required items not found"
        tone={ext.missCount === 0 ? 'good' : 'warn'}
      />
      <SummaryCard
        label="Pricing in range"
        value={`${Math.round(prc.passRate * 100)}%`}
        detail={`${prc.passed}/${prc.total} within band`}
        tone={prc.passRate >= 0.875 ? 'good' : prc.passRate >= 0.75 ? 'warn' : 'bad'}
      />
    </div>
  )
}

function SummaryCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string
  value: string
  detail: string
  tone: 'good' | 'warn' | 'bad'
}) {
  const toneClasses = {
    good: 'border-green-200 bg-green-50',
    warn: 'border-yellow-200 bg-yellow-50',
    bad: 'border-red-200 bg-red-50',
  }

  return (
    <div className={`rounded-lg border p-4 ${toneClasses[tone]}`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-semibold text-gray-900 mt-1">{value}</p>
      <p className="text-xs text-gray-600 mt-1">{detail}</p>
    </div>
  )
}
