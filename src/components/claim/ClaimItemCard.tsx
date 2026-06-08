import type { ClaimItem } from '@/types/items'
import type { PricingState } from '@/lib/hooks/useClaimPricing'
import type { ItemSuggestion } from '@/lib/ai/resolver-types'
import { canApproveItem } from '@/lib/claims/grounding'
import { ClaimItemName } from './ClaimItemName'
import { ClaimItemPriceCell } from './ClaimItemPriceCell'
import { ClaimItemApprovalCheckbox } from './ClaimItemApprovalCheckbox'
import { ClaimItemEditExpand, ClaimItemEditPanel } from './ClaimItemEditPanel'

interface ClaimItemCardProps {
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

export function ClaimItemCard({
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
}: ClaimItemCardProps) {
  const pricing = pricingState?.id === item.id
  const approvable = canApproveItem(item)

  return (
    <div>
      <div className={`px-4 py-3 ${rowClassName}`} onClick={onToggleEdit}>
        <div className="flex items-start gap-3">
          <div onClick={(e) => e.stopPropagation()}>
            <ClaimItemApprovalCheckbox
              checked={!!item.approved}
              disabled={!approvable}
              onChange={(checked) => onApprovalChange(item.id, checked)}
              className="mt-1"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <ClaimItemName item={item} />
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
                  <span className="capitalize">{item.condition}</span>
                  <span>Qty {item.quantity}</span>
                </div>
                {!isEditing && (
                  <>
                    <ClaimItemPriceCell
                      item={item}
                      pricing={pricing}
                      strategy={pricingState?.strategy}
                      priceKey={priceKey}
                      priceClass={priceClass}
                      variant="sources"
                    />
                    {!item.price && !pricing && (
                      <p className="mt-1 text-xs text-gray-400">no source found</p>
                    )}
                  </>
                )}
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                <ClaimItemPriceCell
                  item={item}
                  pricing={pricing}
                  strategy={pricingState?.strategy}
                  priceKey={priceKey}
                  priceClass={priceClass}
                  variant="amount"
                />
                <button onClick={onToggleEdit} className="text-xs text-gray-400 hover:text-gray-600">
                  {isEditing ? 'Close' : 'Edit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ClaimItemEditExpand isEditing={isEditing} isMounted={isMounted}>
        <ClaimItemEditPanel
          claimId={claimId}
          item={item}
          onApplySuggestion={onApplySuggestion}
          onEditItem={onEditItem}
          onCloseEdit={onCloseEdit}
        />
      </ClaimItemEditExpand>
    </div>
  )
}
