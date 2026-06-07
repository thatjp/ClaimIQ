import { generateObject } from 'ai'
import { z } from 'zod'
import { sanitizeInput } from '@/lib/sanitize'
import { MODELS, gatewayProviderOptions } from '@/lib/ai/models'

export const ItemSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      brand: z.string().nullable(),
      model: z.string().nullable(),
      category: z.enum([
        'electronics',
        'appliances',
        'furniture',
        'clothing',
        'jewelry',
        'tools',
        'other',
      ]),
      condition: z.enum(['new', 'good', 'fair', 'poor']),
      quantity: z.number(),
      adjusterNotes: z.string().nullable(),
    })
  ),
})

export type ExtractedItems = z.infer<typeof ItemSchema>

export async function extractItems(text: string, imageBase64?: string | null) {
  const sanitizedText = sanitizeInput(text || '')

  const messages: Parameters<typeof generateObject>[0]['messages'] = []

  if (imageBase64) {
    messages.push({
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Extract every distinct item from this insurance claim description. Be conservative — only extract items explicitly mentioned or clearly visible. Input: ${sanitizedText}`,
        },
        {
          type: 'image',
          image: imageBase64,
        },
      ],
    })
  }

  const { object } = await generateObject({
    model: MODELS.extraction,
    providerOptions: gatewayProviderOptions,
    schema: ItemSchema,
    ...(imageBase64
      ? { messages }
      : {
          prompt: `Extract every distinct item from this insurance claim description.
Be conservative — only extract items explicitly mentioned.
For each item, identify: name, brand (if mentioned), model (if mentioned), category, estimated condition, and quantity.
Input: ${sanitizedText}`,
        }),
  })

  return object
}
