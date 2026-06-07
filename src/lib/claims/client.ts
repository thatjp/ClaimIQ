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
