'use client'

import { useState, useRef, useEffect } from 'react'
import type { ClaimItem } from '@/types/items'
import { canApproveItem } from '@/lib/claims/grounding'
import type { SortOrder } from '@/components/claim/ClaimItemsToolbar'
import { CLAIM_ITEMS_PAGE_SIZE } from '@/components/claim/ClaimItemsPagination'

export function useClaimItemsTable(items: ClaimItem[]) {
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
    setTimeout(() => setMountedEditId(null), 300)
  }

  useEffect(() => {
    setPage(1)
  }, [filterFlagged, sortOrder])

  const seenIds = useRef<Set<string>>(new Set())
  const seenPrices = useRef<Set<string>>(new Set())
  useEffect(() => {
    items.forEach((item) => {
      seenIds.current.add(item.id)
      if (item.price != null) seenPrices.current.add(item.id)
    })
  })

  const filtered = filterFlagged ? items.filter((i) => i.flagged) : items
  const sorted =
    sortOrder === 'none'
      ? filtered
      : [...filtered].sort((a, b) => {
          const pa = a.price ?? -1
          const pb = b.price ?? -1
          return sortOrder === 'asc' ? pa - pb : pb - pa
        })
  const totalPages = Math.max(1, Math.ceil(sorted.length / CLAIM_ITEMS_PAGE_SIZE))
  const paginated = sorted.slice((page - 1) * CLAIM_ITEMS_PAGE_SIZE, page * CLAIM_ITEMS_PAGE_SIZE)

  const approvedIds = items.filter((i) => i.approved).map((i) => i.id)
  const approvedTotal = items
    .filter((i) => i.approved)
    .reduce((sum, i) => sum + (i.price || 0) * i.quantity, 0)

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

  return {
    filterFlagged,
    setFilterFlagged,
    sortOrder,
    setSortOrder,
    page,
    setPage,
    deleting,
    setDeleting,
    editingId,
    mountedEditId,
    openEdit,
    closeEdit,
    filtered,
    paginated,
    totalPages,
    approvedIds,
    approvedTotal,
    approvableItems,
    pageApprovable,
    allPageApproved,
    somePageApproved,
    flaggedCount,
    rowClass,
    priceKey,
    priceClass,
  }
}
