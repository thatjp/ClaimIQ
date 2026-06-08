// PRICE WORKFLOW — SerpAPI engine ladder for a single item
//
// Called by claimIntakeWorkflow when both cache layers miss for an item.
// Also callable standalone from the claim workspace (manual re-price).
//
// Sequence:
//   1. Resolve the engine list for the item's category (e.g. electronics → [ebay, amazon, walmart])
//   2. For each engine in order:
//        a. publishLiveTrace  — write "running" state to KV so the UI updates in real time
//        b. lookupSerpEngine  — hit the SerpAPI endpoint, average the returned prices
//        c. publishLiveTrace  — write hit/miss result to KV
//        d. If hit: cachePrice — write to KV (7-day TTL) + pgvector (for future similarity)
//           and return the price immediately (short-circuit)
//   3. If all engines miss, return price: null — caller marks the item as unpriced
//
// Each function marked 'use step' is a durable checkpoint. A crash during a SerpAPI
// call resumes from the last completed engine rather than re-querying all of them.

import { kv } from '@/lib/kv'
import { db } from '@/lib/db'
import { embedItem } from '@/lib/ai/embed'
import { traceStep, type PriceTraceStep, type PriceLayer } from '@/lib/pricing/trace'
import { updateLiveTrace } from '@/lib/pricing/live-trace'
import { fetchSerpPrice, getEnginesForCategory, type SerpEngine } from '@/lib/pricing/serp'
import type { ClaimItemInput } from '@/lib/workflow'

function log(layer: string, hit: boolean, durationMs: number, meta?: Record<string, unknown>) {
  console.log(JSON.stringify({ service: 'price-workflow', layer, hit, durationMs, ...meta }))
}

// Step A — Query one SerpAPI engine
// Fetches live listings from the given marketplace (eBay, Amazon, Walmart, or Home Depot),
// averages the returned prices, and returns a hit/miss result with source URLs.
// Wrapped in 'use step' so the workflow can checkpoint after each engine — a crash
// mid-ladder won't re-query engines that already completed.
async function lookupSerpEngine(engine: SerpEngine, item: ClaimItemInput) {
  'use step'

  const result = await fetchSerpPrice(engine, item)
  log(engine, !!result.value, result.durationMs, {
    item: item.name,
    price: result.value?.price,
    ...(result.detail ? { detail: result.detail } : {}),
  })
  return result
}

// Step B — Write price to both cache layers simultaneously
// Called immediately after a SerpAPI hit. Runs KV and pgvector writes in parallel
// via Promise.allSettled so a failure in one doesn't block the other.
//
// KV write: exact-match key with a 7-day TTL — fast O(1) lookup for repeat items.
// pgvector write: embeds the item description (Voyage AI, 512-dim) and upserts into
//   item_prices. Future claims with semantically similar items will hit this row via
//   cosine similarity instead of going back to SerpAPI.
async function cachePrice(item: ClaimItemInput, price: number, sources: string[]) {
  'use step'

  const cacheKey = `price:${item.name}:${item.brand || ''}:${item.condition}`
  const t0 = Date.now()

  await Promise.allSettled([
    kv.set(cacheKey, { price, sources, cached_at: new Date().toISOString() }, { ex: 60 * 60 * 24 * 7 }),
    (async () => {
      const embedding = await embedItem(item)
      await db`
        INSERT INTO item_prices (name, brand, condition, price, sources, embedding, cached_at)
        VALUES (${item.name}, ${item.brand || ''}, ${item.condition}, ${price}, ${JSON.stringify(sources)}, ${JSON.stringify(embedding)}::vector, NOW())
        ON CONFLICT (name, brand, condition) DO UPDATE
        SET price = EXCLUDED.price, sources = EXCLUDED.sources, embedding = EXCLUDED.embedding, cached_at = NOW()
      `
    })(),
  ])
  log('cache_write', true, Math.round(Date.now() - t0), { item: item.name, price })
}

// Step C — Push live trace state to KV
// Writes the current ladder state (which engines ran, hit/miss/running) to Vercel KV
// under traceKey. The claim workspace polls this to animate the price trace in real time.
// Failures are swallowed — a KV hiccup should never abort a pricing run.
async function publishLiveTrace(traceKey: string | undefined, steps: PriceTraceStep[]) {
  'use step'

  if (!traceKey) return
  try {
    await updateLiveTrace(traceKey, { workflowTrace: steps })
  } catch (err) {
    console.warn('[price-workflow] live trace update failed:', err instanceof Error ? err.message : err)
  }
}

export async function priceItemWorkflow(item: ClaimItemInput) {
  'use workflow'

  const workflowTrace: PriceTraceStep[] = []
  const traceKey = item.traceKey

  // Resolve which marketplaces to try based on category.
  // Electronics → [ebay, amazon, walmart]; appliances/tools → [home_depot, amazon, walmart], etc.
  const engines = getEnginesForCategory(item.category)

  for (const engine of engines) {
    const layer = engine as PriceLayer

    // Before querying: mark this engine as "running" in the live trace so the UI
    // shows an active spinner on the correct row.
    await publishLiveTrace(traceKey, [...workflowTrace, traceStep(layer, 'running')])

    const result = await lookupSerpEngine(engine, item)

    // Record the result (hit or miss) and push to the UI before deciding whether to continue.
    workflowTrace.push(traceStep(layer, result.value ? 'hit' : 'miss', result.durationMs, result.detail))
    await publishLiveTrace(traceKey, workflowTrace)

    if (result.value) {
      // First hit short-circuits the ladder. Write to both caches so the next claim
      // with this item (or a similar one) doesn't pay the SerpAPI cost again.
      await cachePrice(item, result.value.price, result.value.sources)
      return { price: result.value.price, sources: result.value.sources, source: engine, trace: workflowTrace }
    }
    // Miss — continue to next engine in the ladder.
  }

  // All engines exhausted with no price found. Caller will mark the item as unpriced.
  return { price: null, sources: [], source: 'not_found' as const, trace: workflowTrace }
}
