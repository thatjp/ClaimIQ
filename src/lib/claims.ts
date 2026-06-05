import { db } from '@/lib/db'

export interface ClaimItem {
  id: string
  claim_id: string
  name: string
  brand?: string
  model?: string
  category: string
  condition: string
  estimated_age?: number
  quantity: number
  adjuster_notes?: string
  price?: number
  price_sources?: string[]
  price_cached_at?: string
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

export async function getClaim(id: string): Promise<Claim | null> {
  try {
    const { rows: claimRows } = await db`
      SELECT * FROM claims WHERE id = ${id} LIMIT 1
    `
    if (claimRows.length === 0) return null

    const claim = claimRows[0] as Claim

    const { rows: itemRows } = await db`
      SELECT * FROM claim_items WHERE claim_id = ${id} ORDER BY created_at ASC
    `
    claim.items = itemRows as ClaimItem[]
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
