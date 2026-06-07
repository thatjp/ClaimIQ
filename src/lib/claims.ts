import { db } from '@/lib/db'
import type { Claim, ClaimItem, PriceSource } from '@/types/items'

export type { Claim, ClaimItem }

function parseJsonArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) return value as string[]
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : undefined
    } catch {
      return undefined
    }
  }
  return undefined
}

export function normalizeClaimItem(row: ClaimItem): ClaimItem {
  return {
    ...row,
    price_sources: parseJsonArray(row.price_sources) ?? row.price_sources,
    approved: row.approved ?? false,
    price: row.price != null ? Number(row.price) : undefined,
  }
}

export interface UpdateClaimItemInput {
  price_sources?: string[]
  price?: number | null
  price_source?: PriceSource
  approved?: boolean
}

export async function updateClaimItem(
  claimId: string,
  itemId: string,
  updates: UpdateClaimItemInput
): Promise<{ item: ClaimItem | null; error?: string }> {
  if (Object.keys(updates).length === 0) {
    return { item: null, error: 'No updates provided' }
  }

  try {
    const [{ rows: claimRows }, { rows: itemRows }] = await Promise.all([
      db`SELECT id FROM claims WHERE id = ${claimId} LIMIT 1`,
      db`SELECT * FROM claim_items WHERE id = ${itemId} AND claim_id = ${claimId} LIMIT 1`,
    ])

    if (claimRows.length === 0 || itemRows.length === 0) {
      return { item: null, error: 'Item not found' }
    }

    const existing = normalizeClaimItem(itemRows[0] as unknown as ClaimItem)
    const merged: ClaimItem = {
      ...existing,
      price_sources:
        'price_sources' in updates ? updates.price_sources : existing.price_sources,
      price: 'price' in updates ? (updates.price ?? undefined) : existing.price,
      price_source: 'price_source' in updates ? updates.price_source : existing.price_source,
      approved: 'approved' in updates ? !!updates.approved : existing.approved,
    }

    if (updates.approved === true) {
      const { canApproveItem } = await import('@/lib/claims/grounding')
      if (!canApproveItem(merged)) {
        return { item: null, error: 'Item is missing required source URL or price' }
      }
    }

    const approvedAt = merged.approved ? new Date().toISOString() : null
    const priceSourcesJson = merged.price_sources?.length
      ? JSON.stringify(merged.price_sources)
      : null

    const { rows } = await db`
      UPDATE claim_items
      SET
        price_sources = ${priceSourcesJson},
        price = ${merged.price ?? null},
        price_source = ${merged.price_source ?? null},
        approved = ${merged.approved ?? false},
        approved_at = ${approvedAt}
      WHERE id = ${itemId} AND claim_id = ${claimId}
      RETURNING *
    `

    if (rows.length === 0) return { item: null, error: 'Item not found' }
    return { item: normalizeClaimItem(rows[0] as unknown as ClaimItem) }
  } catch (err) {
    console.error('Failed to update claim item:', err)
    return { item: null, error: 'Failed to update item' }
  }
}

export async function getClaim(id: string): Promise<Claim | null> {
  try {
    const [{ rows: claimRows }, { rows: itemRows }] = await Promise.all([
      db`SELECT * FROM claims WHERE id = ${id} LIMIT 1`,
      db`SELECT * FROM claim_items WHERE claim_id = ${id} ORDER BY created_at ASC`,
    ])

    if (claimRows.length === 0) return null

    const claim = claimRows[0] as unknown as Claim
    claim.items = (itemRows as unknown as ClaimItem[]).map(normalizeClaimItem)
    return claim
  } catch (err) {
    console.error('getClaim failed:', err)
    return null
  }
}
