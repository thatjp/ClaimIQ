'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import type { Claim, ClaimItem } from '@/types/items'
import { ClaimHeader } from '@/components/claim/ClaimHeader'
import { ClaimItemsTable } from '@/components/claim/ClaimItemsTable'
import { AIChatPanel } from '@/components/claim/AIChatPanel'
import { useClaimPricing } from '@/lib/hooks/useClaimPricing'
import { patchClaimItem } from '@/lib/claims/client'

function fallbackClaim(claimId: string): Claim {
  return {
    id: claimId,
    state: 'CA',
    policy_type: 'HO-3',
    date_of_loss: new Date().toISOString().split('T')[0],
    status: 'open',
    created_at: new Date().toISOString(),
    items: [],
  }
}

export default function ClaimWorkspacePage() {
  const params = useParams()
  const claimId = params.id as string

  const [claim, setClaim] = useState<Claim | null>(null)
  const [loading, setLoading] = useState(true)

  const { pricingState, refreshPrice } = useClaimPricing(
    (updater) => setClaim((prev) => (prev ? { ...prev, items: updater(prev.items) } : prev))
  )

  async function handleManualPrice(item: ClaimItem, price: number) {
    const { item: updated } = await patchClaimItem(claimId, item.id, {
      manualPrice: price,
      itemName: item.name,
      itemBrand: item.brand,
      itemCondition: item.condition,
    })
    setClaim((prev) =>
      prev ? { ...prev, items: prev.items.map((i) => (i.id === updated.id ? updated : i)) } : prev
    )
  }

  useEffect(() => {
    async function loadClaim() {
      try {
        const res = await fetch(`/api/claims/${claimId}`)
        setClaim(res.ok ? await res.json() : fallbackClaim(claimId))
      } catch {
        setClaim(fallbackClaim(claimId))
      } finally {
        setLoading(false)
      }
    }
    loadClaim()
  }, [claimId])

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-3">
        <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full" />
        <span className="text-sm text-gray-500">Loading claim...</span>
      </div>
    )
  }

  if (!claim) {
    return (
      <div className="p-8">
        <p className="text-red-600 text-sm">Claim not found.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col md:flex-row h-full">
      <div className="flex-1 overflow-auto p-4 md:p-8">
        <ClaimHeader claim={claim} claimId={claimId} />
        <ClaimItemsTable
          items={claim.items}
          pricingState={pricingState}
          onRefreshPrice={(item: ClaimItem) => refreshPrice(item)}
          onManualPrice={handleManualPrice}
        />
      </div>
      <AIChatPanel claimId={claimId} />
    </div>
  )
}
