export type SortOrder = 'none' | 'asc' | 'desc'

interface ClaimItemsToolbarProps {
  filteredCount: number
  totalCount: number
  filterFlagged: boolean
  onFilterFlaggedChange: (value: boolean) => void
  flaggedCount: number
  sortOrder: SortOrder
  onSortOrderChange: (value: SortOrder) => void
  approvedTotal: number
}

export function ClaimItemsToolbar({
  filteredCount,
  totalCount,
  filterFlagged,
  onFilterFlaggedChange,
  flaggedCount,
  sortOrder,
  onSortOrderChange,
  approvedTotal,
}: ClaimItemsToolbarProps) {
  return (
    <div className="px-4 py-3 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold text-gray-700">
          Line Items ({filteredCount}{filterFlagged ? ` of ${totalCount}` : ''})
        </h2>
        {flaggedCount > 0 && (
          <button
            onClick={() => onFilterFlaggedChange(!filterFlagged)}
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
            onClick={() => onSortOrderChange(sortOrder === 'desc' ? 'none' : 'desc')}
            className={`px-2 py-0.5 rounded border transition-colors ${sortOrder === 'desc' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 hover:border-gray-300'}`}
          >
            $ High
          </button>
          <button
            onClick={() => onSortOrderChange(sortOrder === 'asc' ? 'none' : 'asc')}
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
  )
}
