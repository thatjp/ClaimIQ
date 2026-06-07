'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { useCompletion } from '@ai-sdk/react'
import type { Claim, ClaimItem } from '@/types/items'
import { ClaimHeader } from '@/components/claim/ClaimHeader'
import { ClaimItemsTable } from '@/components/claim/ClaimItemsTable'
import { DocumentPane } from '@/components/claim/DocumentPane'
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

type Tab = 'items' | 'document'

export default function ClaimWorkspacePage() {
  const params = useParams()
  const claimId = params.id as string

  const [claim, setClaim] = useState<Claim | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('items')
  const [documentItemIds, setDocumentItemIds] = useState<string[] | null>(null)

  const { pricingState, refreshPrice } = useClaimPricing(
    (updater) => setClaim((prev) => (prev ? { ...prev, items: updater(prev.items) } : prev))
  )

  // Completion state lives here so it survives tab switches
  const hasStarted = useRef(false)
  const { completion, complete, isLoading: docLoading, error: docError } = useCompletion({
    api: '/api/generate',
    body: { claimId, itemIds: documentItemIds },
    streamProtocol: 'text',
  })

  // Start generation once itemIds are set
  useEffect(() => {
    if (!documentItemIds || hasStarted.current) return
    hasStarted.current = true
    complete('')
  }, [documentItemIds, complete])

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

  async function handleManualPrice(item: ClaimItem, price: number, sourceUrl?: string) {
    const { item: updated } = await patchClaimItem(claimId, item.id, {
      manualPrice: price,
      itemName: item.name,
      itemBrand: item.brand,
      itemCondition: item.condition,
      ...(sourceUrl ? { price_sources: [sourceUrl] } : {}),
    })
    setClaim((prev) =>
      prev ? { ...prev, items: prev.items.map((i) => (i.id === updated.id ? updated : i)) } : prev
    )
  }

  async function handleApprovalChange(itemId: string, approved: boolean) {
    const { item: updated } = await patchClaimItem(claimId, itemId, { approved })
    setClaim((prev) =>
      prev ? { ...prev, items: prev.items.map((i) => (i.id === updated.id ? updated : i)) } : prev
    )
  }

  async function handleEditItem(itemId: string, updates: Partial<ClaimItem>) {
    const { item: updated } = await patchClaimItem(claimId, itemId, updates)
    setClaim((prev) =>
      prev ? { ...prev, items: prev.items.map((i) => (i.id === updated.id ? updated : i)) } : prev
    )
    // Re-price using the updated item fields
    refreshPrice(updated)
  }

  async function handleDeleteItems(itemIds: string[]) {
    const res = await fetch(`/api/claims/${claimId}/items`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemIds }),
    })
    if (!res.ok) throw new Error('Failed to delete items')
    setClaim((prev) =>
      prev ? { ...prev, items: prev.items.filter((i) => !itemIds.includes(i.id)) } : prev
    )
  }

  function handleGenerateForItems(itemIds: string[]) {
    // Reset so a new generation can start if items change
    hasStarted.current = false
    setDocumentItemIds(itemIds)
    setActiveTab('document')
  }

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
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 md:px-8 pt-4 md:pt-8 shrink-0">
        <ClaimHeader claim={claim} claimId={claimId} />

        <div className="flex border-b border-gray-200 -mb-px">
          <button
            onClick={() => setActiveTab('items')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'items'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Items
          </button>
          {documentItemIds && (
            <button
              onClick={() => setActiveTab('document')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'document'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Document
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {activeTab === 'items' && (
          <div className="p-4 md:p-8 pt-6">
            <ClaimItemsTable
              items={claim.items}
              pricingState={pricingState}
              onManualPrice={handleManualPrice}
              onApprovalChange={handleApprovalChange}
              onDeleteItems={handleDeleteItems}
              onGenerateForItems={handleGenerateForItems}
              onEditItem={handleEditItem}
            />
          </div>
        )}
        {activeTab === 'document' && documentItemIds && (
          <DocumentPane
            completion={completion}
            isLoading={docLoading}
            error={docError}
            claimId={claimId}
            onRetry={() => { hasStarted.current = false; complete('') }}
          />
        )}
      </div>
    </div>
  )
}
