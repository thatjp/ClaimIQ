import { kv } from '@/lib/kv'
import { db } from '@/lib/db'
import { embedItem } from '@/lib/ai/embed'
import { triggerPriceWorkflow } from '@/lib/workflow'
import {
  finalizeSyncHit,
  pendingWorkflowTrace,
  traceStep,
  type PriceTraceStep,
} from '@/lib/pricing/trace'

function log(layer: string, hit: boolean, durationMs: number, meta?: Record<string, unknown>) {
  console.log(JSON.stringify({ service: 'price-lookup', layer, hit, durationMs, ...meta }))
}

export async function POST(req: Request) {
  const { item } = await req.json()

  if (!item || !item.name || !item.condition) {
    return Response.json({ error: 'item.name and item.condition are required' }, { status: 400 })
  }

  const itemKey = { name: item.name, brand: item.brand || '', condition: item.condition, category: item.category || '' }
  const syncTrace: PriceTraceStep[] = []

  // Layer 1: KV exact cache (7-day TTL)
  try {
    const cacheKey = `price:${item.name}:${item.brand || ''}:${item.condition}`
    const t0 = performance.now()
    const cached = await kv.get<{ price: number; sources: string[]; cached_at: string }>(cacheKey)
    const durationMs = Math.round(performance.now() - t0)
    log('kv_cache', !!cached, durationMs, { ...itemKey, price: cached?.price })

    if (cached) {
      syncTrace.push(traceStep('kv_cache', 'hit', durationMs))
      const trace = finalizeSyncHit(syncTrace, 'kv_cache')
      return Response.json({ ...cached, source: 'cache', trace })
    }

    syncTrace.push(traceStep('kv_cache', 'miss', durationMs))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[price] KV cache unavailable:', message)
    syncTrace.push(traceStep('kv_cache', 'error', undefined, message))
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
    const totalMs = embedMs + queryMs
    const distance = rows[0]?.distance as number | undefined

    if (rows.length > 0 && distance != null && distance < 0.15) {
      const ageMs = Date.now() - new Date(rows[0].cached_at as string | Date).getTime()
      const staleDays = Math.floor(ageMs / (1000 * 60 * 60 * 24))
      const stale = staleDays > 90

      log('vector_cache', true, totalMs, {
        ...itemKey,
        embedMs,
        queryMs,
        distance,
        price: rows[0].price,
        staleDays,
        stale,
      })

      syncTrace.push(
        traceStep('vector_cache', 'hit', totalMs, `distance ${distance.toFixed(3)}${stale ? ` · ${staleDays}d old` : ''}`)
      )
      const hitLayer = stale ? 'vector_cache' : 'vector_cache'
      const trace = finalizeSyncHit(syncTrace, hitLayer)

      return Response.json({
        ...rows[0],
        source: stale ? 'vector_cache_stale' : 'vector_cache',
        stale,
        trace,
      })
    }

    log('vector_cache', false, totalMs, {
      ...itemKey,
      embedMs,
      queryMs,
      distance: distance ?? null,
    })

    syncTrace.push(
      traceStep(
        'vector_cache',
        'miss',
        totalMs,
        distance != null ? `distance ${distance.toFixed(3)}` : 'no matches'
      )
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[price] pgvector search unavailable:', message)
    syncTrace.push(traceStep('vector_cache', 'error', undefined, message))
  }

  // Layer 3: Trigger Workflow for eBay / web search
  const t0 = performance.now()
  const { workflowRunId } = await triggerPriceWorkflow(item)
  const triggerMs = Math.round(performance.now() - t0)
  log('workflow_trigger', true, triggerMs, { ...itemKey, workflowRunId })

  const trace = pendingWorkflowTrace(syncTrace)

  return Response.json({ status: 'pending', workflowRunId, syncTrace, trace })
}
