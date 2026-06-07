import { db } from '@/lib/db'

export interface ClaimItem {
  id: string
  claim_id: string
  name: string
  brand?: string
  model?: string
  category: string
  condition: string
  quantity: number
  adjuster_notes?: string
  price?: number
  price_source?: 'cache' | 'vector_cache' | 'vector_cache_stale' | 'ebay' | 'amazon' | 'walmart' | 'bestbuy' | 'manual'
  price_sources?: string[]
  price_cached_at?: string
  approved?: boolean
  approved_at?: string
  flagged: boolean
  flag_reason?: string
  created_at: string
}

export interface Claim {
  id: string
  user_id: string
  state: string
  policy_type: string
  date_of_loss: string
  status: string
  created_at: string
  updated_at: string
  items: ClaimItem[]
  regionalRules?: string
  policyType?: string
}

const POLICY_RULES: Record<string, Record<string, string>> = {
  electronics: {
    CA: 'California: Electronics must be replaced with like kind and quality. Depreciation capped at 50% for items under 5 years.',
    FL: 'Florida: Electronics subject to actual cash value unless replacement cost endorsement applies.',
    TX: 'Texas: Electronics depreciated at 15-20% per year. Proof of purchase required for items over $500.',
    default: 'Standard HO-3: Electronics replaced at actual cash value unless replacement cost rider present.',
  },
  furniture: {
    CA: 'California: Furniture depreciated at 10% per year. Antiques valued at fair market value.',
    FL: 'Florida: Furniture subject to wear-and-tear depreciation. Water damage claims require mitigation documentation.',
    TX: 'Texas: Furniture depreciation varies by material. Custom furniture requires appraisal.',
    default: 'Standard HO-3: Furniture replaced at actual cash value. Document condition with photos.',
  },
  jewelry: {
    CA: 'California: Jewelry requires scheduled endorsement for full value. Base coverage typically $1,500.',
    FL: 'Florida: Jewelry coverage limited to $1,000 without rider. Appraisal required for claims over $500.',
    TX: 'Texas: Jewelry sublimit $2,500. Independent appraisal required for all jewelry claims.',
    default: 'Standard HO-3: Jewelry sublimit typically $1,500. Scheduled coverage recommended.',
  },
  appliances: {
    default: 'Standard HO-3: Major appliances depreciated at 10-15% per year. Age and condition documented.',
  },
  clothing: {
    default: 'Standard HO-3: Clothing depreciated based on age and wear. Receipts recommended for high-value items.',
  },
  tools: {
    default: 'Standard HO-3: Tools covered at actual cash value. Business tools may require separate policy.',
  },
  other: {
    default: 'Standard HO-3: Coverage based on actual cash value. Document with photos and receipts.',
  },
}

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
  price_source?: 'cache' | 'vector_cache' | 'vector_cache_stale' | 'ebay' | 'amazon' | 'walmart' | 'bestbuy' | 'manual'
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
  } catch {
    // Return mock data when DB is not connected
    return {
      id,
      user_id: '1',
      state: 'CA',
      policy_type: 'HO-3',
      date_of_loss: new Date().toISOString().split('T')[0],
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      policyType: 'HO-3',
      regionalRules: 'Standard HO-3 policy rules apply.',
      items: [],
    }
  }
}

export async function flagClaimItem(
  claimId: string,
  itemId: string,
  reason: string
): Promise<{ success: boolean; message: string }> {
  try {
    await db`
      UPDATE claim_items
      SET flagged = TRUE, flag_reason = ${reason}
      WHERE id = ${itemId} AND claim_id = ${claimId}
    `
    return { success: true, message: `Item ${itemId} flagged: ${reason}` }
  } catch {
    return { success: true, message: `Item ${itemId} flagged (mock): ${reason}` }
  }
}

export async function getPolicyRules(
  category: string,
  state: string
): Promise<string> {
  const categoryRules = POLICY_RULES[category] || POLICY_RULES['other']
  return categoryRules[state] || categoryRules['default']
}
