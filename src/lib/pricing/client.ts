import { mergePriceTrace, type PriceTraceStep } from '@/lib/pricing/trace'
import type { ClaimItem } from '@/types/items'

export type PriceLookupItem = Pick<
  ClaimItem,
  'name' | 'brand' | 'model' | 'category' | 'condition' | 'estimated_age' | 'quantity'
>

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

const DEFAULT_POLL_ATTEMPTS = 60
const DEFAULT_POLL_INTERVAL_MS = 3000

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function toRequestItem(item: PriceLookupItem) {
  return {
    name: item.name,
    brand: item.brand,
    model: item.model,
    category: item.category,
    condition: item.condition,
    estimatedAge: item.estimated_age,
    quantity: item.quantity,
  }
}

function outcomeFromSyncResponse(data: PriceLookupResponse): PriceLookupOutcome | null {
  if (data.price == null || !data.trace) return null
  return {
    price: data.price,
    sources: data.sources,
    source: data.source,
    trace: data.trace,
  }
}

async function postPriceLookup(item: PriceLookupItem, cacheOnly = false): Promise<PriceLookupResponse | null> {
  try {
    const res = await fetch('/api/price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: toRequestItem(item), cacheOnly }),
    })
    if (!res.ok) return null
    return (await res.json()) as PriceLookupResponse
  } catch {
    return null
  }
}

/** Re-check KV/vector cache after workflow poll timeout or failure. */
async function fallbackPriceFromCache(
  item: PriceLookupItem
): Promise<PriceLookupOutcome | null> {
  const data = await postPriceLookup(item, true)
  if (!data) return null

  // Only accept a sync hit — never re-trigger workflow
  return outcomeFromSyncResponse(data)
}

export async function pollForPriceResult(
  runId: string,
  syncTrace: PriceTraceStep[],
  item?: PriceLookupItem,
  options?: {
    maxAttempts?: number
    intervalMs?: number
    skipCacheFallback?: boolean
  }
): Promise<PriceLookupOutcome> {
  const maxAttempts = options?.maxAttempts ?? DEFAULT_POLL_ATTEMPTS
  const intervalMs = options?.intervalMs ?? DEFAULT_POLL_INTERVAL_MS

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(`/api/price/${runId}`)
      let data: PricePollResponse | null = null
      try {
        data = (await res.json()) as PricePollResponse
      } catch {
        // ignore parse errors — retry below
      }

      if (data?.status === 'completed' && data.price != null) {
        const trace = mergePriceTrace(syncTrace, data.workflowTrace ?? [])
        return {
          price: data.price,
          sources: data.sources,
          source: data.source,
          trace,
        }
      }

      if (data?.status === 'failed') {
        break
      }

      // Still running, or transient HTTP error — keep polling
    } catch {
      // network blip — retry until attempts exhausted
    }

    if (attempt < maxAttempts - 1) {
      await sleep(intervalMs)
    }
  }

  if (item && !options?.skipCacheFallback) {
    const cached = await fallbackPriceFromCache(item)
    if (cached) return cached
  }

  return { trace: syncTrace, error: true }
}

export async function lookupItemPrice(item: PriceLookupItem): Promise<PriceLookupOutcome> {
  const data = await postPriceLookup(item)
  if (!data) return { trace: [], error: true }

  const sync = outcomeFromSyncResponse(data)
  if (sync) return sync

  if (data.workflowRunId) {
    return pollForPriceResult(data.workflowRunId, data.syncTrace ?? data.trace ?? [], item)
  }

  return { trace: data.trace ?? [], error: true }
}
