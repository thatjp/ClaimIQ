import { tool } from 'ai'
import { z } from 'zod'
import { searchMarketplaceListings } from '@/lib/pricing/serp'

export const searchMarketplaceTool = tool({
  description:
    'Search one marketplace (category default) for product listings. Use after cache search fails or to identify specific products for vague items. Do not use for structural/fixture items.',
  inputSchema: z.object({
    name: z.string().describe('Product name to search'),
    brand: z.string().optional(),
    model: z.string().optional(),
    category: z
      .enum(['electronics', 'appliances', 'furniture', 'clothing', 'jewelry', 'tools', 'other'])
      .optional(),
    condition: z.string().describe('Item condition'),
  }),
  execute: async ({ name, brand, model, category, condition }) => {
    const result = await searchMarketplaceListings({ name, brand, model, category, condition })
    return {
      engine: result.engine,
      listingCount: result.listings.length,
      averagePrice: result.averagePrice,
      listings: result.listings.slice(0, 5),
    }
  },
})
