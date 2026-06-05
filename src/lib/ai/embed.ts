import { createVoyage } from 'voyage-ai-provider'
import { embed } from 'ai'

const voyage = createVoyage({ apiKey: process.env.VOYAGE_API_KEY })

export async function embedItem(item: {
  name: string
  brand?: string
  condition: string
}) {
  const { embedding } = await embed({
    model: voyage.textEmbeddingModel('voyage-3-lite'),
    value: `${item.name} ${item.brand ?? ''} ${item.condition}`.trim(),
  })
  return embedding
}
