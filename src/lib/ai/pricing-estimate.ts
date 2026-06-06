import { generateObject } from 'ai'
import { z } from 'zod'
import { MODELS, gatewayProviderOptions } from '@/lib/ai/models'

export interface PricingEstimateInput {
  name: string
  brand?: string
  model?: string
  condition: string
  estimatedAge?: number
  category?: string
}

const EstimateSchema = z.object({
  price: z.number().describe('Estimated replacement cost in USD based on your training knowledge'),
})

export async function estimateItemPrice(item: PricingEstimateInput) {
  const { object } = await generateObject({
    model: MODELS.priceNorm,
    providerOptions: gatewayProviderOptions,
    schema: EstimateSchema,
    prompt: `You are an insurance pricing assistant. Estimate the current retail replacement cost for this item based on your knowledge. Be conservative — use the lower end of the typical price range.

Item: ${item.name}
Brand: ${item.brand || 'unknown'}
Model: ${item.model || 'unknown'}
Condition: ${item.condition}
Estimated age: ${item.estimatedAge ? `${item.estimatedAge} years` : 'unknown'}
Category: ${item.category || 'unknown'}

Return your best price estimate. This is a fallback — live pricing was unavailable.`,
  })

  return object.price
}
