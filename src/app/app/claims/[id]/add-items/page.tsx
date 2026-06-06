'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { BLANK_ITEM } from '@/types/items'
import { useItemExtraction } from '@/lib/hooks/useItemExtraction'
import { ItemReviewTable } from '@/components/ItemReviewTable'

export default function AddItemsPage() {
  const router = useRouter()
  const params = useParams()
  const claimId = params.id as string

  const [addingItem, setAddingItem] = useState(false)
  const [newItem, setNewItem] = useState(BLANK_ITEM)

  const {
    step, setExtractedItems, extractedItems,
    description, setDescription, error,
    recording, transcribing,
    handleImageChange, startRecording, stopRecording,
    extract, priceAll,
  } = useItemExtraction()

  async function handleExtract(e: React.FormEvent) {
    e.preventDefault()
    await extract()
  }

  async function handleSave() {
    try {
      await fetch(`/api/claims/${claimId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: extractedItems }),
      })
    } catch {
      // proceed anyway
    }
    router.push(`/app/claims/${claimId}`)
  }

  if (step === 'extracting') {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-64">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mb-4" />
        <p className="text-gray-600 text-sm">Extracting items from description...</p>
      </div>
    )
  }

  if (step === 'review' || step === 'pricing' || step === 'done') {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Review New Items</h1>
        <p className="text-sm text-gray-500 mb-6">
          {extractedItems.length} item{extractedItems.length !== 1 ? 's' : ''} extracted. Add, remove, or price before saving to the claim.
        </p>

        <ItemReviewTable
          items={extractedItems}
          step={step}
          addingItem={addingItem}
          newItem={newItem}
          onRemove={(i) => setExtractedItems((prev) => prev.filter((_, idx) => idx !== i))}
          onNewItemChange={setNewItem}
          onAddConfirm={() => {
            if (!newItem.name.trim()) return
            setExtractedItems((prev) => [...prev, { ...newItem }])
            setNewItem(BLANK_ITEM)
            setAddingItem(false)
          }}
          onAddCancel={() => { setAddingItem(false); setNewItem(BLANK_ITEM) }}
        />

        <div className="flex gap-3 flex-wrap">
          {step === 'review' && !addingItem && (
            <button
              onClick={() => setAddingItem(true)}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              + Add Item
            </button>
          )}
          {step === 'review' && (
            <button
              onClick={priceAll}
              disabled={extractedItems.length === 0}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Price All Items
            </button>
          )}
          {step === 'pricing' && (
            <button disabled className="bg-blue-400 text-white px-4 py-2 rounded-md text-sm font-medium cursor-not-allowed">
              Pricing items...
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={extractedItems.length === 0}
            className="bg-gray-800 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-900 disabled:opacity-50 transition-colors"
          >
            Save to Claim
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Add Items</h1>
      <p className="text-sm text-gray-500 mb-6">Describe additional items to add to this claim.</p>

      <form onSubmit={handleExtract} className="space-y-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Describe additional items</label>
              <button
                type="button"
                onClick={recording ? stopRecording : startRecording}
                disabled={transcribing}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  recording
                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                    : transcribing
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${recording ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`} />
                {recording ? 'Stop recording' : transcribing ? 'Transcribing...' : 'Record'}
              </button>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              required
              placeholder="Example: Dyson V15 vacuum, Weber grill, two mountain bikes..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Photo (optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded border border-red-100">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push(`/app/claims/${claimId}`)}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Extract Items
          </button>
        </div>
      </form>
    </div>
  )
}
