'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { useCompletion } from '@ai-sdk/react'
import type { Claim, ClaimItem } from '@/types/items'
import { ClaimHeader } from '@/components/claim/ClaimHeader'
import { ClaimItemsTable } from '@/components/claim/ClaimItemsTable'
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

function DocumentPane({
  completion,
  isLoading,
  error,
  claimId,
  onRetry,
}: {
  completion: string
  isLoading: boolean
  error: Error | undefined
  claimId: string
  onRetry: () => void
}) {
  function handleExport() {
    const blob = new Blob([completion], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `claim-${claimId}-document.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 shrink-0">
        <p className="text-xs text-gray-500">
          {isLoading ? 'Generating…' : error ? 'Generation failed' : 'Ready'}
        </p>
        <div className="flex gap-2">
          {error && (
            <button onClick={onRetry} className="text-xs text-red-600 hover:underline">
              Retry
            </button>
          )}
          {completion && !isLoading && (
            <button
              onClick={handleExport}
              className="text-xs px-3 py-1 bg-gray-800 text-white rounded-md hover:bg-gray-900 transition-colors"
            >
              Export
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded border border-red-100 mb-4">
            {error.message}
          </p>
        )}
        {isLoading && !completion && (
          <div className="flex items-center gap-3 py-16 justify-center">
            <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full" />
            <span className="text-sm text-gray-500">Generating document…</span>
          </div>
        )}
        {completion && (
          <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono leading-relaxed">
            {completion}
            {isLoading && <span className="inline-block w-2 h-4 bg-blue-600 ml-0.5 animate-pulse" />}
          </pre>
        )}
      </div>
    </div>
  )
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
              onRefreshPrice={(item: ClaimItem) => refreshPrice(item)}
              onManualPrice={handleManualPrice}
              onApprovalChange={handleApprovalChange}
              onDeleteItems={handleDeleteItems}
              onGenerateForItems={handleGenerateForItems}
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
