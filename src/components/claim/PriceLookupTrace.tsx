'use client'

import { useEffect, useRef, useState } from 'react'
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

function TraceStepBadge({
  step,
  animate,
}: {
  step: PriceTraceStep
  animate: boolean
}) {
  return (
    <span
      className={`trace-step-badge inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-medium ${STATUS_STYLES[step.status]} ${animate ? 'trace-step-enter' : ''}`}
      title={step.detail}
    >
      <span aria-hidden>{STATUS_ICON[step.status]}</span>
      <span>{step.label}</span>
      {step.durationMs != null && step.status !== 'pending' && step.status !== 'skipped' && (
        <span className="opacity-70 font-normal">{step.durationMs}ms</span>
      )}
    </span>
  )
}

export function PriceLookupTrace({ trace, replay = false, compact = false }: Props) {
  const [visibleCount, setVisibleCount] = useState(replay ? 0 : trace.length)
  const seenLayersRef = useRef<Set<string>>(new Set())
  const [enterLayers, setEnterLayers] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (trace.length === 0) {
      seenLayersRef.current = new Set()
      setEnterLayers(new Set())
    }
  }, [trace.length])

  useEffect(() => {
    if (replay) {
      seenLayersRef.current = new Set()
      setEnterLayers(new Set())
      setVisibleCount(0)
      let i = 0
      const interval = setInterval(() => {
        i += 1
        setVisibleCount(i)
        if (i >= trace.length) clearInterval(interval)
      }, 280)
      return () => clearInterval(interval)
    }

    setVisibleCount(trace.length)

    const newlyVisible = new Set<string>()
    for (const step of trace) {
      if (!seenLayersRef.current.has(step.layer)) {
        seenLayersRef.current.add(step.layer)
        newlyVisible.add(step.layer)
      }
    }
    if (newlyVisible.size > 0) {
      setEnterLayers((prev) => new Set([...prev, ...newlyVisible]))
    }
  }, [trace, replay])

  const isOpen = trace.length > 0
  const visible = replay ? trace.slice(0, visibleCount) : trace

  return (
    <div className={`trace-expand ${isOpen ? 'is-open' : ''} ${compact ? 'mt-1' : 'mt-1.5'}`}>
      <div className="trace-expand-inner">
        {isOpen && (
          <div
            className={`flex flex-wrap items-center gap-1 ${compact ? 'text-[10px]' : 'text-xs'}`}
            aria-label="Price lookup steps"
          >
            {visible.map((step, index) => (
              <span key={step.layer} className="inline-flex items-center gap-0.5">
                {index > 0 && (
                  <span className={`text-gray-300 mx-0.5${replay ? ' trace-step-enter' : ''}`}>
                    →
                  </span>
                )}
                <TraceStepBadge
                  step={step}
                  animate={replay || enterLayers.has(step.layer)}
                />
              </span>
            ))}
            {replay && visibleCount < trace.length && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-700 animate-pulse trace-step-enter">
                …
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
