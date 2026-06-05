import { generateObject } from 'ai'
import { z } from 'zod'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { sanitizeInput } from '@/lib/sanitize'
import { MODELS } from '@/lib/ai/models'

const ItemSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      brand: z.string().optional(),
      model: z.string().optional(),
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
      estimatedAge: z.number().optional(),
      quantity: z.number().default(1),
      adjusterNotes: z.string().optional(),
    })
  ),
})

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { text, imageBase64 } = await req.json()
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
      schema: ItemSchema,
      ...(imageBase64
        ? { messages }
        : {
            prompt: `Extract every distinct item from this insurance claim description.
Be conservative — only extract items explicitly mentioned.
For each item, identify: name, brand (if mentioned), model (if mentioned), category, estimated condition, approximate age in years (if determinable), and quantity.
Input: ${sanitizedText}`,
          }),
    })

    return Response.json(object)
  } catch (error) {
    console.error('Extraction error:', error)
    return Response.json(
      { error: 'Failed to extract items from description' },
      { status: 500 }
    )
  }
}
