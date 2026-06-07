import { traceStep, markSkippedAfterHit, PRICE_LADDER, type PriceTraceStep } from '@/lib/pricing/trace'
import type { ClaimItem } from '@/types/items'

export type PriceLookupItem = Pick<
  ClaimItem,
  'name' | 'brand' | 'model' | 'category' | 'condition' | 'estimated_age' | 'quantity' | 'price_sources'
>

export interface PriceLookupOptions {
  onTraceUpdate?: (trace: PriceTraceStep[]) => void
}

export interface PriceLookupOutcome {
  price?: number
  sources?: string[]
  source?: ClaimItem['priceSource']
  stale?: boolean
  notFound?: boolean
  trace: PriceTraceStep[]
  error?: boolean
}

function buildPendingTrace(): PriceTraceStep[] {
  return PRICE_LADDER.map(({ layer }, i) =>
    traceStep(layer, i === 0 ? 'running' : 'pending')
  )
}

function applyLayerUpdate(
  current: PriceTraceStep[],
  incoming: PriceTraceStep
): PriceTraceStep[] {
  const updated = current.map((s) => (s.layer === incoming.layer ? incoming : s))

  // If this layer is now running, mark all earlier pending ones as skipped
  if (incoming.status === 'running') {
    const runningIdx = PRICE_LADDER.findIndex((l) => l.layer === incoming.layer)
    return updated.map((s, i) => (i < runningIdx && s.status === 'pending' ? { ...s, status: 'skipped' as const } : s))
  }

  // If this layer hit, mark all later ones as skipped
  if (incoming.status === 'hit') {
    return markSkippedAfterHit(updated)
  }

  return updated
}

async function pollWorkflow(
  workflowRunId: string,
  trace: PriceTraceStep[],
  options?: PriceLookupOptions
): Promise<PriceLookupOutcome> {
  const POLL_INTERVAL = 1500
  const MAX_POLLS = 120 // 3 minutes

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL))

    try {
      const res = await fetch(`/api/price/${workflowRunId}`)
      if (!res.ok) continue

      const data = await res.json() as Record<string, unknown>

      if (data.workflowTrace) {
        const workflowSteps = data.workflowTrace as PriceTraceStep[]
        for (const step of workflowSteps) {
          trace = applyLayerUpdate(trace, step)
        }
        options?.onTraceUpdate?.(trace)
      }

      if (data.status === 'completed') {
        if (data.source === 'not_found') {
          return { notFound: true, trace }
        }
        return {
          price: data.price as number,
          sources: data.sources as string[],
          source: data.source as ClaimItem['priceSource'],
          trace,
        }
      }

      if (data.status === 'failed') {
        return { trace, error: true }
      }
    } catch {
      // network blip — keep polling
    }
  }

  return { trace, error: true }
}

export async function lookupItemPrice(
  item: PriceLookupItem,
  options?: PriceLookupOptions
): Promise<PriceLookupOutcome> {
  let trace = buildPendingTrace()
  options?.onTraceUpdate?.(trace)

  let result: PriceLookupOutcome = { trace, error: true }

  try {
    const res = await fetch('/api/price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item: {
          name: item.name,
          brand: item.brand,
          model: item.model,
          category: item.category,
          condition: item.condition,
          estimatedAge: item.estimated_age,
          quantity: item.quantity,
        },
      }),
    })

    if (!res.ok || !res.body) return { trace, error: true }

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
        if (!line.startsWith('2:')) continue
        try {
          const events = JSON.parse(line.slice(2)) as unknown[]
          for (const event of events) {
            if (typeof event !== 'object' || event === null) continue
            const e = event as Record<string, unknown>

            if (e.type === 'layer' && e.step) {
              trace = applyLayerUpdate(trace, e.step as PriceTraceStep)
              options?.onTraceUpdate?.(trace)
            } else if (e.type === 'result') {
              result = {
                price: e.price as number,
                sources: e.sources as string[],
                source: e.source as ClaimItem['priceSource'],
                stale: e.stale as boolean | undefined,
                trace,
              }
            } else if (e.type === 'workflow_started') {
              // Cache missed — poll the workflow for eBay + Amazon results
              return pollWorkflow(e.workflowRunId as string, trace, options)
            } else if (e.type === 'error') {
              result = { trace, error: true }
            }
          }
        } catch {
          // malformed chunk — skip
        }
      }
    }
  } catch {
    return { trace, error: true }
  }

  return result
}
