'use client'

import { useState } from 'react'
import type { ClaimItem } from '@/types/items'
import type { ItemSuggestion, ResolveResult } from '@/lib/ai/resolver-types'

interface Props {
  claimId: string
  item: ClaimItem
  onApply: (suggestion: ItemSuggestion) => Promise<void>
}

const CONFIDENCE_STYLES = {
  high: 'text-green-700 bg-green-50',
  medium: 'text-amber-700 bg-amber-50',
  low: 'text-red-700 bg-red-50',
} as const

export function FlaggedItemResolver({ claimId, item, onApply }: Props) {
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ResolveResult | null>(null)
  const [hint, setHint] = useState('')

  async function handleResolve() {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch(`/api/claims/${claimId}/items/${item.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hint.trim() ? { hint: hint.trim() } : {}),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? 'Resolution failed')
      }

      setResult(await res.json() as ResolveResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resolution failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleApply() {
    if (!result?.suggestion) return
    setApplying(true)
    setError(null)
    try {
      await onApply(result.suggestion)
      setResult(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply suggestion')
    } finally {
      setApplying(false)
    }
  }

  const suggestion = result?.suggestion

  return (
    <div className="px-4 py-3 bg-amber-50 border-t border-amber-100">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">AI Resolution</p>
          {item.flag_reason && (
            <p className="text-xs text-amber-700 mt-0.5">Flag: {item.flag_reason}</p>
          )}
        </div>
      </div>

      {!result && (
        <div className="space-y-2 mb-2">
          <input
            type="text"
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            placeholder="Optional hint (e.g. homeowner said Samsung 65-inch)"
            className="w-full px-2 py-1.5 text-xs border border-amber-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
          <button
            type="button"
            onClick={handleResolve}
            disabled={loading}
            className="text-xs font-medium text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-200 px-3 py-1.5 rounded-md disabled:opacity-60"
          >
            {loading ? 'Resolving…' : 'Resolve with AI'}
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 mb-2">{error}</p>
      )}

      {result && (
        <div className="space-y-3">
          {result.toolCalls.length > 0 && (
            <div className="text-xs text-amber-900">
              <p className="font-medium mb-1">Tool trace ({result.steps} step{result.steps !== 1 ? 's' : ''})</p>
              <ul className="space-y-0.5">
                {result.toolCalls.map((call, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-amber-600 shrink-0">✓</span>
                    <span>
                      <span className="font-mono text-amber-800">{call.tool}</span>
                      {' — '}
                      {call.summary}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.unresolved && (
            <p className="text-xs text-red-600">
              Agent did not submit a suggestion. {result.reasoning || 'Try again or edit manually.'}
            </p>
          )}

          {suggestion && (
            <div className="bg-white border border-amber-200 rounded-md p-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-gray-800 capitalize">{suggestion.action}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${CONFIDENCE_STYLES[suggestion.confidence]}`}>
                  {suggestion.confidence} confidence
                </span>
              </div>

              {suggestion.action === 'update' && (
                <div className="text-sm text-gray-900">
                  <p className="font-medium">{suggestion.name ?? item.name}</p>
                  {(suggestion.brand || suggestion.model) && (
                    <p className="text-xs text-gray-500">
                      {[suggestion.brand, suggestion.model].filter(Boolean).join(' ')}
                    </p>
                  )}
                  {suggestion.category && (
                    <p className="text-xs text-gray-500 capitalize mt-0.5">{suggestion.category} · {suggestion.condition ?? item.condition}</p>
                  )}
                </div>
              )}

              {suggestion.action === 'merge' && suggestion.mergeIntoItemId && (
                <p className="text-sm text-gray-800">
                  Merge into item <span className="font-mono text-xs">{suggestion.mergeIntoItemId.slice(0, 8)}…</span>
                </p>
              )}

              {suggestion.action === 'exclude' && (
                <p className="text-sm text-gray-800">Remove from personal property schedule (structural/fixture)</p>
              )}

              <p className="text-xs text-gray-600">{suggestion.rationale}</p>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={applying}
                  className="text-xs font-medium text-white bg-amber-700 hover:bg-amber-800 px-3 py-1.5 rounded-md disabled:opacity-60"
                >
                  {applying ? 'Applying…' : 'Apply suggestion'}
                </button>
                <button
                  type="button"
                  onClick={() => setResult(null)}
                  className="text-xs text-amber-800 hover:underline px-2 py-1.5"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {!suggestion && !result.unresolved && (
            <button
              type="button"
              onClick={() => setResult(null)}
              className="text-xs text-amber-800 hover:underline"
            >
              Dismiss
            </button>
          )}
        </div>
      )}
    </div>
  )
}
