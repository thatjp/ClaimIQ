import { tool } from 'ai'
import { z } from 'zod'
import { searchSimilarCachedItems } from '@/lib/pricing/similar-items'

export const searchSimilarItemsTool = tool({
  description:
    'Search the price cache for similar previously-priced items using semantic similarity. Use for vague item names before searching marketplaces.',
  inputSchema: z.object({
    name: z.string().describe('Item name to search for'),
    brand: z.string().optional().describe('Brand if known'),
    condition: z.string().describe('Item condition'),
  }),
  execute: async ({ name, brand, condition }) => {
    const matches = await searchSimilarCachedItems({ name, brand, condition })
    return {
      matchCount: matches.length,
      matches: matches.map((m) => ({
        name: m.name,
        brand: m.brand,
        condition: m.condition,
        price: m.price,
        distance: Number(m.distance.toFixed(3)),
        sourceCount: m.sources.length,
      })),
    }
  },
})
