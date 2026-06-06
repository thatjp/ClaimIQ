import { mergePriceTrace, type PriceTraceStep } from '@/lib/pricing/trace'
import type { ClaimItem } from '@/types/items'

export interface PriceLookupResponse {
  price?: number
  sources?: string[]
  source?: ClaimItem['priceSource']
  status?: 'pending'
  workflowRunId?: string
  syncTrace?: PriceTraceStep[]
  trace?: PriceTraceStep[]
}

export interface PricePollResponse {
  status: string
  price?: number
  sources?: string[]
  source?: ClaimItem['priceSource']
  workflowTrace?: PriceTraceStep[]
}

export interface PriceLookupOutcome {
  price?: number
  sources?: string[]
  source?: ClaimItem['priceSource']
  trace: PriceTraceStep[]
  error?: boolean
}

export async function pollForPriceResult(
  runId: string,
  syncTrace: PriceTraceStep[],
  maxAttempts = 30,
  intervalMs = 2000
): Promise<PriceLookupOutcome> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs))
    try {
      const res = await fetch(`/api/price/${runId}`)
      if (!res.ok) return { trace: syncTrace, error: true }
      const data = (await res.json()) as PricePollResponse
      if (data.status === 'completed' && data.price != null) {
        const trace = mergePriceTrace(syncTrace, data.workflowTrace ?? [])
        return {
          price: data.price,
          sources: data.sources,
          source: data.source,
          trace,
        }
      }
      if (data.status === 'failed') return { trace: syncTrace, error: true }
    } catch {
      return { trace: syncTrace, error: true }
    }
  }
  return { trace: syncTrace, error: true }
}

export async function lookupItemPrice(
  item: Pick<ClaimItem, 'name' | 'brand' | 'model' | 'category' | 'condition' | 'estimated_age' | 'quantity'>
): Promise<PriceLookupOutcome> {
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

  if (!res.ok) return { trace: [], error: true }

  const data = (await res.json()) as PriceLookupResponse

  if (data.price != null && data.trace) {
    return {
      price: data.price,
      sources: data.sources,
      source: data.source,
      trace: data.trace,
    }
  }

  if (data.workflowRunId) {
    return pollForPriceResult(data.workflowRunId, data.syncTrace ?? data.trace ?? [])
  }

  return { trace: data.trace ?? [], error: true }
}
