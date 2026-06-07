export type PriceLayer =
  | 'kv_cache'
  | 'vector_cache'
  | 'ebay'
  | 'amazon'
  | 'walmart'
  | 'home_depot'
  | 'manual'

export type PriceTraceStepStatus = 'hit' | 'miss' | 'error' | 'running' | 'pending' | 'skipped'

export interface PriceTraceStep {
  layer: PriceLayer
  label: string
  status: PriceTraceStepStatus
  durationMs?: number
  detail?: string
}

export const PRICE_LADDER: { layer: PriceLayer; label: string }[] = [
  { layer: 'kv_cache',     label: 'Exact cache' },
  { layer: 'vector_cache', label: 'Similar items' },
  { layer: 'ebay',         label: 'eBay sold' },
  { layer: 'amazon',       label: 'Amazon' },
  { layer: 'walmart',      label: 'Walmart' },
  { layer: 'home_depot',   label: 'Home Depot' },
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
