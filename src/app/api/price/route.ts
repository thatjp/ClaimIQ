import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { kv } from '@/lib/kv'
import { db } from '@/lib/db'
import { embedItem } from '@/lib/ai/embed'
import { triggerPriceWorkflow } from '@/lib/workflow'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // TODO: Add rate limiting here — web search is expensive and should be throttled
  // e.g., 10 requests per adjuster per minute using KV-based sliding window

  const { item } = await req.json()

  if (!item || !item.name || !item.condition) {
    return Response.json({ error: 'item.name and item.condition are required' }, { status: 400 })
  }

  // Layer 1: KV exact cache (7-day TTL)
  try {
    const cacheKey = `price:${item.name}:${item.brand || ''}:${item.condition}`
    const cached = await kv.get<{ price: number; sources: string[]; cached_at: string }>(cacheKey)
    if (cached) {
      return Response.json({ ...cached, source: 'cache' })
    }
  } catch (err) {
    console.warn('[price] KV cache unavailable:', err instanceof Error ? err.message : err)
  }

  // Layer 2: pgvector similarity search (90-day TTL)
  // Semantically similar items skip the web search entirely.
  // e.g. "65-inch Samsung TV 2022" won't re-search if "65-inch Samsung TV 2021" was priced recently.
  try {
    const embedding = await embedItem(item)

    const { rows } = await db`
      SELECT *, embedding <=> ${JSON.stringify(embedding)}::vector AS distance
      FROM item_prices
      WHERE cached_at > NOW() - INTERVAL '90 days'
      ORDER BY embedding <=> ${JSON.stringify(embedding)}::vector
      LIMIT 1
    `

    if (rows.length > 0 && (rows[0].distance as number) < 0.15) {
      return Response.json({ ...rows[0], source: 'vector_cache' })
    }
  } catch (err) {
    console.warn('[price] pgvector search unavailable:', err instanceof Error ? err.message : err)
  }

  // Layer 3: Trigger Workflow for live web search + price normalization
  const { workflowRunId } = await triggerPriceWorkflow(item)
  return Response.json({ status: 'pending', workflowRunId })
}
