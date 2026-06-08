import { db } from '@/lib/db'
import { embedItem } from '@/lib/ai/embed'

export interface SimilarItemMatch {
  name: string
  brand: string
  condition: string
  price: number
  sources: string[]
  distance: number
}

const DEFAULT_MAX_DISTANCE = 0.15
const DEFAULT_LIMIT = 5

export async function searchSimilarCachedItems(
  item: { name: string; brand?: string; condition: string },
  options?: { limit?: number; maxDistance?: number }
): Promise<SimilarItemMatch[]> {
  const limit = options?.limit ?? DEFAULT_LIMIT
  const maxDistance = options?.maxDistance ?? DEFAULT_MAX_DISTANCE

  try {
    const embedding = await embedItem({
      name: item.name,
      brand: item.brand,
      condition: item.condition,
    })

    const { rows } = await db`
      SELECT name, brand, condition, price, sources,
             embedding <=> ${JSON.stringify(embedding)}::vector AS distance
      FROM item_prices
      ORDER BY embedding <=> ${JSON.stringify(embedding)}::vector
      LIMIT ${limit}
    `

    return rows
      .filter((row) => {
        const distance = row.distance as number
        return distance != null && distance < maxDistance
      })
      .map((row) => ({
        name: row.name as string,
        brand: (row.brand as string) ?? '',
        condition: row.condition as string,
        price: parseFloat(row.price as string),
        sources: (row.sources as string[]) ?? [],
        distance: row.distance as number,
      }))
  } catch {
    return []
  }
}
