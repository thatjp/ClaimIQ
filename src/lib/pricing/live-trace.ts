import { kv } from '@/lib/kv'
import type { PriceLayer, PriceTraceStep } from '@/lib/pricing/trace'

export interface LivePriceTraceState {
  syncTrace: PriceTraceStep[]
  workflowTrace: PriceTraceStep[]
}

const TRACE_TTL = 60 * 60 * 24

function liveTraceKey(traceKey: string) {
  return `price-trace:${traceKey}`
}

function liveTraceRunKey(workflowRunId: string) {
  return `price-trace-run:${workflowRunId}`
}

export async function initLiveTrace(
  traceKey: string,
  workflowRunId: string,
  syncTrace: PriceTraceStep[]
) {
  const state: LivePriceTraceState = { syncTrace, workflowTrace: [] }
  await kv.set(liveTraceKey(traceKey), state, { ex: TRACE_TTL })
  await kv.set(liveTraceRunKey(workflowRunId), traceKey, { ex: TRACE_TTL })
}

export async function readLiveTrace(traceKey: string): Promise<LivePriceTraceState | null> {
  return kv.get<LivePriceTraceState>(liveTraceKey(traceKey))
}

export async function readLiveTraceByRunId(
  workflowRunId: string
): Promise<LivePriceTraceState | null> {
  const traceKey = await kv.get<string>(liveTraceRunKey(workflowRunId))
  if (!traceKey) return null
  return readLiveTrace(traceKey)
}

export async function updateLiveTrace(
  traceKey: string,
  update: Partial<LivePriceTraceState>
) {
  const current = (await readLiveTrace(traceKey)) ?? { syncTrace: [], workflowTrace: [] }
  const next: LivePriceTraceState = {
    syncTrace: update.syncTrace ?? current.syncTrace,
    workflowTrace: update.workflowTrace ?? current.workflowTrace,
  }
  await kv.set(liveTraceKey(traceKey), next, { ex: TRACE_TTL })
}

export function liveTraceToSteps(state: LivePriceTraceState): PriceTraceStep[] {
  const byLayer = new Map<PriceLayer, PriceTraceStep>()
  for (const step of [...state.syncTrace, ...state.workflowTrace]) {
    byLayer.set(step.layer, step)
  }
  return Array.from(byLayer.values())
}
