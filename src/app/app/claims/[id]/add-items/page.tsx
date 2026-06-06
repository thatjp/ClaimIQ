'use client'

import { useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'

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

const BLANK_ITEM: ExtractedItem = {
  name: '',
  brand: '',
  model: '',
  category: 'other',
  condition: 'good',
  estimatedAge: undefined,
  quantity: 1,
}

export default function AddItemsPage() {
  const router = useRouter()
  const params = useParams()
  const claimId = params.id as string

  const [description, setDescription] = useState('')
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [step, setStep] = useState<'form' | 'extracting' | 'review' | 'pricing' | 'done'>('form')
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([])
  const [addingItem, setAddingItem] = useState(false)
  const [newItem, setNewItem] = useState<ExtractedItem>(BLANK_ITEM)
  const [error, setError] = useState('')
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = ev.target?.result as string
      setImageBase64(result.split(',')[1])
    }
    reader.readAsDataURL(file)
  }

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mediaRecorder = new MediaRecorder(stream)
    audioChunksRef.current = []
    mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data)
    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop())
      setTranscribing(true)
      try {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const formData = new FormData()
        formData.append('audio', blob, 'recording.webm')
        const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
        if (res.ok) {
          const { text } = await res.json()
          setDescription((prev) => (prev ? prev + ' ' + text : text))
        }
      } finally {
        setTranscribing(false)
      }
    }
    mediaRecorderRef.current = mediaRecorder
    mediaRecorder.start()
    setRecording(true)
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  async function handleExtract(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setStep('extracting')
    try {
      const extractRes = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: description, imageBase64 }),
      })
      if (!extractRes.ok) throw new Error('Failed to extract items')
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
                <th className="px-4 py-3"></th>
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
                    {item.priceStatus === 'pending' && <span className="text-yellow-600 text-xs">Pricing...</span>}
                    {item.priceStatus === 'found' && item.price && <span className="text-green-700 font-medium">${item.price.toLocaleString()}</span>}
                    {item.priceStatus === 'error' && <span className="text-red-500 text-xs">Error</span>}
                    {!item.priceStatus && <span className="text-gray-400 text-xs">Not priced</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {step === 'review' && (
                      <button
                        onClick={() => setExtractedItems((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}

              {addingItem && (
                <tr className="bg-blue-50">
                  <td className="px-4 py-3">
                    <input
                      autoFocus
                      placeholder="Item name *"
                      value={newItem.name}
                      onChange={(e) => setNewItem((p) => ({ ...p, name: e.target.value }))}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm mb-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <input
                      placeholder="Brand"
                      value={newItem.brand ?? ''}
                      onChange={(e) => setNewItem((p) => ({ ...p, brand: e.target.value }))}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={newItem.category}
                      onChange={(e) => setNewItem((p) => ({ ...p, category: e.target.value }))}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {['electronics','appliances','furniture','clothing','jewelry','tools','other'].map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={newItem.condition}
                      onChange={(e) => setNewItem((p) => ({ ...p, condition: e.target.value }))}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {['new','good','fair','poor'].map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0}
                      placeholder="—"
                      value={newItem.estimatedAge ?? ''}
                      onChange={(e) => setNewItem((p) => ({ ...p, estimatedAge: e.target.value ? Number(e.target.value) : undefined }))}
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={1}
                      value={newItem.quantity}
                      onChange={(e) => setNewItem((p) => ({ ...p, quantity: Number(e.target.value) }))}
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">—</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => {
                          if (!newItem.name.trim()) return
                          setExtractedItems((prev) => [...prev, { ...newItem }])
                          setNewItem(BLANK_ITEM)
                          setAddingItem(false)
                        }}
                        className="text-xs text-blue-600 font-medium hover:text-blue-700"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => { setAddingItem(false); setNewItem(BLANK_ITEM) }}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

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
              onClick={handlePriceAll}
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
              <label className="block text-sm font-medium text-gray-700">
                Describe additional items
              </label>
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
