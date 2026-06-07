'use client'

import { useState } from 'react'
import type { ClaimItem } from '@/types/items'

const CATEGORIES = ['electronics', 'appliances', 'furniture', 'clothing', 'jewelry', 'tools', 'other'] as const
const CONDITIONS = ['new', 'good', 'fair', 'poor'] as const

interface Props {
  item: ClaimItem
  onSave: (updates: Partial<ClaimItem>) => Promise<void>
  onCancel: () => void
}

export function ItemEditForm({ item, onSave, onCancel }: Props) {
  const [name, setName] = useState(item.name)
  const [brand, setBrand] = useState(item.brand ?? '')
  const [model, setModel] = useState(item.model ?? '')
  const [category, setCategory] = useState(item.category)
  const [condition, setCondition] = useState(item.condition)
  const [quantity, setQuantity] = useState(String(item.quantity))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return }
    const qty = parseInt(quantity, 10)
    if (isNaN(qty) || qty < 1) { setError('Quantity must be at least 1'); return }

    setSaving(true)
    setError('')
    try {
      await onSave({
        name: name.trim(),
        brand: brand.trim() || undefined,
        model: model.trim() || undefined,
        category,
        condition,
        quantity: qty,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
      setSaving(false)
    }
  }

  const inputClass = 'w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400'
  const labelClass = 'block text-xs font-medium text-gray-500 mb-1'

  return (
    <div className="px-4 py-3 bg-blue-50 border-t border-blue-100">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
        <div className="col-span-2 md:col-span-3">
          <label className={labelClass}>Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            autoFocus
          />
        </div>

        <div>
          <label className={labelClass}>Brand</label>
          <input
            type="text"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Optional"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Model</label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Optional"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Quantity</label>
          <input
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Condition</label>
          <select value={condition} onChange={(e) => setCondition(e.target.value)} className={inputClass}>
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save & re-price'}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="text-xs px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
        >
          Cancel
        </button>
        <span className="text-xs text-gray-400 ml-1">Price and approval will reset if identity fields change</span>
      </div>
    </div>
  )
}
