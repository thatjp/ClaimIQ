import { kv } from '@/lib/kv'
import {
  buildLivePriceTrace,
  type PriceLayer,
  type PriceTraceStep,
} from '@/lib/pricing/trace'

export interface LivePriceTraceState {
  syncTrace: PriceTraceStep[]
  workflowTrace: PriceTraceStep[]
  activeLayer?: PriceLayer
}

const TRACE_TTL = 60 * 60 * 24

export function liveTraceKey(traceKey: string) {
  return `price-trace:${traceKey}`
}

export function liveTraceRunKey(workflowRunId: string) {
  return `price-trace-run:${workflowRunId}`
}

export async function initLiveTrace(
  traceKey: string,
  workflowRunId: string,
  syncTrace: PriceTraceStep[]
) {
  const state: LivePriceTraceState = {
    syncTrace,
    workflowTrace: [],
    activeLayer: 'ebay',
  }
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
    activeLayer: 'activeLayer' in update ? update.activeLayer : current.activeLayer,
  }
  await kv.set(liveTraceKey(traceKey), next, { ex: TRACE_TTL })
}

export function liveTraceToSteps(state: LivePriceTraceState): PriceTraceStep[] {
  return buildLivePriceTrace(state.syncTrace, state.workflowTrace, state.activeLayer)
}
