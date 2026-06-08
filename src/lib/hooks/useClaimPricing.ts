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
  kv_cache:           'Cache',
  vector_cache:       'Similar items',
  vector_cache_stale: 'Stale cache',
  ebay:               'eBay',
  amazon:             'Amazon',
  walmart:            'Walmart',
  home_depot:         'Home Depot',
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

  async function refreshPrice(item: ClaimItem) {
    setPricingState({ id: item.id, strategy: 'Searching...', trace: [] })

    try {
      const outcome = await lookupItemPrice(item, {
        onTraceUpdate: (trace) => {
          setPricingState({ id: item.id, strategy: strategyFromTrace(trace), trace })
        },
      })

      if (!outcome.notFound && outcome.price != null && outcome.source) {
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
        // Persist the resolved price back to claim_items so it survives a page reload
        if (item.claim_id) {
          await fetch(`/api/claims/${item.claim_id}/items/${item.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              price: outcome.price,
              price_sources: outcome.sources ?? [],
              price_source: outcome.source,
            }),
          }).catch(() => { /* non-fatal — price is already in the shared cache */ })
        }
      }
    } catch {
      // keep last known state
    } finally {
      setPricingState(null)
    }
  }

  return { pricingState, refreshPrice }
}
