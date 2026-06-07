import { extractItems } from '@/lib/ai/extraction'
import { db } from '@/lib/db'
import { kv } from '@/lib/kv'
import { embedItem } from '@/lib/ai/embed'
import {
  writeIntakeProgress,
  type IntakeProgress,
  type IntakeProgressItem,
} from '@/lib/pricing/intake-progress'
import { priceItemWorkflow } from '@/workflows/price'

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
  adjusterNotes?: string | null
}

interface PersistedItem {
  id: string
  name: string
  brand?: string | null
  model?: string | null
  category: string
  condition: string
  quantity: number
}

const BATCH_SIZE = 5

async function extractItemsStep(text: string, imageBase64?: string | null): Promise<RawItem[]> {
  'use step'
  const result = await extractItems(text, imageBase64)
  return result.items as RawItem[]
}

async function persistItemsStep(claimId: string, items: RawItem[]): Promise<PersistedItem[]> {
  'use step'
  const inserted = await Promise.all(
    items.map((item) =>
      db`
        INSERT INTO claim_items (
          claim_id, name, brand, model, category, condition,
          quantity, adjuster_notes, flagged
        )
        VALUES (
          ${claimId},
          ${item.name},
          ${item.brand ?? null},
          ${item.model ?? null},
          ${item.category},
          ${item.condition},
          ${item.quantity ?? 1},
          ${item.adjusterNotes ?? null},
          false
        )
        RETURNING id, name, brand, model, category, condition, quantity
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

// Inline the sync cache ladder so the workflow doesn't need to hit the /api/price
// HTTP endpoint. Falls back to priceItemWorkflow for cache misses.
async function lookupPriceFromCache(item: PersistedItem): Promise<{ price: number; sources: string[]; source: string } | null> {
  'use step'

  // Layer 1: KV exact cache
  try {
    const cacheKey = `price:${item.name}:${item.brand || ''}:${item.condition}`
    const cached = await kv.get<{ price: number; sources: string[] }>(cacheKey)
    if (cached) return { price: cached.price, sources: cached.sources, source: 'kv_cache' }
  } catch {
    // KV unavailable — fall through
  }

  // Layer 2: pgvector similarity
  try {
    const embedding = await embedItem({ name: item.name, brand: item.brand ?? undefined, condition: item.condition })
    const { rows } = await db`
      SELECT *, embedding <=> ${JSON.stringify(embedding)}::vector AS distance
      FROM item_prices
      ORDER BY embedding <=> ${JSON.stringify(embedding)}::vector
      LIMIT 1
    `
    const distance = rows[0]?.distance as number | undefined
    if (rows.length > 0 && distance != null && distance < 0.15) {
      return {
        price: parseFloat(rows[0].price as string),
        sources: (rows[0].sources as string[]) ?? [],
        source: 'vector_cache',
      }
    }
  } catch {
    // pgvector unavailable — fall through
  }

  return null
}

export async function claimIntakeWorkflow(input: IntakeInput): Promise<void> {
  'use workflow'

  const { intakeKey, claimId, text, imageBase64 } = input

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
  }))
  await publishIntakeProgressStep(intakeKey, { phase: 'pricing', items: [...progressItems] })

  // Price in batches of BATCH_SIZE — bounds concurrency and keeps event log manageable
  for (let b = 0; b < persistedItems.length; b += BATCH_SIZE) {
    const batch = persistedItems.slice(b, b + BATCH_SIZE)

    await Promise.all(
      batch.map(async (item) => {
        const idx = persistedItems.indexOf(item)

        progressItems[idx] = { ...progressItems[idx], priceStatus: 'pricing' }
        await publishIntakeProgressStep(intakeKey, { phase: 'pricing', items: [...progressItems] })

        try {
          // Try cache first (step), then fall back to full workflow (direct await composition)
          let outcome = await lookupPriceFromCache(item)

          if (!outcome) {
            const workflowResult = await priceItemWorkflow({
              name: item.name,
              brand: item.brand ?? undefined,
              model: item.model ?? undefined,
              category: item.category,
              condition: item.condition,
              quantity: item.quantity,
            })
            if (workflowResult.price != null) {
              outcome = {
                price: workflowResult.price,
                sources: workflowResult.sources,
                source: workflowResult.source,
              }
            }
          }

          if (outcome) {
            await updateItemPriceStep(claimId, item.id, outcome.price, outcome.sources, outcome.source)
            progressItems[idx] = {
              id: item.id,
              name: item.name,
              priceStatus: 'found',
              price: outcome.price,
              source: outcome.source,
            }
          } else {
            progressItems[idx] = { id: item.id, name: item.name, priceStatus: 'error' }
          }
        } catch {
          progressItems[idx] = { id: item.id, name: item.name, priceStatus: 'error' }
        }

        await publishIntakeProgressStep(intakeKey, { phase: 'pricing', items: [...progressItems] })
      })
    )
  }

  await publishIntakeProgressStep(intakeKey, { phase: 'done', items: [...progressItems] })
}
