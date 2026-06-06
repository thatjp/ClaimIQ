import { kv } from '@/lib/kv'
import { db } from '@/lib/db'
import { embedItem } from '@/lib/ai/embed'
import { triggerPriceWorkflow } from '@/lib/workflow'

function log(layer: string, hit: boolean, durationMs: number, meta?: Record<string, unknown>) {
  console.log(JSON.stringify({ service: 'price-lookup', layer, hit, durationMs, ...meta }))
}

export async function POST(req: Request) {
  const { item } = await req.json()

  if (!item || !item.name || !item.condition) {
    return Response.json({ error: 'item.name and item.condition are required' }, { status: 400 })
  }

  const itemKey = { name: item.name, brand: item.brand || '', condition: item.condition, category: item.category || '' }

  // Layer 1: KV exact cache (7-day TTL)
  try {
    const cacheKey = `price:${item.name}:${item.brand || ''}:${item.condition}`
    const t0 = performance.now()
    const cached = await kv.get<{ price: number; sources: string[]; cached_at: string }>(cacheKey)
    const durationMs = Math.round(performance.now() - t0)
    log('kv_cache', !!cached, durationMs, { ...itemKey, price: cached?.price })
    if (cached) {
      return Response.json({ ...cached, source: 'cache' })
    }
  } catch (err) {
    console.warn('[price] KV cache unavailable:', err instanceof Error ? err.message : err)
  }

  // Layer 2: pgvector similarity search (90-day TTL)
  try {
    const t0 = performance.now()
    const embedding = await embedItem(item)
    const embedMs = Math.round(performance.now() - t0)

    const t1 = performance.now()
    const { rows } = await db`
      SELECT *, embedding <=> ${JSON.stringify(embedding)}::vector AS distance
      FROM item_prices
      ORDER BY embedding <=> ${JSON.stringify(embedding)}::vector
      LIMIT 1
    `
    const queryMs = Math.round(performance.now() - t1)

    if (rows.length > 0 && (rows[0].distance as number) < 0.15) {
      const ageMs = Date.now() - new Date(rows[0].cached_at as string | Date).getTime()
      const staleDays = Math.floor(ageMs / (1000 * 60 * 60 * 24))
      const stale = staleDays > 90

      log('vector_cache', true, embedMs + queryMs, {
        ...itemKey,
        embedMs,
        queryMs,
        distance: rows[0].distance,
        price: rows[0].price,
        staleDays,
        stale,
      })

      return Response.json({
        ...rows[0],
        source: stale ? 'vector_cache_stale' : 'vector_cache',
        stale,
      })
    }

    log('vector_cache', false, embedMs + queryMs, {
      ...itemKey,
      embedMs,
      queryMs,
      distance: rows[0]?.distance ?? null,
    })
  } catch (err) {
    console.warn('[price] pgvector search unavailable:', err instanceof Error ? err.message : err)
  }

  // Layer 3: Trigger Workflow for eBay / web search
  const t0 = performance.now()
  const { workflowRunId } = await triggerPriceWorkflow(item)
  log('workflow_trigger', true, Math.round(performance.now() - t0), { ...itemKey, workflowRunId })

  return Response.json({ status: 'pending', workflowRunId })
}
