import { openai } from '@ai-sdk/openai'
import { embed } from 'ai'

export async function embedItem(item: {
  name: string
  brand?: string
  condition: string
}) {
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: `${item.name} ${item.brand ?? ''} ${item.condition}`.trim(),
  })
  return embedding
}
