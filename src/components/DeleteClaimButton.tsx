'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function DeleteClaimButton({
  claimId,
  onDeleted,
}: {
  claimId: string
  onDeleted?: () => void
}) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      await fetch(`/api/claims/${claimId}`, { method: 'DELETE' })
      onDeleted?.()
      router.refresh()
    } finally {
      setDeleting(false)
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Delete?</span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs text-red-600 font-medium hover:text-red-700 disabled:opacity-50"
        >
          {deleting ? 'Deleting...' : 'Yes'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          No
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs text-gray-400 hover:text-red-500 transition-colors"
    >
      Delete
    </button>
  )
}
