'use client'

import type { ClaimItem } from '@/types/items'
import type { PricingState } from '@/lib/hooks/useClaimPricing'
import type { ItemSuggestion } from '@/lib/ai/resolver-types'
import { useClaimItemsTable } from '@/lib/hooks/useClaimItemsTable'
import { ClaimItemsToolbar } from './ClaimItemsToolbar'
import { ClaimItemsBulkBar } from './ClaimItemsBulkBar'
import { ClaimItemsPagination } from './ClaimItemsPagination'
import { ClaimItemApprovalCheckbox } from './ClaimItemApprovalCheckbox'
import { ClaimItemRow } from './ClaimItemRow'
import { ClaimItemCard } from './ClaimItemCard'

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
  const table = useClaimItemsTable(items)

  async function handleSelectAll(checked: boolean) {
    await Promise.allSettled(
      table.pageApprovable
        .filter((i) => !!i.approved !== checked)
        .map((i) => onApprovalChange(i.id, checked))
    )
  }

  async function handleBulkDelete() {
    if (table.approvedIds.length === 0) return
    table.setDeleting(true)
    try {
      await onDeleteItems(table.approvedIds)
    } finally {
      table.setDeleting(false)
    }
  }

  function handleBulkGenerate() {
    if (table.approvedIds.length === 0) return
    onGenerateForItems(table.approvedIds)
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <ClaimItemsToolbar
        filteredCount={table.filtered.length}
        totalCount={items.length}
        filterFlagged={table.filterFlagged}
        onFilterFlaggedChange={table.setFilterFlagged}
        flaggedCount={table.flaggedCount}
        sortOrder={table.sortOrder}
        onSortOrderChange={table.setSortOrder}
        approvedTotal={table.approvedTotal}
      />

      <ClaimItemsBulkBar
        selectedCount={table.approvedIds.length}
        deleting={table.deleting}
        onGenerate={handleBulkGenerate}
        onDelete={handleBulkDelete}
      />

      {items.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm text-gray-400">No items added yet.</p>
        </div>
      ) : table.filtered.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm text-gray-400">No flagged items.</p>
          <button
            onClick={() => table.setFilterFlagged(false)}
            className="text-xs text-blue-600 hover:underline mt-1"
          >
            Clear filter
          </button>
        </div>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-2.5 w-10">
                    <ClaimItemApprovalCheckbox
                      checked={table.allPageApproved}
                      indeterminate={table.somePageApproved && !table.allPageApproved}
                      disabled={table.approvableItems.length === 0}
                      onChange={handleSelectAll}
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
                {table.paginated.map((item) => {
                  const isEditing = table.editingId === item.id
                  return (
                    <ClaimItemRow
                      key={item.id}
                      claimId={claimId}
                      item={item}
                      pricingState={pricingState}
                      isEditing={isEditing}
                      isMounted={table.mountedEditId === item.id}
                      rowClassName={table.rowClass(item)}
                      priceKey={table.priceKey(item)}
                      priceClass={table.priceClass(item)}
                      onToggleEdit={() => (isEditing ? table.closeEdit() : table.openEdit(item.id))}
                      onApprovalChange={onApprovalChange}
                      onEditItem={onEditItem}
                      onApplySuggestion={onApplySuggestion}
                      onCloseEdit={table.closeEdit}
                    />
                  )
                })}
              </tbody>
              {table.approvedTotal > 0 && (
                <tfoot>
                  <tr className="border-t border-gray-200 bg-gray-50">
                    <td colSpan={4} className="px-4 py-3 text-sm font-medium text-gray-700 text-right">
                      Approved total:
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                      ${table.approvedTotal.toLocaleString()}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="md:hidden divide-y divide-gray-100">
            {table.paginated.map((item) => {
              const isEditing = table.editingId === item.id
              const mobileRowClass = item.flagged
                ? 'bg-amber-50 row-enter'
                : item.approved
                  ? 'bg-green-50 row-enter'
                  : 'row-enter'
              return (
                <ClaimItemCard
                  key={item.id}
                  claimId={claimId}
                  item={item}
                  pricingState={pricingState}
                  isEditing={isEditing}
                  isMounted={table.mountedEditId === item.id}
                  rowClassName={mobileRowClass}
                  priceKey={table.priceKey(item)}
                  priceClass={table.priceClass(item)}
                  onToggleEdit={() => (isEditing ? table.closeEdit() : table.openEdit(item.id))}
                  onApprovalChange={onApprovalChange}
                  onEditItem={onEditItem}
                  onApplySuggestion={onApplySuggestion}
                  onCloseEdit={table.closeEdit}
                />
              )
            })}
          </div>

          <ClaimItemsPagination
            page={table.page}
            totalPages={table.totalPages}
            filteredCount={table.filtered.length}
            onPageChange={table.setPage}
          />
        </>
      )}
    </div>
  )
}
