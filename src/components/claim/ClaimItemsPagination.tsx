export const CLAIM_ITEMS_PAGE_SIZE = 10

interface ClaimItemsPaginationProps {
  page: number
  totalPages: number
  filteredCount: number
  pageSize?: number
  onPageChange: (page: number) => void
}

export function ClaimItemsPagination({
  page,
  totalPages,
  filteredCount,
  pageSize = CLAIM_ITEMS_PAGE_SIZE,
  onPageChange,
}: ClaimItemsPaginationProps) {
  if (totalPages <= 1) return null

  return (
    <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
      <span>
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredCount)} of {filteredCount}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ‹
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`px-2 py-1 rounded border transition-colors ${
              p === page ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ›
        </button>
      </div>
    </div>
  )
}
