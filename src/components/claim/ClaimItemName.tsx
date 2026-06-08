import type { ClaimItem } from '@/types/items'

export function ClaimItemName({ item }: { item: ClaimItem }) {
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
