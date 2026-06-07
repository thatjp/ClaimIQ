'use client'

import { useState } from 'react'
import type { ClaimItem } from '@/types/items'
import type { PricingState } from '@/lib/hooks/useClaimPricing'
import { canApproveItem } from '@/lib/claims/grounding'

function SourceLinks({ sources }: { sources?: string[] | null }) {
  if (!sources || sources.length === 0) return <span className="text-gray-300 text-xs">—</span>
  const [first, ...rest] = sources
  let domain = first
  try { domain = new URL(first).hostname.replace('www.', '') } catch { /* keep raw */ }
  return (
    <div className="text-xs">
      <a href={first} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
        {domain} ↗
      </a>
      {rest.length > 0 && <span className="text-gray-400 ml-1">+{rest.length}</span>}
    </div>
  )
}

function PriceSourceBadge({ source }: { source: ClaimItem['priceSource'] }) {
  const config: Record<string, { label: string; className: string; title: string; icon: string }> = {
    kv_cache:           { label: 'KV Cache',        className: 'text-blue-600',   icon: '⚡', title: 'Exact match from Redis cache (7-day TTL)' },
    vector_cache:       { label: 'Vector Cache',    className: 'text-purple-600', icon: '🔮', title: 'Semantic match from pgvector (90-day TTL)' },
    vector_cache_stale: { label: 'Stale Cache',     className: 'text-orange-500', icon: '⏳', title: 'Semantic match older than 90 days — may not reflect current market price' },
    ebay:               { label: 'eBay Sold',       className: 'text-yellow-600', icon: '🛒', title: 'Average of recent sold listings via eBay Finding API' },
    serp:               { label: 'Google Shopping', className: 'text-green-600',  icon: '🔍', title: 'Retrieved via Google Shopping (SerpAPI)' },
    manual:             { label: 'Manual Entry',    className: 'text-gray-500',   icon: '✏️', title: 'Price entered manually by adjuster' },
  }
  const c = config[source!]
  if (!c) return null
  return (
    <div className={`text-xs mt-0.5 font-medium ${c.className}`} title={c.title}>
      {c.icon} {c.label}
    </div>
  )
}

function buildSearchLinks(item: ClaimItem) {
  const q = encodeURIComponent([item.name, item.brand, item.model].filter(Boolean).join(' '))
  return [
    { label: 'Google', url: `https://www.google.com/search?q=${q}+replacement+cost` },
    { label: 'Amazon', url: `https://www.amazon.com/s?k=${q}` },
    { label: 'eBay',   url: `https://www.ebay.com/sch/i.html?_nkw=${q}` },
    { label: 'Walmart', url: `https://www.walmart.com/search?q=${q}` },
  ]
}

function ManualPriceInput({
  item,
  onSave,
}: {
  item: ClaimItem
  onSave: (item: ClaimItem, price: number, sourceUrl?: string) => Promise<void>
}) {
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

interface Props {
  items: ClaimItem[]
  pricingState: PricingState | null
  onRefreshPrice: (item: ClaimItem) => void
  onManualPrice: (item: ClaimItem, price: number, sourceUrl?: string) => Promise<void>
  onApprovalChange: (itemId: string, approved: boolean) => Promise<void>
}

export function ClaimItemsTable({ items, pricingState, onRefreshPrice, onManualPrice, onApprovalChange }: Props) {
  const active = pricingState
  const total = items.filter((i) => i.approved).reduce((sum, i) => sum + (i.price || 0) * i.quantity, 0)

  const approvableItems = items.filter(canApproveItem)
  const allApproved = approvableItems.length > 0 && approvableItems.every((i) => i.approved)
  const someApproved = approvableItems.some((i) => i.approved)
  const indeterminate = someApproved && !allApproved

  async function handleSelectAll(checked: boolean) {
    await Promise.allSettled(
      approvableItems
        .filter((i) => !!i.approved !== checked)
        .map((i) => onApprovalChange(i.id, checked))
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Line Items ({items.length})</h2>
        {total > 0 && (
          <span className="text-sm font-semibold text-gray-900">
            Approved total: ${total.toLocaleString()}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm text-gray-400">No items added yet.</p>
        </div>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="md:hidden divide-y divide-gray-100">
            {items.map((item) => {
              const pricing = active?.id === item.id
              const approvable = canApproveItem(item)
              return (
                <div key={item.id} className={`px-4 py-3 ${item.flagged ? 'bg-red-50' : item.approved ? 'bg-green-50' : ''}`}>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={!!item.approved}
                      disabled={!approvable}
                      onChange={(e) => onApprovalChange(item.id, e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                      title={approvable ? 'Approve item' : 'Add price and source URL to approve'}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 text-sm truncate">{item.name}</div>
                          {(item.brand || item.model) && (
                            <div className="text-xs text-gray-500">{[item.brand, item.model].filter(Boolean).join(' ')}</div>
                          )}
                          {item.flagged && item.flag_reason && (
                            <div className="text-xs text-red-600 mt-0.5">⚠ {item.flag_reason}</div>
                          )}
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
                            <span className="capitalize">{item.condition}</span>
                            <span>Qty {item.quantity}</span>
                          </div>
                          {item.price ? (
                            <div className="mt-1">
                              {item.priceSource && <PriceSourceBadge source={item.priceSource} />}
                              <SourceLinks sources={item.price_sources} />
                            </div>
                          ) : (
                            <ManualPriceInput item={item} onSave={onManualPrice} />
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          {item.price ? (
                            <span className="font-semibold text-gray-900 text-sm">${item.price.toLocaleString()}</span>
                          ) : (
                            <span className="text-gray-400 text-xs">{pricing ? active.strategy + '...' : 'Pending'}</span>
                          )}
                          <button
                            onClick={() => onRefreshPrice(item)}
                            disabled={pricing}
                            className="text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50"
                          >
                            {pricing ? `${active.strategy}...` : 'Refresh'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-2.5 w-10">
                    <input
                      type="checkbox"
                      checked={allApproved}
                      ref={(el) => { if (el) el.indeterminate = indeterminate }}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      disabled={approvableItems.length === 0}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                      title="Approve all priced items"
                    />
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Item</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Condition</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Qty</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase">Price / Source</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => {
                  const pricing = active?.id === item.id
                  const approvable = canApproveItem(item)
                  return (
                    <tr
                      key={item.id}
                      className={
                        item.flagged ? 'bg-red-50' :
                        item.approved ? 'bg-green-50' :
                        'hover:bg-gray-50'
                      }
                    >
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={!!item.approved}
                          disabled={!approvable}
                          onChange={(e) => onApprovalChange(item.id, e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                          title={approvable ? 'Approve item' : 'Add price and source URL to approve'}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{item.name}</div>
                        {(item.brand || item.model) && (
                          <div className="text-xs text-gray-500">{[item.brand, item.model].filter(Boolean).join(' ')}</div>
                        )}
                        {item.flagged && item.flag_reason && (
                          <div className="text-xs text-red-600 mt-0.5">Flagged: {item.flag_reason}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 capitalize text-gray-700">{item.condition}</td>
                      <td className="px-4 py-3 text-gray-700">{item.quantity}</td>
                      <td className="px-4 py-3">
                        {item.price ? (
                          <div>
                            <span className="font-medium text-gray-900">${item.price.toLocaleString()}</span>
                            {item.priceSource && <PriceSourceBadge source={item.priceSource} />}
                            <SourceLinks sources={item.price_sources} />
                          </div>
                        ) : (
                          <>
                            <span className="text-gray-400 text-xs block mb-1">
                              {pricing ? `${active.strategy}...` : 'Not priced'}
                            </span>
                            <ManualPriceInput item={item} onSave={onManualPrice} />
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => onRefreshPrice(item)}
                          disabled={pricing}
                          className="text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50 whitespace-nowrap"
                        >
                          {pricing ? `${active.strategy}...` : 'Refresh Price'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {total > 0 && (
                <tfoot>
                  <tr className="border-t border-gray-200 bg-gray-50">
                    <td colSpan={4} className="px-4 py-3 text-sm font-medium text-gray-700 text-right">
                      Approved total:
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">${total.toLocaleString()}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </div>
  )
}
