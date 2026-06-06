import { mergePriceTrace, type PriceTraceStep } from '@/lib/pricing/trace'
import type { ClaimItem } from '@/types/items'

export type PriceLookupItem = Pick<
  ClaimItem,
  'name' | 'brand' | 'model' | 'category' | 'condition' | 'estimated_age' | 'quantity' | 'price_sources'
>

export interface PriceLookupOptions {
  /** Called whenever the pipeline trace updates (initial pending state + each poll tick). */
  onTraceUpdate?: (trace: PriceTraceStep[]) => void
  /** Refresh using the first claim source URL instead of the full price ladder. */
  refreshFromSources?: boolean
}

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
  syncTrace?: PriceTraceStep[]
  trace?: PriceTraceStep[]
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

function toRequestItem(item: PriceLookupItem, options?: PriceLookupOptions) {
  const firstSource = item.price_sources?.[0]
  const refreshFromSource =
    options?.refreshFromSources && firstSource ? firstSource : undefined

  return {
    name: item.name,
    brand: item.brand,
    model: item.model,
    category: item.category,
    condition: item.condition,
    estimatedAge: item.estimated_age,
    quantity: item.quantity,
    priceSources: item.price_sources,
    refreshFromSource,
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

function emitTraceUpdate(
  options: PriceLookupOptions | undefined,
  trace: PriceTraceStep[] | undefined
) {
  if (trace?.length) options?.onTraceUpdate?.(trace)
}

async function postPriceLookup(
  item: PriceLookupItem,
  options?: PriceLookupOptions,
  cacheOnly = false
): Promise<PriceLookupResponse | null> {
  try {
    const res = await fetch('/api/price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: toRequestItem(item, options), cacheOnly }),
    })
    if (!res.ok) return null
    return (await res.json()) as PriceLookupResponse
  } catch {
    return null
  }
}

/** Re-check KV/vector cache after workflow poll timeout or failure. */
async function fallbackPriceFromCache(
  item: PriceLookupItem,
  options?: PriceLookupOptions
): Promise<PriceLookupOutcome | null> {
  const data = await postPriceLookup(item, options, true)
  if (!data) return null

  // Only accept a sync hit — never re-trigger workflow
  return outcomeFromSyncResponse(data)
}

export async function pollForPriceResult(
  runId: string,
  syncTrace: PriceTraceStep[],
  item?: PriceLookupItem,
  options?: PriceLookupOptions & {
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

      if (data?.trace?.length) {
        emitTraceUpdate(options, data.trace)
      } else if (data?.workflowTrace?.length) {
        emitTraceUpdate(options, mergePriceTrace(data.syncTrace ?? syncTrace, data.workflowTrace))
      }

      if (data?.status === 'completed' && data.price != null) {
        const trace = mergePriceTrace(syncTrace, data.workflowTrace ?? [])
        emitTraceUpdate(options, trace)
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

  if (item && !options?.skipCacheFallback && !options?.refreshFromSources) {
    const cached = await fallbackPriceFromCache(item, options)
    if (cached) {
      emitTraceUpdate(options, cached.trace)
      return cached
    }
  }

  return { trace: syncTrace, error: true }
}

export async function lookupItemPrice(
  item: PriceLookupItem,
  options?: PriceLookupOptions
): Promise<PriceLookupOutcome> {
  const data = await postPriceLookup(item, options)
  if (!data) return { trace: [], error: true }

  emitTraceUpdate(options, data.trace)

  const sync = outcomeFromSyncResponse(data)
  if (sync) return sync

  if (data.workflowRunId) {
    return pollForPriceResult(
      data.workflowRunId,
      data.syncTrace ?? data.trace ?? [],
      item,
      options
    )
  }

  return { trace: data.trace ?? [], error: true }
}
