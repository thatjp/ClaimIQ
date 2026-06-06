'use client'

import { useState } from 'react'
import type { PriceTraceStep } from '@/lib/pricing/trace'
import { lookupItemPrice } from '@/lib/pricing/client'
import type { ClaimItem } from '@/types/items'

export interface PricingState {
  id: string
  trace: PriceTraceStep[]
  isPolling: boolean
}

export function useClaimPricing(
  items: ClaimItem[],
  setItems: (updater: (prev: ClaimItem[]) => ClaimItem[]) => void
) {
  const [pricingState, setPricingState] = useState<PricingState | null>(null)
  const [replayItemId, setReplayItemId] = useState<string | null>(null)

  async function refreshPrice(item: ClaimItem) {
    setReplayItemId(null)
    setPricingState({ id: item.id, trace: [], isPolling: true })

    try {
      const outcome = await lookupItemPrice({
        name: item.name,
        brand: item.brand,
        model: item.model,
        category: item.category,
        condition: item.condition,
        estimated_age: item.estimated_age,
        quantity: item.quantity,
      })

      setPricingState({ id: item.id, trace: outcome.trace, isPolling: false })

      if (outcome.price != null && outcome.source) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  price: outcome.price,
                  priceSource: outcome.source,
                  price_sources: outcome.sources,
                  priceTrace: outcome.trace,
                }
              : i
          )
        )
        setReplayItemId(item.id)
      }
    } finally {
      setTimeout(() => setPricingState(null), 800)
    }
  }

  function getTraceForItem(item: ClaimItem): PriceTraceStep[] | undefined {
    if (pricingState?.id === item.id) return pricingState.trace
    return item.priceTrace
  }

  function shouldReplay(item: ClaimItem): boolean {
    return replayItemId === item.id
  }

  function isPricing(item: ClaimItem): boolean {
    return pricingState?.id === item.id
  }

  return { pricingState, refreshPrice, getTraceForItem, shouldReplay, isPricing }
}
