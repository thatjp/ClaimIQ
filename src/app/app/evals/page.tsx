'use client'

import { useCallback, useEffect, useState } from 'react'
import { EvalSummaryCards } from '@/components/evals/EvalSummaryCards'
import { EvalResultRow } from '@/components/evals/EvalResultRow'
import type { EvalProgress, EvalRunReport } from '@/lib/evals/types'

type RunMode = 'all' | 'extraction' | 'pricing'

export default function EvalsPage() {
  const [report, setReport] = useState<EvalRunReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<EvalProgress | null>(null)
  const [runPassed, setRunPassed] = useState<boolean | null>(null)

  const loadResults = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/evals/results')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (res.status === 404) {
          setReport(null)
          return
        }
        throw new Error(data.error || 'Failed to load results')
      }
      setReport(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    }
  }, [])

  useEffect(() => {
    loadResults().finally(() => setLoading(false))
  }, [loadResults])

  async function runEvals(mode: RunMode) {
    setRunning(true)
    setError(null)
    setProgress(null)
    setRunPassed(null)

    const body =
      mode === 'extraction'
        ? { extractionOnly: true }
        : mode === 'pricing'
          ? { pricingOnly: true }
          : {}

    try {
      const res = await fetch('/api/evals/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok || !res.body) {
        throw new Error('Failed to start eval run')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue
          const event = JSON.parse(line) as {
            type: string
            report?: EvalRunReport
            passed?: boolean
            message?: string
          } & Partial<EvalProgress>

          if (event.type === 'progress') {
            setProgress({
              phase: event.phase!,
              current: event.current!,
              total: event.total!,
              fixtureId: event.fixtureId!,
            })
          } else if (event.type === 'complete' && event.report) {
            setReport(event.report)
            setRunPassed(event.passed ?? null)
          } else if (event.type === 'error') {
            throw new Error(event.message || 'Eval run failed')
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eval run failed')
    } finally {
      setRunning(false)
      setProgress(null)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">AI Evaluations</h1>
          <p className="text-sm text-gray-600 mt-1">
            Regression checks for item extraction and pricing estimation. Runs against live models via AI Gateway.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={() => runEvals('all')}
            disabled={running}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {running ? 'Running…' : 'Run all'}
          </button>
          <button
            type="button"
            onClick={() => runEvals('extraction')}
            disabled={running}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Extraction only
          </button>
          <button
            type="button"
            onClick={() => runEvals('pricing')}
            disabled={running}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Pricing only
          </button>
        </div>
      </div>

      {running && progress && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
          <div className="flex items-center gap-2">
            <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
            <span>
              {progress.phase === 'extraction' ? 'Extraction' : 'Pricing'}:{' '}
              {progress.current}/{progress.total} — <code className="font-mono text-xs">{progress.fixtureId}</code>
            </span>
          </div>
        </div>
      )}

      {loading && !running && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
          Loading results...
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-900">
          {error}
        </div>
      )}

      {runPassed === false && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-900">
          Run completed below the 75% pass threshold on one or more suites.
        </div>
      )}

      {runPassed === true && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-900">
          All suites passed the 75% threshold.
        </div>
      )}

      {!report && !loading && !running && !error && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-sm text-gray-600 text-center">
          No results yet. Click <strong>Run all</strong> to execute the eval suite.
        </div>
      )}

      {report && (
        <>
          <p className="text-xs text-gray-500">Last run: {new Date(report.runAt).toLocaleString()}</p>
          <EvalSummaryCards report={report} />

          {report.extraction.total > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Extraction ({report.extraction.total} cases)
              </h2>
              {report.extraction.results.map((r) => (
                <EvalResultRow
                  key={r.id}
                  id={r.id}
                  status={r.status}
                  summary={`${r.itemCount} items: ${r.extractedNames.join(', ') || '(none)'}`}
                  failures={r.failures}
                  durationMs={r.durationMs}
                  notes={r.notes}
                />
              ))}
            </section>
          )}

          {report.pricing.total > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Pricing parser ({report.pricing.total} cases)
              </h2>
              {report.pricing.results.map((r) => (
                <EvalResultRow
                  key={r.id}
                  id={`[${r.source}] ${r.id}`}
                  status={r.status}
                  summary={
                    r.price != null
                      ? `$${r.price.toLocaleString()} — ${r.sourceCount ?? 0} source${r.sourceCount === 1 ? '' : 's'}`
                      : 'No price returned'
                  }
                  failures={r.failures}
                  durationMs={r.durationMs}
                  notes={r.notes}
                />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  )
}
