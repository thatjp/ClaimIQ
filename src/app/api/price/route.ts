import { embedItem } from '@/lib/ai/embed'
import { db } from '@/lib/db'
import { kv } from '@/lib/kv'
import { traceStep, type PriceLayer, type PriceTraceStep } from '@/lib/pricing/trace'
import { triggerPriceWorkflow, type ClaimItemInput } from '@/lib/workflow'
import { initLiveTrace } from '@/lib/pricing/live-trace'

export const maxDuration = 300

function log(layer: string, hit: boolean, durationMs: number, meta?: Record<string, unknown>) {
  console.log(JSON.stringify({ service: 'price-lookup', layer, hit, durationMs, ...meta }))
}

interface PriceResult {
  price: number
  sources: string[]
  source: PriceLayer
  stale?: boolean
}

type StreamEvent =
  | { type: 'layer'; step: PriceTraceStep }
  | { type: 'result'; price: number; sources: string[]; source: PriceLayer; stale?: boolean }
  | { type: 'workflow_started'; workflowRunId: string }
  | { type: 'error'; message: string }

async function runPriceLadder(
  item: ClaimItemInput,
  emit: (event: StreamEvent) => void
): Promise<PriceResult | null> {
  // Layer 1: KV exact cache
  try {
    emit({ type: 'layer', step: traceStep('kv_cache', 'running') })
    const cacheKey = `price:${item.name}:${item.brand || ''}:${item.condition}`
    const t0 = Date.now()
    const cached = await kv.get<{ price: number; sources: string[]; cached_at: string }>(cacheKey)
    const durationMs = Math.round(Date.now() - t0)

    if (cached) {
      log('kv_cache', true, durationMs, { name: item.name, price: cached.price })
      emit({ type: 'layer', step: traceStep('kv_cache', 'hit', durationMs) })
      return { price: cached.price, sources: cached.sources, source: 'kv_cache' }
    }
    log('kv_cache', false, durationMs, { name: item.name })
    emit({ type: 'layer', step: traceStep('kv_cache', 'miss', durationMs) })
  } catch (err) {
    emit({ type: 'layer', step: traceStep('kv_cache', 'error', undefined, 'unavailable') })
    console.warn('[price] KV unavailable:', err instanceof Error ? err.message : err)
  }

  // Layer 2: pgvector similarity
  try {
    emit({ type: 'layer', step: traceStep('vector_cache', 'running') })
    const t0 = Date.now()
    const embedding = await embedItem(item)
    const embedMs = Math.round(Date.now() - t0)

    const t1 = Date.now()
    const { rows } = await db`
      SELECT *, embedding <=> ${JSON.stringify(embedding)}::vector AS distance
      FROM item_prices
      ORDER BY embedding <=> ${JSON.stringify(embedding)}::vector
      LIMIT 1
    `
    const queryMs = Math.round(Date.now() - t1)
    const totalMs = embedMs + queryMs
    const distance = rows[0]?.distance as number | undefined

    if (rows.length > 0 && distance != null && distance < 0.15) {
      const ageMs = Date.now() - new Date(rows[0].cached_at as string).getTime()
      const staleDays = Math.floor(ageMs / (1000 * 60 * 60 * 24))
      const stale = staleDays > 90
      log('vector_cache', true, totalMs, { name: item.name, distance, staleDays, stale })
      emit({
        type: 'layer',
        step: traceStep('vector_cache', 'hit', totalMs, stale ? `${staleDays}d old` : `distance ${distance.toFixed(3)}`),
      })
      return {
        price: rows[0].price as number,
        sources: (rows[0].sources as string[]) ?? [],
        source: 'vector_cache',
        stale,
      }
    }

    log('vector_cache', false, totalMs, { name: item.name, distance: distance ?? null })
    emit({
      type: 'layer',
      step: traceStep('vector_cache', 'miss', totalMs, distance != null ? `distance ${distance.toFixed(3)}` : 'no matches'),
    })
  } catch (err) {
    emit({ type: 'layer', step: traceStep('vector_cache', 'error', undefined, 'unavailable') })
    console.warn('[price] pgvector unavailable:', err instanceof Error ? err.message : err)
  }

  // Cache missed — workflow will handle eBay + Amazon
  return null
}

export async function POST(req: Request) {
  const { item } = await req.json()

  if (!item?.name || !item?.condition) {
    return Response.json({ error: 'item.name and item.condition are required' }, { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function emit(event: StreamEvent) {
        controller.enqueue(encoder.encode(`2:${JSON.stringify([event])}\n`))
      }

      try {
        const claimItem = item as ClaimItemInput
        const syncTrace: PriceTraceStep[] = []
        const result = await runPriceLadder(claimItem, (event) => {
          emit(event)
          if (event.type === 'layer') syncTrace.push(event.step)
        })

        if (result) {
          emit({ type: 'result', ...result })
        } else {
          // Cache missed — hand off to workflow for eBay + Amazon
          const traceKey = crypto.randomUUID()
          const { workflowRunId } = await triggerPriceWorkflow(claimItem, traceKey)
          await initLiveTrace(traceKey, workflowRunId, syncTrace)
          emit({ type: 'workflow_started', workflowRunId })
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Price lookup failed'
        emit({ type: 'error', message })
        console.error('[price] Fatal error:', message)
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}
