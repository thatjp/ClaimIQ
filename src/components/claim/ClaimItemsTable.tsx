'use client'

import { useState, useRef, useEffect } from 'react'
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
    ebay:               { label: 'eBay',            className: 'text-yellow-600', icon: '🛒', title: 'Retrieved via eBay sold listings' },
    amazon:             { label: 'Amazon',          className: 'text-orange-600', icon: '📦', title: 'Retrieved via Amazon (SerpAPI)' },
    walmart:            { label: 'Walmart',         className: 'text-blue-500',   icon: '🏪', title: 'Retrieved via Walmart (SerpAPI)' },
    home_depot:         { label: 'Home Depot',      className: 'text-orange-700', icon: '🔨', title: 'Retrieved via Home Depot (SerpAPI)' },
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
    { label: 'Google',  url: `https://www.google.com/search?q=${q}+replacement+cost` },
    { label: 'Amazon',  url: `https://www.amazon.com/s?k=${q}` },
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

type SortOrder = 'none' | 'asc' | 'desc'

const PAGE_SIZE = 10

interface Props {
  items: ClaimItem[]
  pricingState: PricingState | null
  onRefreshPrice: (item: ClaimItem) => void
  onManualPrice: (item: ClaimItem, price: number, sourceUrl?: string) => Promise<void>
  onApprovalChange: (itemId: string, approved: boolean) => Promise<void>
  onDeleteItems: (itemIds: string[]) => Promise<void>
  onGenerateForItems: (itemIds: string[]) => void
}

export function ClaimItemsTable({
  items,
  pricingState,
  onRefreshPrice,
  onManualPrice,
  onApprovalChange,
  onDeleteItems,
  onGenerateForItems,
}: Props) {
  const active = pricingState

  const [filterFlagged, setFilterFlagged] = useState(false)
  const [sortOrder, setSortOrder] = useState<SortOrder>('none')
  const [page, setPage] = useState(1)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { setPage(1) }, [filterFlagged, sortOrder])

  const seenIds = useRef<Set<string>>(new Set())
  const seenPrices = useRef<Set<string>>(new Set())
  useEffect(() => {
    items.forEach((item) => {
      seenIds.current.add(item.id)
      if (item.price != null) seenPrices.current.add(item.id)
    })
  })

  // Filter → sort → paginate
  const filtered = filterFlagged ? items.filter((i) => i.flagged) : items
  const sorted = sortOrder === 'none' ? filtered : [...filtered].sort((a, b) => {
    const pa = a.price ?? -1
    const pb = b.price ?? -1
    return sortOrder === 'asc' ? pa - pb : pb - pa
  })
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Selection is derived from approval — approved items are the selected set
  const approvedIds = items.filter((i) => i.approved).map((i) => i.id)
  const approvedTotal = items.filter((i) => i.approved).reduce((sum, i) => sum + (i.price || 0) * i.quantity, 0)

  const approvableItems = items.filter(canApproveItem)
  const pageApprovable = paginated.filter(canApproveItem)
  const allPageApproved = pageApprovable.length > 0 && pageApprovable.every((i) => i.approved)
  const somePageApproved = pageApprovable.some((i) => i.approved)

  async function handleSelectAll(checked: boolean) {
    await Promise.allSettled(
      pageApprovable
        .filter((i) => !!i.approved !== checked)
        .map((i) => onApprovalChange(i.id, checked))
    )
  }

  async function handleBulkDelete() {
    if (approvedIds.length === 0) return
    setDeleting(true)
    try {
      await onDeleteItems(approvedIds)
    } finally {
      setDeleting(false)
    }
  }

  function handleBulkGenerate() {
    if (approvedIds.length === 0) return
    onGenerateForItems(approvedIds)
  }

  function rowClass(item: ClaimItem) {
    const isNew = !seenIds.current.has(item.id)
    const base = item.flagged ? 'bg-amber-50' : item.approved ? 'bg-green-50' : 'hover:bg-gray-50'
    return isNew ? `${base} row-enter` : base
  }

  function priceKey(item: ClaimItem) {
    return item.price != null ? `price-${item.id}-${item.price}` : `no-price-${item.id}`
  }

  function priceClass(item: ClaimItem) {
    return item.price != null && !seenPrices.current.has(item.id) ? 'price-enter' : ''
  }

  const flaggedCount = items.filter((i) => i.flagged).length

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-3 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-700">
            Line Items ({filtered.length}{filterFlagged ? ` of ${items.length}` : ''})
          </h2>
          {flaggedCount > 0 && (
            <button
              onClick={() => setFilterFlagged((f) => !f)}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors ${
                filterFlagged
                  ? 'bg-amber-100 border-amber-300 text-amber-700'
                  : 'bg-white border-gray-200 text-gray-500 hover:border-amber-300 hover:text-amber-600'
              }`}
            >
              ⚠ {flaggedCount} flagged{filterFlagged ? ' · clear' : ''}
            </button>
          )}
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <span>Sort:</span>
            <button
              onClick={() => setSortOrder((s) => s === 'desc' ? 'none' : 'desc')}
              className={`px-2 py-0.5 rounded border transition-colors ${sortOrder === 'desc' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 hover:border-gray-300'}`}
            >
              $ High
            </button>
            <button
              onClick={() => setSortOrder((s) => s === 'asc' ? 'none' : 'asc')}
              className={`px-2 py-0.5 rounded border transition-colors ${sortOrder === 'asc' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 hover:border-gray-300'}`}
            >
              $ Low
            </button>
          </div>
        </div>
        {approvedTotal > 0 && (
          <span className="text-sm font-semibold text-gray-900">
            Approved: ${approvedTotal.toLocaleString()}
          </span>
        )}
      </div>

      {/* Bulk action bar — shown when any items are approved */}
      {approvedIds.length > 0 && (
        <div className="px-4 py-2 bg-green-50 border-b border-green-100 flex items-center justify-between">
          <span className="text-xs text-green-700 font-medium">{approvedIds.length} item{approvedIds.length > 1 ? 's' : ''} selected</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkGenerate}
              className="text-xs px-3 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Generate document
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={deleting}
              className="text-xs px-3 py-1 rounded-md bg-white border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Delete selected'}
            </button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm text-gray-400">No items added yet.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm text-gray-400">No flagged items.</p>
          <button onClick={() => setFilterFlagged(false)} className="text-xs text-blue-600 hover:underline mt-1">Clear filter</button>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-2.5 w-10">
                    <input
                      type="checkbox"
                      checked={allPageApproved}
                      ref={(el) => { if (el) el.indeterminate = somePageApproved && !allPageApproved }}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      disabled={approvableItems.length === 0}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                      title="Approve all priced items on this page"
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
                {paginated.map((item) => {
                  const pricing = active?.id === item.id
                  const approvable = canApproveItem(item)
                  return (
                    <tr key={item.id} className={rowClass(item)}>
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
                          <div className="text-xs text-amber-600 mt-0.5">⚠ {item.flag_reason}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 capitalize text-gray-700">{item.condition}</td>
                      <td className="px-4 py-3 text-gray-700">{item.quantity}</td>
                      <td className="px-4 py-3">
                        {item.price ? (
                          <div key={priceKey(item)} className={priceClass(item)}>
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
                          {pricing ? `${active.strategy}...` : 'Refresh'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {approvedTotal > 0 && (
                <tfoot>
                  <tr className="border-t border-gray-200 bg-gray-50">
                    <td colSpan={4} className="px-4 py-3 text-sm font-medium text-gray-700 text-right">
                      Approved total:
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">${approvedTotal.toLocaleString()}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden divide-y divide-gray-100">
            {paginated.map((item) => {
              const pricing = active?.id === item.id
              const approvable = canApproveItem(item)
              return (
                <div key={item.id} className={`px-4 py-3 row-enter ${item.flagged ? 'bg-amber-50' : item.approved ? 'bg-green-50' : ''}`}>
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
                            <div className="text-xs text-amber-600 mt-0.5">⚠ {item.flag_reason}</div>
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
                            <span key={priceKey(item)} className={`font-semibold text-gray-900 text-sm ${priceClass(item)}`}>
                              ${item.price.toLocaleString()}
                            </span>
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ‹
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-2 py-1 rounded border transition-colors ${p === page ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:bg-gray-50'}`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ›
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
