'use client'

import { useState } from 'react'
import type { ClaimItem } from '@/types/items'

function buildSearchLinks(item: ClaimItem) {
  const q = encodeURIComponent([item.name, item.brand, item.model].filter(Boolean).join(' '))
  return [
    { label: 'Google',  url: `https://www.google.com/search?q=${q}+replacement+cost` },
    { label: 'Amazon',  url: `https://www.amazon.com/s?k=${q}` },
    { label: 'Walmart', url: `https://www.walmart.com/search?q=${q}` },
  ]
}

interface Props {
  item: ClaimItem
  onSave: (item: ClaimItem, price: number, sourceUrl?: string) => Promise<void>
}

export function ManualPriceInput({ item, onSave }: Props) {
  const [price, setPrice] = useState('')
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const parsed = parseFloat(price)
    if (isNaN(parsed) || parsed <= 0) return
    setSaving(true)
    try {
      await onSave(item, parsed, url.trim() || undefined)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 space-y-1">
      <p className="text-xs text-amber-700 font-medium">Not found — search and enter manually:</p>
      <div className="flex flex-wrap gap-1 mb-1.5">
        {buildSearchLinks(item).map(({ label, url: href }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-2 py-0.5 rounded border border-gray-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-colors"
          >
            {label} ↗
          </a>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-400">$</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          placeholder="Price"
          className="w-20 text-xs border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <button
          onClick={handleSave}
          disabled={saving || !price}
          className="text-xs text-blue-600 hover:text-blue-700 disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Paste source URL"
        className="w-full text-xs border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
    </div>
  )
}
