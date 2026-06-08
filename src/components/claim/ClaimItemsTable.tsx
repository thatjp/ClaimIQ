'use client'

import React, { useState, useRef, useEffect } from 'react'
import type { ClaimItem } from '@/types/items'
import type { PricingState } from '@/lib/hooks/useClaimPricing'
import { canApproveItem } from '@/lib/claims/grounding'
import { PriceSourceBadge, SourceLinks } from './PriceSourceBadge'
import { ItemEditForm } from './ItemEditForm'
import { FlaggedItemResolver } from './FlaggedItemResolver'
import type { ItemSuggestion } from '@/lib/ai/resolver-types'

type SortOrder = 'none' | 'asc' | 'desc'

const PAGE_SIZE = 10

export interface ClaimItemsTableProps {
  claimId: string
  items: ClaimItem[]
  pricingState: PricingState | null
  onApprovalChange: (itemId: string, approved: boolean) => Promise<void>
  onDeleteItems: (itemIds: string[]) => Promise<void>
  onGenerateForItems: (itemIds: string[]) => void
  onEditItem: (itemId: string, updates: Partial<ClaimItem>) => Promise<void>
  onApplySuggestion: (item: ClaimItem, suggestion: ItemSuggestion) => Promise<void>
}

// --- Sub-components ---

function ItemName({ item }: { item: ClaimItem }) {
  return (
    <>
      <div className="font-medium text-gray-900">{item.name}</div>
      {(item.brand || item.model) && (
        <div className="text-xs text-gray-500">{[item.brand, item.model].filter(Boolean).join(' ')}</div>
      )}
      {item.flagged && item.flag_reason && (
        <div className="text-xs text-amber-600 mt-0.5">⚠ {item.flag_reason}</div>
      )}
    </>
  )
}

function PriceCell({
  item,
  pricing,
  strategy,
  priceKey,
  priceClass,
}: {
  item: ClaimItem
  pricing: boolean
  strategy: string | undefined
  priceKey: string
  priceClass: string
}) {
  if (item.price) {
    return (
      <div key={priceKey} className={priceClass}>
        <span className="font-medium text-gray-900">${item.price.toLocaleString()}</span>
        {item.priceSource && <PriceSourceBadge source={item.priceSource} />}
        <SourceLinks sources={item.price_sources} />
      </div>
    )
  }
  if (pricing) {
    return (
      <span className="text-yellow-600 text-xs flex items-center gap-1.5">
        <span className="inline-block w-2.5 h-2.5 border border-yellow-500 border-t-transparent rounded-full animate-spin shrink-0" />
        {strategy}…
      </span>
    )
  }
  return <span className="text-xs text-gray-400">no source found</span>
}

// --- Main component ---

export function ClaimItemsTable({
  claimId,
  items,
  pricingState,
  onApprovalChange,
  onDeleteItems,
  onGenerateForItems,
  onEditItem,
  onApplySuggestion,
}: ClaimItemsTableProps) {
  const active = pricingState

  const [filterFlagged, setFilterFlagged] = useState(false)
  const [sortOrder, setSortOrder] = useState<SortOrder>('none')
  const [page, setPage] = useState(1)
  const [deleting, setDeleting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [mountedEditId, setMountedEditId] = useState<string | null>(null)

  function openEdit(id: string) {
    setMountedEditId(id)
    setEditingId(id)
  }

  function closeEdit() {
    setEditingId(null)
    // Keep form mounted for 300ms so the collapse animation plays out
    setTimeout(() => setMountedEditId(null), 300)
  }

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

  const flaggedCount = items.filter((i) => i.flagged).length

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

      {/* Bulk action bar */}
      {approvedIds.length > 0 && (
        <div className="px-4 py-2 bg-green-50 border-b border-green-100 flex items-center justify-between">
          <span className="text-xs text-green-700 font-medium">
            {approvedIds.length} item{approvedIds.length > 1 ? 's' : ''} selected
          </span>
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

      {/* Empty states */}
      {items.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm text-gray-400">No items added yet.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm text-gray-400">No flagged items.</p>
          <button onClick={() => setFilterFlagged(false)} className="text-xs text-blue-600 hover:underline mt-1">
            Clear filter
          </button>
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
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginated.map((item) => {
                  const pricing = active?.id === item.id
                  const approvable = canApproveItem(item)
                  const isEditing = editingId === item.id
                  return (
                    <React.Fragment key={item.id}>
                      <tr
                        className={`${rowClass(item)} cursor-pointer`}
                        onClick={() => isEditing ? closeEdit() : openEdit(item.id)}
                      >
                        <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={!!item.approved}
                            disabled={!approvable}
                            onChange={(e) => onApprovalChange(item.id, e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                            title={approvable ? 'Approve item' : 'Add price and source URL to approve'}
                          />
                        </td>
                        <td className="px-4 py-3"><ItemName item={item} /></td>
                        <td className="px-4 py-3 capitalize text-gray-700">{item.condition}</td>
                        <td className="px-4 py-3 text-gray-700">{item.quantity}</td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <PriceCell
                            item={item}
                            pricing={pricing}
                            strategy={active?.strategy}
                            priceKey={priceKey(item)}
                            priceClass={priceClass(item)}
                          />
                        </td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => isEditing ? closeEdit() : openEdit(item.id)}
                            className="text-xs text-gray-400 hover:text-gray-600"
                          >
                            {isEditing ? 'Close' : 'Edit'}
                          </button>
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={6} className="p-0 border-0">
                          <div className={`edit-form-expand ${isEditing ? 'is-open' : ''}`}>
                            <div className="edit-form-expand-inner">
                              {mountedEditId === item.id && (
                                <div className="edit-form-enter">
                                  {item.flagged && (
                                    <FlaggedItemResolver
                                      claimId={claimId}
                                      item={item}
                                      onApply={(suggestion) => onApplySuggestion(item, suggestion)}
                                    />
                                  )}
                                  <ItemEditForm
                                    item={item}
                                    onSave={async (updates) => {
                                      await onEditItem(item.id, updates)
                                      closeEdit()
                                    }}
                                    onCancel={closeEdit}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
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
              const isEditing = editingId === item.id
              return (
                <div key={item.id}>
                  <div
                    className={`px-4 py-3 row-enter ${item.flagged ? 'bg-amber-50' : item.approved ? 'bg-green-50' : ''}`}
                    onClick={() => isEditing ? closeEdit() : openEdit(item.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={!!item.approved}
                          disabled={!approvable}
                          onChange={(e) => onApprovalChange(item.id, e.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                          title={approvable ? 'Approve item' : 'Add price and source URL to approve'}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <ItemName item={item} />
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
                              <span className="capitalize">{item.condition}</span>
                              <span>Qty {item.quantity}</span>
                            </div>
                            {!isEditing && item.price && (
                              <div className="mt-1">
                                {item.priceSource && <PriceSourceBadge source={item.priceSource} />}
                                <SourceLinks sources={item.price_sources} />
                              </div>
                            )}
                            {!isEditing && !item.price && !pricing && (
                              <p className="mt-1 text-xs text-gray-400">no source found</p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                            {item.price ? (
                              <span
                                key={priceKey(item)}
                                className={`font-semibold text-gray-900 text-sm ${priceClass(item)}`}
                              >
                                ${item.price.toLocaleString()}
                              </span>
                            ) : pricing ? (
                              <span className="text-yellow-600 text-xs flex items-center gap-1.5">
                                <span className="inline-block w-2.5 h-2.5 border border-yellow-500 border-t-transparent rounded-full animate-spin shrink-0" />
                                {active.strategy}…
                              </span>
                            ) : null}
                            <button
                              onClick={() => isEditing ? closeEdit() : openEdit(item.id)}
                              className="text-xs text-gray-400 hover:text-gray-600"
                            >
                              {isEditing ? 'Close' : 'Edit'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className={`edit-form-expand ${isEditing ? 'is-open' : ''}`}>
                    <div className="edit-form-expand-inner">
                      {mountedEditId === item.id && (
                        <div className="edit-form-enter">
                          {item.flagged && (
                            <FlaggedItemResolver
                              claimId={claimId}
                              item={item}
                              onApply={(suggestion) => onApplySuggestion(item, suggestion)}
                            />
                          )}
                          <ItemEditForm
                            item={item}
                            onSave={async (updates) => {
                              await onEditItem(item.id, updates)
                              closeEdit()
                            }}
                            onCancel={closeEdit}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
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
                    className={`px-2 py-1 rounded border transition-colors ${
                      p === page ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:bg-gray-50'
                    }`}
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
