import { extractItems } from '@/lib/ai/extraction'
import { db } from '@/lib/db'
import { kv } from '@/lib/kv'
import { searchSimilarCachedItems } from '@/lib/pricing/similar-items'
import {
  writeIntakeProgress,
  type IntakeProgress,
  type IntakeProgressItem,
} from '@/lib/pricing/intake-progress'
import { priceItemWorkflow } from '@/workflows/price'
import { traceStep, PRICE_LADDER, type PriceTraceStep } from '@/lib/pricing/trace'

export interface IntakeInput {
  intakeKey: string
  claimId: string
  text: string
  imageBase64?: string | null
}

interface RawItem {
  name: string
  brand?: string | null
  model?: string | null
  category: string
  condition: string
  quantity: number
  flagReason?: string | null
}

interface PersistedItem {
  id: string
  name: string
  brand?: string | null
  model?: string | null
  category: string
  condition: string
  quantity: number
  flagged: boolean
  flag_reason?: string | null
}

const BATCH_SIZE = 5

function log(event: string, meta: Record<string, unknown>) {
  console.log(JSON.stringify({ service: 'intake-workflow', event, ...meta }))
}

async function extractItemsStep(text: string, imageBase64?: string | null): Promise<RawItem[]> {
  'use step'
  const t0 = performance.now()
  const result = await extractItems(text, imageBase64)
  log('extraction_complete', {
    itemCount: result.items.length,
    flaggedCount: result.items.filter((i) => i.flagReason).length,
    durationMs: Math.round(performance.now() - t0),
  })
  return result.items as RawItem[]
}

async function persistItemsStep(claimId: string, items: RawItem[]): Promise<PersistedItem[]> {
  'use step'
  const inserted = await Promise.all(
    items.map((item) =>
      db`
        INSERT INTO claim_items (
          claim_id, name, brand, model, category, condition,
          quantity, flagged, flag_reason
        )
        VALUES (
          ${claimId},
          ${item.name},
          ${item.brand ?? null},
          ${item.model ?? null},
          ${item.category},
          ${item.condition},
          ${item.quantity ?? 1},
          ${!!item.flagReason},
          ${item.flagReason ?? null}
        )
        RETURNING id, name, brand, model, category, condition, quantity, flagged, flag_reason
      `
    )
  )
  return inserted.map((r) => r.rows[0] as unknown as PersistedItem)
}

async function updateItemPriceStep(
  claimId: string,
  itemId: string,
  price: number,
  sources: string[],
  source: string
): Promise<void> {
  'use step'
  await db`
    UPDATE claim_items
    SET
      price           = ${price},
      price_sources   = ${JSON.stringify(sources)},
      price_source    = ${source},
      price_cached_at = NOW()
    WHERE id = ${itemId} AND claim_id = ${claimId}
  `
}

async function publishIntakeProgressStep(intakeKey: string, progress: IntakeProgress): Promise<void> {
  'use step'
  try {
    await writeIntakeProgress(intakeKey, progress)
  } catch (err) {
    console.warn('[intake-workflow] KV write failed:', err instanceof Error ? err.message : err)
  }
}

interface CacheOutcome {
  price: number
  sources: string[]
  source: string
  trace: PriceTraceStep[]
}

// Inline cache ladder (KV → pgvector). Returns trace steps so the dashboard
// can show which layer resolved the price, matching the live trace on the claim workspace.
async function lookupPriceFromCache(item: PersistedItem): Promise<CacheOutcome | null> {
  'use step'

  const trace: PriceTraceStep[] = []

  // Layer 1: KV exact cache
  try {
    const cacheKey = `price:${item.name}:${item.brand || ''}:${item.condition}`
    const cached = await kv.get<{ price: number; sources: string[] }>(cacheKey)
    if (cached) {
      trace.push(traceStep('kv_cache', 'hit'))
      return { price: cached.price, sources: cached.sources, source: 'kv_cache', trace }
    }
    trace.push(traceStep('kv_cache', 'miss'))
  } catch {
    trace.push(traceStep('kv_cache', 'miss'))
  }

  // Layer 2: pgvector similarity
  try {
    const matches = await searchSimilarCachedItems(
      { name: item.name, brand: item.brand ?? undefined, condition: item.condition },
      { limit: 1 }
    )
    if (matches.length > 0) {
      const match = matches[0]
      trace.push(traceStep('vector_cache', 'hit'))
      return {
        price: match.price,
        sources: match.sources,
        source: 'vector_cache',
        trace,
      }
    }
    trace.push(traceStep('vector_cache', 'miss'))
  } catch {
    trace.push(traceStep('vector_cache', 'miss'))
  }

  return null
}

export async function claimIntakeWorkflow(input: IntakeInput): Promise<void> {
  'use workflow'

  const { intakeKey, claimId, text, imageBase64 } = input
  const t0 = performance.now()
  log('intake_started', { claimId, hasImage: !!imageBase64, textLength: text.length })

  await publishIntakeProgressStep(intakeKey, { phase: 'extracting', items: [] })

  let rawItems: RawItem[]
  try {
    rawItems = await extractItemsStep(text, imageBase64)
  } catch (err) {
    await publishIntakeProgressStep(intakeKey, {
      phase: 'error',
      items: [],
      error: err instanceof Error ? err.message : 'Extraction failed',
    })
    return
  }

  let persistedItems: PersistedItem[]
  try {
    persistedItems = await persistItemsStep(claimId, rawItems)
  } catch (err) {
    await publishIntakeProgressStep(intakeKey, {
      phase: 'error',
      items: [],
      error: err instanceof Error ? err.message : 'Failed to save items',
    })
    return
  }

  // All items start as queued
  const progressItems: IntakeProgressItem[] = persistedItems.map((item) => ({
    id: item.id,
    name: item.name,
    priceStatus: 'queued',
    flagReason: item.flag_reason ?? null,
  }))
  await publishIntakeProgressStep(intakeKey, { phase: 'pricing', items: [...progressItems] })

  // Price in batches of BATCH_SIZE — bounds concurrency and keeps event log manageable
  for (let b = 0; b < persistedItems.length; b += BATCH_SIZE) {
    const batch = persistedItems.slice(b, b + BATCH_SIZE)

    await Promise.all(
      batch.map(async (item) => {
        const idx = persistedItems.indexOf(item)

        // Derive from PRICE_LADDER so this never drifts when layers change
        const pendingTrace = PRICE_LADDER.map(({ layer }, i) =>
          traceStep(layer, i === 0 ? 'running' : 'pending')
        )
        progressItems[idx] = { ...progressItems[idx], priceStatus: 'pricing', trace: pendingTrace }
        await publishIntakeProgressStep(intakeKey, { phase: 'pricing', items: [...progressItems] })

        try {
          // Layer 1 & 2: KV + vector cache
          const cacheOutcome = await lookupPriceFromCache(item)

          if (cacheOutcome) {
            await updateItemPriceStep(claimId, item.id, cacheOutcome.price, cacheOutcome.sources, cacheOutcome.source)
            log('item_priced', { claimId, itemId: item.id, item: item.name, price: cacheOutcome.price, source: cacheOutcome.source, cacheHit: true })
            progressItems[idx] = {
              id: item.id,
              name: item.name,
              priceStatus: 'found',
              price: cacheOutcome.price,
              source: cacheOutcome.source,
              trace: cacheOutcome.trace,
            }
          } else {
            // Cache missed — show miss steps + first external source as running
            const afterCacheMissTrace = PRICE_LADDER.map(({ layer }, i) => {
              if (i === 0) return traceStep(layer, 'miss')  // kv_cache
              if (i === 1) return traceStep(layer, 'miss')  // vector_cache
              if (i === 2) return traceStep(layer, 'running') // first external source
              return traceStep(layer, 'pending')
            })
            progressItems[idx] = { ...progressItems[idx], trace: afterCacheMissTrace }
            await publishIntakeProgressStep(intakeKey, { phase: 'pricing', items: [...progressItems] })

            const workflowResult = await priceItemWorkflow({
              name: item.name,
              brand: item.brand ?? undefined,
              model: item.model ?? undefined,
              category: item.category,
              condition: item.condition,
              quantity: item.quantity,
            })
            const fullTrace = [
              traceStep('kv_cache', 'miss'),
              traceStep('vector_cache', 'miss'),
              ...workflowResult.trace,
            ]
            if (workflowResult.price != null) {
              await updateItemPriceStep(claimId, item.id, workflowResult.price, workflowResult.sources, workflowResult.source)
              log('item_priced', { claimId, itemId: item.id, item: item.name, price: workflowResult.price, source: workflowResult.source, cacheHit: false })
              progressItems[idx] = {
                id: item.id,
                name: item.name,
                priceStatus: 'found',
                price: workflowResult.price,
                source: workflowResult.source,
                trace: fullTrace,
              }
            } else {
              log('item_price_not_found', { claimId, itemId: item.id, item: item.name })
              progressItems[idx] = { id: item.id, name: item.name, priceStatus: 'error', trace: fullTrace }
            }
          }
        } catch {
          progressItems[idx] = { id: item.id, name: item.name, priceStatus: 'error' }
        }

        await publishIntakeProgressStep(intakeKey, { phase: 'pricing', items: [...progressItems] })
      })
    )
  }

  await publishIntakeProgressStep(intakeKey, { phase: 'done', items: [...progressItems] })

  const pricedCount = progressItems.filter((i) => i.priceStatus === 'found').length
  log('intake_complete', {
    claimId,
    itemCount: progressItems.length,
    pricedCount,
    notFoundCount: progressItems.length - pricedCount,
    durationMs: Math.round(performance.now() - t0),
  })
}
