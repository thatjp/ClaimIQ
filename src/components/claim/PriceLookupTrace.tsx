'use client'

import { useEffect, useState } from 'react'
import type { PriceTraceStep, PriceTraceStepStatus } from '@/lib/pricing/trace'

const STATUS_STYLES: Record<PriceTraceStepStatus, string> = {
  hit: 'bg-green-100 text-green-800 border-green-200',
  miss: 'bg-gray-50 text-gray-500 border-gray-200',
  error: 'bg-red-50 text-red-700 border-red-200',
  running: 'bg-blue-100 text-blue-800 border-blue-300 animate-pulse',
  pending: 'bg-gray-50 text-gray-400 border-gray-100',
  skipped: 'bg-gray-50 text-gray-300 border-gray-100 line-through',
}

const STATUS_ICON: Record<PriceTraceStepStatus, string> = {
  hit: '✓',
  miss: '✗',
  error: '!',
  running: '…',
  pending: '·',
  skipped: '—',
}

interface Props {
  trace: PriceTraceStep[]
  /** Animate revealing steps one-by-one after lookup completes */
  replay?: boolean
  compact?: boolean
}

export function PriceLookupTrace({ trace, replay = false, compact = false }: Props) {
  const [visibleCount, setVisibleCount] = useState(replay ? 0 : trace.length)

  useEffect(() => {
    if (!replay) {
      setVisibleCount(trace.length)
      return
    }

    setVisibleCount(0)
    let i = 0
    const interval = setInterval(() => {
      i += 1
      setVisibleCount(i)
      if (i >= trace.length) clearInterval(interval)
    }, 280)

    return () => clearInterval(interval)
  }, [trace, replay])

  if (!trace.length) return null

  const visible = trace.slice(0, visibleCount)

  return (
    <div
      className={`flex flex-wrap items-center gap-1 ${compact ? 'text-[10px]' : 'text-xs'} mt-1.5`}
      aria-label="Price lookup steps"
    >
      {visible.map((step, index) => (
        <span key={`${step.layer}-${index}`} className="inline-flex items-center gap-0.5">
          {index > 0 && <span className="text-gray-300 mx-0.5">→</span>}
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-medium ${STATUS_STYLES[step.status]}`}
            title={step.detail}
          >
            <span aria-hidden>{STATUS_ICON[step.status]}</span>
            <span>{step.label}</span>
            {step.durationMs != null && step.status !== 'pending' && step.status !== 'skipped' && (
              <span className="opacity-70 font-normal">{step.durationMs}ms</span>
            )}
          </span>
        </span>
      ))}
      {replay && visibleCount < trace.length && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-700 animate-pulse">
          …
        </span>
      )}
    </div>
  )
}
