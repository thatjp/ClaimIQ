'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' }, { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
]

interface ExtractedItem {
  name: string
  brand?: string
  model?: string
  category: string
  condition: string
  estimatedAge?: number
  quantity: number
  adjusterNotes?: string
  price?: number
  priceStatus?: 'pending' | 'found' | 'error'
  workflowRunId?: string
}

export default function NewClaimPage() {
  const router = useRouter()

  const [state, setState] = useState('CA')
  const [policyType, setPolicyType] = useState('HO-3')
  const [dateOfLoss, setDateOfLoss] = useState('')
  const [description, setDescription] = useState('')
  const [imageBase64, setImageBase64] = useState<string | null>(null)

  const [step, setStep] = useState<'form' | 'extracting' | 'review' | 'pricing' | 'done'>('form')
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([])
  const [claimId, setClaimId] = useState<string | null>(null)
  const [error, setError] = useState('')

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = ev.target?.result as string
      // Strip data URL prefix for the API
      setImageBase64(result.split(',')[1])
    }
    reader.readAsDataURL(file)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setStep('extracting')

    try {
      // Create the claim
      const claimRes = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state, policyType, dateOfLoss }),
      })

      if (!claimRes.ok) {
        throw new Error('Failed to create claim')
      }

      const claim = await claimRes.json()
      setClaimId(claim.id)

      // Extract items from description
      const extractRes = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: description, imageBase64 }),
      })

      if (!extractRes.ok) {
        throw new Error('Failed to extract items')
      }

      const { items } = await extractRes.json()
      setExtractedItems(items || [])
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setStep('form')
    }
  }

  async function pollForPrice(runId: string): Promise<number | null> {
    const maxAttempts = 30
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000))
      try {
        const res = await fetch(`/api/price/${runId}`)
        if (!res.ok) return null
        const data = await res.json()
        if (data.status === 'completed' && data.price) return data.price
        if (data.status === 'failed') return null
      } catch {
        return null
      }
    }
    return null
  }

  async function handlePriceAll() {
    setStep('pricing')

    const updatedItems = [...extractedItems]

    await Promise.all(
      updatedItems.map(async (item, i) => {
        try {
          const res = await fetch('/api/price', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item }),
          })
          const data = await res.json()

          if (data.price) {
            updatedItems[i] = { ...item, price: data.price, priceStatus: 'found' }
          } else if (data.workflowRunId) {
            updatedItems[i] = { ...item, priceStatus: 'pending', workflowRunId: data.workflowRunId }
            setExtractedItems([...updatedItems])
            const price = await pollForPrice(data.workflowRunId)
            updatedItems[i] = price
              ? { ...item, price, priceStatus: 'found' }
              : { ...item, priceStatus: 'error' }
          } else {
            updatedItems[i] = { ...item, priceStatus: 'error' }
          }
        } catch {
          updatedItems[i] = { ...item, priceStatus: 'error' }
        }
        setExtractedItems([...updatedItems])
      })
    )

    setStep('done')
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
      // proceed anyway — items can be added in the workspace
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
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Review Extracted Items</h1>
        <p className="text-sm text-gray-500 mb-6">
          {extractedItems.length} item{extractedItems.length !== 1 ? 's' : ''} extracted from your description.
          Review and price before proceeding.
        </p>

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Item</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Condition</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Age (yrs)</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Qty</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {extractedItems.map((item, i) => (
                <tr key={i}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{item.name}</div>
                    {(item.brand || item.model) && (
                      <div className="text-xs text-gray-500">
                        {[item.brand, item.model].filter(Boolean).join(' ')}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700 capitalize">{item.category}</td>
                  <td className="px-4 py-3 text-gray-700 capitalize">{item.condition}</td>
                  <td className="px-4 py-3 text-gray-700">{item.estimatedAge ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{item.quantity}</td>
                  <td className="px-4 py-3">
                    {item.priceStatus === 'pending' && (
                      <span className="text-yellow-600 text-xs">Pricing...</span>
                    )}
                    {item.priceStatus === 'found' && item.price && (
                      <span className="text-green-700 font-medium">${item.price.toLocaleString()}</span>
                    )}
                    {item.priceStatus === 'error' && (
                      <span className="text-red-500 text-xs">Error</span>
                    )}
                    {!item.priceStatus && (
                      <span className="text-gray-400 text-xs">Not priced</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex gap-3">
          {step === 'review' && (
            <button
              onClick={handlePriceAll}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
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
            onClick={handleContinue}
            className="bg-gray-800 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-900 transition-colors"
          >
            Continue to Claim Workspace
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">New Claim</h1>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Claim Details
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {US_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
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
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Item Description
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Describe damaged or lost items
            </label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Photo (optional)
            </label>
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

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded border border-red-100">
            {error}
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
