import { tool } from 'ai'
import { z } from 'zod'
import { getClaim } from '@/lib/claims'

export function createListClaimItemsTool(claimId: string) {
  return tool({
    description:
      'List all items on the current claim. Use when resolving duplicates to find the matching sibling item.',
    inputSchema: z.object({}),
    execute: async () => {
      const claim = await getClaim(claimId)
      if (!claim) return { items: [], error: 'Claim not found' }

      return {
        items: claim.items.map((item) => ({
          id: item.id,
          name: item.name,
          brand: item.brand ?? null,
          model: item.model ?? null,
          category: item.category,
          condition: item.condition,
          quantity: item.quantity,
          flagged: item.flagged,
          flagReason: item.flag_reason ?? null,
        })),
      }
    },
  })
}
