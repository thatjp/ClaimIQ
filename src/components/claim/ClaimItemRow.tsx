import React from 'react'
import type { ClaimItem } from '@/types/items'
import type { PricingState } from '@/lib/hooks/useClaimPricing'
import type { ItemSuggestion } from '@/lib/ai/resolver-types'
import { canApproveItem } from '@/lib/claims/grounding'
import { ClaimItemName } from './ClaimItemName'
import { ClaimItemPriceCell } from './ClaimItemPriceCell'
import { ClaimItemApprovalCheckbox } from './ClaimItemApprovalCheckbox'
import { ClaimItemEditExpand, ClaimItemEditPanel } from './ClaimItemEditPanel'

interface ClaimItemRowProps {
  claimId: string
  item: ClaimItem
  pricingState: PricingState | null
  isEditing: boolean
  isMounted: boolean
  rowClassName: string
  priceKey: string
  priceClass: string
  onToggleEdit: () => void
  onApprovalChange: (itemId: string, approved: boolean) => Promise<void>
  onEditItem: (itemId: string, updates: Partial<ClaimItem>) => Promise<void>
  onApplySuggestion: (item: ClaimItem, suggestion: ItemSuggestion) => Promise<void>
  onCloseEdit: () => void
}

export function ClaimItemRow({
  claimId,
  item,
  pricingState,
  isEditing,
  isMounted,
  rowClassName,
  priceKey,
  priceClass,
  onToggleEdit,
  onApprovalChange,
  onEditItem,
  onApplySuggestion,
  onCloseEdit,
}: ClaimItemRowProps) {
  const pricing = pricingState?.id === item.id
  const approvable = canApproveItem(item)

  return (
    <React.Fragment>
      <tr className={`${rowClassName} cursor-pointer`} onClick={onToggleEdit}>
        <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
          <ClaimItemApprovalCheckbox
            checked={!!item.approved}
            disabled={!approvable}
            onChange={(checked) => onApprovalChange(item.id, checked)}
          />
        </td>
        <td className="px-4 py-3">
          <ClaimItemName item={item} />
        </td>
        <td className="px-4 py-3 capitalize text-gray-700">{item.condition}</td>
        <td className="px-4 py-3 text-gray-700">{item.quantity}</td>
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <ClaimItemPriceCell
            item={item}
            pricing={pricing}
            strategy={pricingState?.strategy}
            priceKey={priceKey}
            priceClass={priceClass}
          />
        </td>
        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
          <button onClick={onToggleEdit} className="text-xs text-gray-400 hover:text-gray-600">
            {isEditing ? 'Close' : 'Edit'}
          </button>
        </td>
      </tr>
      <tr>
        <td colSpan={6} className="p-0 border-0">
          <ClaimItemEditExpand isEditing={isEditing} isMounted={isMounted}>
            <ClaimItemEditPanel
              claimId={claimId}
              item={item}
              onApplySuggestion={onApplySuggestion}
              onEditItem={onEditItem}
              onCloseEdit={onCloseEdit}
            />
          </ClaimItemEditExpand>
        </td>
      </tr>
    </React.Fragment>
  )
}
