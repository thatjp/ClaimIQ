export type PriceLayer =
  | 'kv_cache'
  | 'vector_cache'
  | 'ebay'
  | 'web_search'
  | 'estimated'

export type PriceTraceStepStatus = 'hit' | 'miss' | 'error' | 'running' | 'pending' | 'skipped'

export interface PriceTraceStep {
  layer: PriceLayer
  label: string
  status: PriceTraceStepStatus
  durationMs?: number
  detail?: string
}

export const PRICE_LADDER: { layer: PriceLayer; label: string }[] = [
  { layer: 'kv_cache', label: 'Exact cache' },
  { layer: 'vector_cache', label: 'Similar items' },
  { layer: 'ebay', label: 'eBay sold' },
  { layer: 'web_search', label: 'Web search' },
  { layer: 'estimated', label: 'AI estimate' },
]

export function traceStep(
  layer: PriceLayer,
  status: PriceTraceStepStatus,
  durationMs?: number,
  detail?: string
): PriceTraceStep {
  const label = PRICE_LADDER.find((s) => s.layer === layer)?.label ?? layer
  return { layer, label, status, durationMs, detail }
}

export function markSkippedAfterHit(steps: PriceTraceStep[]): PriceTraceStep[] {
  const hitIndex = steps.findIndex((s) => s.status === 'hit')
  if (hitIndex === -1) return steps
  return steps.map((step, i) =>
    i > hitIndex && step.status === 'pending' ? { ...step, status: 'skipped' as const } : step
  )
}

/** Merge sync-path trace with workflow trace into a full ladder. */
export function mergePriceTrace(
  syncTrace: PriceTraceStep[],
  workflowTrace: PriceTraceStep[]
): PriceTraceStep[] {
  const byLayer = new Map<PriceLayer, PriceTraceStep>()
  for (const step of [...syncTrace, ...workflowTrace]) {
    byLayer.set(step.layer, step)
  }

  const merged = PRICE_LADDER.map(({ layer, label }) => {
    const existing = byLayer.get(layer)
    if (existing) return existing
    return traceStep(layer, 'skipped')
  })

  return markSkippedAfterHit(merged)
}

/** Pending async steps shown while workflow runs. */
export function pendingWorkflowTrace(syncTrace: PriceTraceStep[]): PriceTraceStep[] {
  const syncLayers = new Set(syncTrace.map((s) => s.layer))
  const asyncSteps: PriceTraceStep[] = [
    traceStep('ebay', 'running'),
    traceStep('web_search', 'pending'),
    traceStep('estimated', 'pending'),
  ]
  return [...syncTrace, ...asyncSteps.filter((s) => !syncLayers.has(s.layer))]
}

export function finalizeSyncHit(
  syncTrace: PriceTraceStep[],
  hitLayer: PriceLayer
): PriceTraceStep[] {
  const merged = PRICE_LADDER.map(({ layer, label }) => {
    const fromSync = syncTrace.find((s) => s.layer === layer)
    if (fromSync) return fromSync
    const hitIndex = PRICE_LADDER.findIndex((s) => s.layer === hitLayer)
    const thisIndex = PRICE_LADDER.findIndex((s) => s.layer === layer)
    if (thisIndex > hitIndex) return traceStep(layer, 'skipped')
    return traceStep(layer, 'miss')
  })
  return merged
}
