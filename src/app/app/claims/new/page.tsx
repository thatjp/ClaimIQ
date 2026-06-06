'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { US_STATES } from '@/lib/constants'
import { BLANK_ITEM, ExtractedItem } from '@/types/items'
import { useItemExtraction } from '@/lib/hooks/useItemExtraction'
import { ItemReviewTable } from '@/components/ItemReviewTable'

export default function NewClaimPage() {
  const router = useRouter()

  const [state, setState] = useState('CA')
  const [policyType, setPolicyType] = useState('HO-3')
  const [dateOfLoss, setDateOfLoss] = useState(new Date().toISOString().split('T')[0])
  const [claimId, setClaimId] = useState<string | null>(null)
  const [addingItem, setAddingItem] = useState(false)
  const [newItem, setNewItem] = useState<ExtractedItem>(BLANK_ITEM)
  const [submitError, setSubmitError] = useState('')

  const {
    step, setStep, setExtractedItems, extractedItems,
    description, setDescription, error,
    recording, transcribing,
    handleImageChange, startRecording, stopRecording, priceAll,
  } = useItemExtraction()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError('')
    setStep('extracting')
    try {
      const claimRes = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state, policyType, dateOfLoss }),
      })
      if (!claimRes.ok) throw new Error('Failed to create claim')
      const claim = await claimRes.json()
      setClaimId(claim.id)

      const extractRes = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: description }),
      })
      if (!extractRes.ok) throw new Error('Failed to extract items')
      const { items } = await extractRes.json()
      setExtractedItems(items || [])
      setStep('review')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'An error occurred')
      setStep('form')
    }
  }

  async function handleContinue() {
    if (!claimId) return
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
      <div className="p-4 md:p-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Review Extracted Items</h1>
        <p className="text-sm text-gray-500 mb-6">
          {extractedItems.length} item{extractedItems.length !== 1 ? 's' : ''} extracted from your description.
          Add, remove, or price items before proceeding.
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

        <div className="flex flex-col sm:flex-row gap-3">
          {step === 'review' && !addingItem && (
            <button
              onClick={() => setAddingItem(true)}
              className="w-full sm:w-auto border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              + Add Item
            </button>
          )}
          {step === 'review' && (
            <button
              onClick={priceAll}
              disabled={extractedItems.length === 0}
              className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Price All Items
            </button>
          )}
          {step === 'pricing' && (
            <button disabled className="w-full sm:w-auto bg-blue-400 text-white px-4 py-2 rounded-md text-sm font-medium cursor-not-allowed">
              Pricing items...
            </button>
          )}
          <button
            onClick={handleContinue}
            className="w-full sm:w-auto bg-gray-800 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-900 transition-colors"
          >
            Continue to Claim Workspace
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">New Claim</h1>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Claim Details</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {US_STATES.map((s) => (
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Policy Type</label>
              <select
                value={policyType}
                onChange={(e) => setPolicyType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="HO-3">HO-3 (Standard Homeowners)</option>
                <option value="HO-4">HO-4 (Renters)</option>
                <option value="HO-5">HO-5 (Comprehensive)</option>
                <option value="HO-6">HO-6 (Condo)</option>
                <option value="DP-1">DP-1 (Dwelling Fire)</option>
                <option value="DP-3">DP-3 (Special Dwelling)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date of Loss</label>
            <input
              type="date"
              value={dateOfLoss}
              onChange={(e) => setDateOfLoss(e.target.value)}
              required
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Item Description</h2>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Describe damaged or lost items</label>
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
              rows={6}
              required
              placeholder="Example: 65-inch Samsung QLED TV (model QN65Q80C, purchased 2022), KitchenAid stand mixer 5qt Artisan series, MacBook Pro 14-inch 2023 M2 Pro, leather sectional sofa (3 pieces), 2 wool area rugs..."
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
            <p className="text-xs text-gray-400 mt-1">
              Attach a photo of the damaged items for AI-assisted identification.
            </p>
          </div>
        </div>

        {(submitError || error) && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded border border-red-100">
            {submitError || error}
          </p>
        )}

        <button
          type="submit"
          className="bg-blue-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Create Claim &amp; Extract Items
        </button>
      </form>
    </div>
  )
}
