'use client'

import { useState } from 'react'
import type { ClaimItem } from '@/types/items'

export interface PricingState {
  id: string
  strategy: string
}

const STRATEGY_LABELS: Record<string, string> = {
  cache: 'KV Cache',
  vector_cache: 'Vector Cache',
  ebay: 'eBay',
  web_search: 'Web Search',
  pending: 'Web Search',
}

export function useClaimPricing(
  items: ClaimItem[],
  setItems: (updater: (prev: ClaimItem[]) => ClaimItem[]) => void
) {
  const [pricingState, setPricingState] = useState<PricingState | null>(null)

  function updateItemPrice(
    itemId: string,
    price: number,
    priceSource: ClaimItem['priceSource'],
    priceSources?: string[]
  ) {
    setItems((prev) =>
      prev.map((i) => i.id === itemId ? { ...i, price, priceSource, price_sources: priceSources } : i)
    )
  }

  async function pollForPrice(itemId: string, runId: string) {
    const maxAttempts = 30
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000))
      try {
        const res = await fetch(`/api/price/${runId}`)
        if (!res.ok) return
        const data = await res.json()
        if (data.status === 'completed' && data.price) {
          updateItemPrice(itemId, data.price, 'web_search', data.sources)
          return
        }
        if (data.status === 'failed') return
      } catch {
        return
      }
    }
  }

  async function refreshPrice(item: ClaimItem) {
    setPricingState({ id: item.id, strategy: 'Searching...' })
    try {
      const res = await fetch('/api/price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item }),
      })
      if (!res.ok) return
      const data = await res.json()
      if (data.price) {
        const label = STRATEGY_LABELS[data.source] ?? data.source
        setPricingState({ id: item.id, strategy: label })
        updateItemPrice(item.id, data.price, data.source, data.sources)
      } else if (data.workflowRunId) {
        setPricingState({ id: item.id, strategy: STRATEGY_LABELS.web_search })
        await pollForPrice(item.id, data.workflowRunId)
      }
    } catch {
      // ignore
    } finally {
      setPricingState(null)
    }
  }

  return { pricingState, refreshPrice }
}
