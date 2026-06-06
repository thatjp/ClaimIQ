'use client'

import { useState } from 'react'
import type { PriceTraceStep } from '@/lib/pricing/trace'
import { lookupItemPrice } from '@/lib/pricing/client'
import { patchClaimItem } from '@/lib/claims/client'
import { getValidSources } from '@/lib/claims/grounding'
import type { ClaimItem } from '@/types/items'

export interface PricingState {
  id: string
  trace: PriceTraceStep[]
  isPolling: boolean
}

export function useClaimPricing(
  claimId: string,
  setItems: (updater: (prev: ClaimItem[]) => ClaimItem[]) => void
) {
  const [pricingState, setPricingState] = useState<PricingState | null>(null)
  const [replayItemId, setReplayItemId] = useState<string | null>(null)

  async function refreshPrice(item: ClaimItem) {
    const firstSource = getValidSources(item.price_sources)[0]
    if (!firstSource) return

    setReplayItemId(null)
    setPricingState({ id: item.id, trace: [], isPolling: true })

    try {
      const outcome = await lookupItemPrice(
        {
          name: item.name,
          brand: item.brand,
          model: item.model,
          category: item.category,
          condition: item.condition,
          estimated_age: item.estimated_age,
          quantity: item.quantity,
          price_sources: item.price_sources,
        },
        {
          refreshFromSources: true,
          onTraceUpdate: (trace) => {
            setPricingState({ id: item.id, trace, isPolling: true })
          },
        }
      )

      setPricingState({ id: item.id, trace: outcome.trace, isPolling: false })

      if (outcome.price != null && outcome.source) {
        const sources =
          outcome.sources?.length ? outcome.sources : item.price_sources

        const { item: saved } = await patchClaimItem(claimId, item.id, {
          price: outcome.price,
          price_sources: sources,
          approved: false,
        })

        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  ...saved,
                  price: outcome.price,
                  priceSource: outcome.source,
                  price_sources: sources,
                  priceTrace: outcome.trace,
                  approved: false,
                }
              : i
          )
        )
        setReplayItemId(item.id)
      }
    } catch {
      // keep last known state
    } finally {
      setTimeout(() => setPricingState(null), 800)
    }
  }

  function getTraceForItem(item: ClaimItem): PriceTraceStep[] | undefined {
    if (pricingState?.id === item.id) return pricingState.trace
    return item.priceTrace
  }

  function shouldReplay(item: ClaimItem): boolean {
    return replayItemId === item.id && !isPricing(item)
  }

  function isPricing(item: ClaimItem): boolean {
    return pricingState?.id === item.id && pricingState.isPolling
  }

  function canRefreshPrice(item: ClaimItem): boolean {
    return getValidSources(item.price_sources).length > 0
  }

  return {
    pricingState,
    refreshPrice,
    getTraceForItem,
    shouldReplay,
    isPricing,
    canRefreshPrice,
  }
}
