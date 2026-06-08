// INTAKE WORKFLOW — full lifecycle from raw claim text to priced line items
//
// Entry point: claimIntakeWorkflow(input)
//   Called by POST /api/claims/:id/intake after the claim record is created.
//   Runs outside the request lifecycle as a durable Vercel Workflow.
//
// High-level sequence:
//   1. Signal UI: phase = "extracting"
//   2. extractItemsStep      — send text/image to Claude, get structured items back
//   3. persistItemsStep      — INSERT all items into Postgres
//   4. Signal UI: phase = "pricing", all items queued
//   5. For each item (batches of 5, in parallel):
//        a. lookupPriceFromCache  — check KV exact cache, then pgvector similarity
//        b. If cache hit → updateItemPriceStep, signal UI "found"
//        c. If cache miss → priceItemWorkflow (nested workflow, SerpAPI waterfall)
//           → updateItemPriceStep if found, signal UI "found" or "error"
//   6. Signal UI: phase = "done"
//
// Each helper marked 'use step' is a durable checkpoint. A crash mid-run resumes
// from the last completed step instead of starting over.

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

// Step 1 — AI extraction
// Sends the raw claim text (and optional photo) to Claude via generateObject.
// Returns a typed array of RawItems. Items that are vague, duplicate, or structural
// fixtures come back with flagReason set; those will be held for adjuster review.
async function extractItemsStep(text: string, imageBase64?: string | null): Promise<RawItem[]> {
  'use step'
  const t0 = Date.now()
  const result = await extractItems(text, imageBase64)
  log('extraction_complete', {
    itemCount: result.items.length,
    flaggedCount: result.items.filter((i) => i.flagReason).length,
    durationMs: Math.round(Date.now() - t0),
  })
  return result.items as RawItem[]
}

// Step 2 — Persist extracted items
// Bulk-inserts all items into claim_items in parallel. Items with a flagReason
// are stored with flagged=true so the UI can surface them immediately.
// Returns the DB rows including their generated UUIDs, which are needed for
// price updates and UI progress tracking in the steps that follow.
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

// Step 3 — Write price result back to the item row
// Called once per item after a price is found (from cache or SerpAPI).
// Records the price, which layer resolved it (source), the source URLs,
// and a timestamp so stale prices can be detected later.
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

// Step 4 — Publish UI progress to KV
// Writes the current intake state (phase + per-item status) to Vercel KV under
// intakeKey. The browser polls this key to update the progress UI in real time.
// Failures are swallowed: a KV hiccup should never abort the pricing run.
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

// Step 5 — Cache lookup (layers 1 & 2 of the pricing waterfall)
// Checks two fast local sources before falling through to paid SerpAPI calls.
//
// Layer 1 — KV exact cache: key is "price:{name}:{brand}:{condition}".
//   A hit means this exact item was priced by a previous SerpAPI run (7-day TTL).
//   Returns immediately with the cached price.
//
// Layer 2 — pgvector similarity: embeds the item description and queries item_prices
//   for the nearest neighbour above a cosine similarity threshold. Catches near-matches
//   like "Samsung 55-inch TV" resolving from a cached "Samsung QLED 55" entry.
//
// Returns null if both layers miss, signalling that priceItemWorkflow should run.
// The returned trace array records hit/miss for each layer so the UI can show
// which source resolved the price.
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
  const t0 = Date.now()
  log('intake_started', { claimId, hasImage: !!imageBase64, textLength: text.length })

  // Tell the UI we've started — browser shows a spinner on the claim page.
  await publishIntakeProgressStep(intakeKey, { phase: 'extracting', items: [] })

  // --- Phase 1: Extract ---
  // Send the raw claim text (and photo if provided) to Claude. If extraction fails
  // entirely (model error, malformed response), surface the error and bail out.
  // A partial failure (some items flagged) is not an error — those surface for review.
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

  // --- Phase 2: Persist ---
  // Write all extracted items to Postgres before starting any pricing. This ensures
  // the claim workspace can render immediately even if pricing takes 20+ seconds.
  // If the DB write fails we bail; there's nothing to price and nothing to show.
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

  // --- Phase 3: Price ---
  // Build an in-memory progress array that mirrors what the UI will display.
  // Every item starts as "queued"; we mutate this array as pricing progresses
  // and write the full snapshot to KV after each state change.
  const progressItems: IntakeProgressItem[] = persistedItems.map((item) => ({
    id: item.id,
    name: item.name,
    priceStatus: 'queued',
    flagReason: item.flag_reason ?? null,
  }))
  await publishIntakeProgressStep(intakeKey, { phase: 'pricing', items: [...progressItems] })

  // Process items in batches — runs BATCH_SIZE items concurrently, then the next
  // batch. This balances speed (not sequential) against SerpAPI rate limits and
  // KV write throughput (not all at once).
  for (let b = 0; b < persistedItems.length; b += BATCH_SIZE) {
    const batch = persistedItems.slice(b, b + BATCH_SIZE)

    await Promise.all(
      batch.map(async (item) => {
        const idx = persistedItems.indexOf(item)

        // Mark item as actively pricing and push the initial trace skeleton to the UI.
        // Derived from PRICE_LADDER so the trace shape never drifts if layers change.
        const pendingTrace = PRICE_LADDER.map(({ layer }, i) =>
          traceStep(layer, i === 0 ? 'running' : 'pending')
        )
        progressItems[idx] = { ...progressItems[idx], priceStatus: 'pricing', trace: pendingTrace }
        await publishIntakeProgressStep(intakeKey, { phase: 'pricing', items: [...progressItems] })

        try {
          // Try the two fast cache layers first (KV exact match, then pgvector similarity).
          // Either hit avoids a paid SerpAPI call entirely.
          const cacheOutcome = await lookupPriceFromCache(item)

          if (cacheOutcome) {
            // Cache hit — write the price to the DB row and update UI to "found".
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
            // Cache missed — update trace to show both cache layers as "miss" and
            // the first external engine as "running" so the UI reflects what's happening.
            const afterCacheMissTrace = PRICE_LADDER.map(({ layer }, i) => {
              if (i === 0) return traceStep(layer, 'miss')    // kv_cache
              if (i === 1) return traceStep(layer, 'miss')    // vector_cache
              if (i === 2) return traceStep(layer, 'running') // first SerpAPI engine
              return traceStep(layer, 'pending')
            })
            progressItems[idx] = { ...progressItems[idx], trace: afterCacheMissTrace }
            await publishIntakeProgressStep(intakeKey, { phase: 'pricing', items: [...progressItems] })

            // Hand off to the nested priceItemWorkflow, which walks the SerpAPI
            // engine ladder (eBay → Amazon → Walmart/Home Depot) until it gets a hit.
            // It also writes the result back to KV + pgvector so future claims benefit.
            const workflowResult = await priceItemWorkflow({
              name: item.name,
              brand: item.brand ?? undefined,
              model: item.model ?? undefined,
              category: item.category,
              condition: item.condition,
              quantity: item.quantity,
            })

            // Prepend the cache-miss steps to whatever trace priceItemWorkflow produced
            // so the UI shows the full ladder from KV through to the engine that resolved.
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
              // All engines missed — item stays unpriced for manual adjuster entry.
              log('item_price_not_found', { claimId, itemId: item.id, item: item.name })
              progressItems[idx] = { id: item.id, name: item.name, priceStatus: 'error', trace: fullTrace }
            }
          }
        } catch {
          progressItems[idx] = { id: item.id, name: item.name, priceStatus: 'error' }
        }

        // Push final state for this item regardless of outcome.
        await publishIntakeProgressStep(intakeKey, { phase: 'pricing', items: [...progressItems] })
      })
    )
  }

  // Signal completion — UI transitions from spinner to the full claim workspace.
  await publishIntakeProgressStep(intakeKey, { phase: 'done', items: [...progressItems] })

  const pricedCount = progressItems.filter((i) => i.priceStatus === 'found').length
  log('intake_complete', {
    claimId,
    itemCount: progressItems.length,
    pricedCount,
    notFoundCount: progressItems.length - pricedCount,
    durationMs: Math.round(Date.now() - t0),
  })
}
