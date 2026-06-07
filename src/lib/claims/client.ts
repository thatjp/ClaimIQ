export async function patchClaimItem(
  claimId: string,
  itemId: string,
  updates: Record<string, unknown>
) {
  const res = await fetch(`/api/claims/${claimId}/items/${itemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? 'Failed to update item')
  }
  return (await res.json()) as { item: import('@/types/items').ClaimItem }
}

export async function postClaimItems(
  claimId: string,
  items: import('@/types/items').ExtractedItem[]
) {
  const res = await fetch(`/api/claims/${claimId}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? 'Failed to save items')
  }
  return (await res.json()) as { items: Record<string, unknown>[] }
}

export async function deleteClaimItem(claimId: string, itemId: string) {
  const res = await fetch(`/api/claims/${claimId}/items/${itemId}`, {
    method: 'DELETE',
  })
  if (!res.ok && res.status !== 404) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? 'Failed to delete item')
  }
}
