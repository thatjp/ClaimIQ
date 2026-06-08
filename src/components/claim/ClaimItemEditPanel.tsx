import type { ReactNode } from 'react'
import type { ClaimItem } from '@/types/items'
import type { ItemSuggestion } from '@/lib/ai/resolver-types'
import { FlaggedItemResolver } from './FlaggedItemResolver'
import { ItemEditForm } from './ItemEditForm'

interface ClaimItemEditPanelProps {
  claimId: string
  item: ClaimItem
  onApplySuggestion: (item: ClaimItem, suggestion: ItemSuggestion) => Promise<void>
  onEditItem: (itemId: string, updates: Partial<ClaimItem>) => Promise<void>
  onCloseEdit: () => void
}

export function ClaimItemEditPanel({
  claimId,
  item,
  onApplySuggestion,
  onEditItem,
  onCloseEdit,
}: ClaimItemEditPanelProps) {
  return (
    <>
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
          onCloseEdit()
        }}
        onCancel={onCloseEdit}
      />
    </>
  )
}

interface ClaimItemEditExpandProps {
  isEditing: boolean
  isMounted: boolean
  children: ReactNode
}

export function ClaimItemEditExpand({ isEditing, isMounted, children }: ClaimItemEditExpandProps) {
  return (
    <div className={`edit-form-expand ${isEditing ? 'is-open' : ''}`}>
      <div className="edit-form-expand-inner">
        {isMounted && <div className="edit-form-enter">{children}</div>}
      </div>
    </div>
  )
}
