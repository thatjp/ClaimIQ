'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { useCompletion } from '@ai-sdk/react'
import type { Claim, ClaimItem } from '@/types/items'
import { ClaimHeader } from '@/components/claim/ClaimHeader'
import { ClaimItemsTable } from '@/components/claim/ClaimItemsTable'
import { AIChatPanel } from '@/components/claim/AIChatPanel'
import { useClaimPricing } from '@/lib/hooks/useClaimPricing'
import { patchClaimItem } from '@/lib/claims/client'
import { getClaimReadiness } from '@/lib/claims/grounding'

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

function DocumentPanel({
  claimId,
  onClose,
}: {
  claimId: string
  onClose: () => void
}) {
  const hasStarted = useRef(false)
  const { completion, complete, isLoading, error } = useCompletion({
    api: '/api/generate',
    body: { claimId },
    streamProtocol: 'text',
  })

  useEffect(() => {
    if (hasStarted.current) return
    hasStarted.current = true
    complete('')
  }, [complete])

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
    <div className="border-t border-gray-200 mt-6 pt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Claim Document</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {isLoading ? 'Generating…' : 'Ready for review'}
          </p>
        </div>
        <div className="flex gap-2">
          {completion && !isLoading && (
            <button
              onClick={handleExport}
              className="bg-gray-800 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-gray-900 transition-colors"
            >
              Export
            </button>
          )}
          {error && (
            <button
              onClick={() => complete('')}
              className="text-xs text-red-600 hover:underline"
            >
              Retry
            </button>
          )}
          <button
            onClick={onClose}
            className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-md text-xs font-medium hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded border border-red-100 mb-4">
          {error.message}
        </p>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {isLoading && !completion && (
          <div className="flex items-center gap-3 py-8 justify-center">
            <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full" />
            <span className="text-sm text-gray-500">Generating document…</span>
          </div>
        )}
        {completion ? (
          <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono leading-relaxed">
            {completion}
            {isLoading && (
              <span className="inline-block w-2 h-4 bg-blue-600 ml-0.5 animate-pulse" />
            )}
          </pre>
        ) : !isLoading && (
          <p className="text-sm text-gray-400 text-center py-8">No document generated yet.</p>
        )}
      </div>
    </div>
  )
}

export default function ClaimWorkspacePage() {
  const params = useParams()
  const claimId = params.id as string

  const [claim, setClaim] = useState<Claim | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDocument, setShowDocument] = useState(false)

  const { pricingState, notFoundIds, refreshPrice } = useClaimPricing(
    (updater) => setClaim((prev) => (prev ? { ...prev, items: updater(prev.items) } : prev))
  )

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

  function handleGenerate() {
    const readiness = getClaimReadiness(claim?.items ?? [])
    if (readiness.canGenerateDocument) setShowDocument(true)
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
    <div className="flex flex-col md:flex-row h-full">
      <div className="flex-1 overflow-auto p-4 md:p-8">
        <ClaimHeader
          claim={claim}
          claimId={claimId}
          onGenerate={handleGenerate}
          generating={showDocument}
        />
        <ClaimItemsTable
          items={claim.items}
          pricingState={pricingState}
          notFoundIds={notFoundIds}
          onRefreshPrice={(item: ClaimItem) => refreshPrice(item)}
          onManualPrice={handleManualPrice}
        />
        {showDocument && (
          <DocumentPanel
            claimId={claimId}
            onClose={() => setShowDocument(false)}
          />
        )}
      </div>
      <AIChatPanel claimId={claimId} />
    </div>
  )
}
