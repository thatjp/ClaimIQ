'use client'

import { useState } from 'react'
import type { ClaimItem } from '@/types/items'

export function useClaimPricing(
  items: ClaimItem[],
  setItems: (updater: (prev: ClaimItem[]) => ClaimItem[]) => void
) {
  const [pricingItemId, setPricingItemId] = useState<string | null>(null)

  function updateItemPrice(itemId: string, price: number, priceSource: ClaimItem['priceSource']) {
    setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, price, priceSource } : i))
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
          updateItemPrice(itemId, data.price, 'web_search')
          return
        }
        if (data.status === 'failed') return
      } catch {
        return
      }
    }
  }

  async function refreshPrice(item: ClaimItem) {
    setPricingItemId(item.id)
    try {
      const res = await fetch('/api/price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item }),
      })
      if (!res.ok) return
      const data = await res.json()
      if (data.price) {
        updateItemPrice(item.id, data.price, data.source)
      } else if (data.workflowRunId) {
        await pollForPrice(item.id, data.workflowRunId)
      }
    } catch {
      // ignore
    } finally {
      setPricingItemId(null)
    }
  }

  return { pricingItemId, refreshPrice }
}
