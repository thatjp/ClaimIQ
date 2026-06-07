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
      flagReason: z.string().nullable().describe(
        'Set to a short reason if this item needs adjuster attention: duplicate of another item in this list, too vague to price (e.g. "stuff", "miscellaneous items"), or structurally part of the building (cabinets, flooring, walls). Otherwise null.'
      ),
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
          text: `Extract every distinct personal property item from this insurance claim description and photo. Be conservative — only extract items explicitly mentioned or clearly visible. Set flagReason on duplicates, vague items, or structural/fixture items; otherwise null. Input: ${sanitizedText}`,
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
          prompt: `Extract every distinct personal property item from this insurance claim description.
Be conservative — only extract items explicitly mentioned by name.
For each item identify: name, brand (if mentioned), model (if mentioned), category, estimated condition, and quantity.
Set flagReason on any item that needs adjuster attention:
- Duplicate: the same item appears more than once in the list (flag the second occurrence)
- Too vague to price: name is non-specific (e.g. "stuff", "some electronics", "miscellaneous items")
- Structural/fixture: cabinets, flooring, walls, ceilings, countertops, built-ins — covered separately
Otherwise set flagReason to null.
Do NOT invent items not mentioned in the input.
Input: ${sanitizedText}`,
        }),
  })

  return object
}
