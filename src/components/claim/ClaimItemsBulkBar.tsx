interface ClaimItemsBulkBarProps {
  selectedCount: number
  deleting: boolean
  onGenerate: () => void
  onDelete: () => void
}

export function ClaimItemsBulkBar({
  selectedCount,
  deleting,
  onGenerate,
  onDelete,
}: ClaimItemsBulkBarProps) {
  if (selectedCount === 0) return null

  return (
    <div className="px-4 py-2 bg-green-50 border-b border-green-100 flex items-center justify-between">
      <span className="text-xs text-green-700 font-medium">
        {selectedCount} item{selectedCount > 1 ? 's' : ''} selected
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={onGenerate}
          className="text-xs px-3 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          Generate document
        </button>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="text-xs px-3 py-1 rounded-md bg-white border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          {deleting ? 'Deleting…' : 'Delete selected'}
        </button>
      </div>
    </div>
  )
}
