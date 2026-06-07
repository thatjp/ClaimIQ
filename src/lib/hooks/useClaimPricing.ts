'use client'

import { useState } from 'react'
import type { PriceTraceStep } from '@/lib/pricing/trace'
import { lookupItemPrice } from '@/lib/pricing/client'
import type { ClaimItem } from '@/types/items'

export interface PricingState {
  id: string
  strategy: string
  trace: PriceTraceStep[]
}

const STRATEGY_LABELS: Record<string, string> = {
  kv_cache:           'KV Cache',
  vector_cache:       'Vector Cache',
  vector_cache_stale: 'Stale Cache',
  ebay:               'eBay',
  serp:               'Google Shopping',
  manual:             'Manual',
}

function strategyFromTrace(trace: PriceTraceStep[]): string {
  const running = trace.find((s) => s.status === 'running')
  if (running) return STRATEGY_LABELS[running.layer] ?? running.layer
  const hit = trace.find((s) => s.status === 'hit')
  if (hit) return STRATEGY_LABELS[hit.layer] ?? hit.layer
  return 'Searching...'
}

export function useClaimPricing(
  setItems: (updater: (prev: ClaimItem[]) => ClaimItem[]) => void
) {
  const [pricingState, setPricingState] = useState<PricingState | null>(null)
  const [notFoundIds, setNotFoundIds] = useState<Set<string>>(new Set())

  async function refreshPrice(item: ClaimItem) {
    setNotFoundIds((prev) => { const next = new Set(prev); next.delete(item.id); return next })
    setPricingState({ id: item.id, strategy: 'Searching...', trace: [] })

    try {
      const outcome = await lookupItemPrice(item, {
        onTraceUpdate: (trace) => {
          setPricingState({ id: item.id, strategy: strategyFromTrace(trace), trace })
        },
      })

      if (outcome.notFound) {
        setNotFoundIds((prev) => new Set(prev).add(item.id))
      } else if (outcome.price != null && outcome.source) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  price: outcome.price,
                  priceSource: outcome.source,
                  price_sources: outcome.sources?.length ? outcome.sources : i.price_sources,
                  priceStale: outcome.stale,
                }
              : i
          )
        )
      }
    } catch {
      // keep last known state
    } finally {
      setPricingState(null)
    }
  }

  return { pricingState, notFoundIds, refreshPrice }
}
