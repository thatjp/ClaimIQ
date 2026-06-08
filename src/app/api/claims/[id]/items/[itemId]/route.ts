import { db } from '@/lib/db'
import { kv } from '@/lib/kv'
import { embedItem } from '@/lib/ai/embed'
import { getClaim, updateClaimItem, type UpdateClaimItemInput } from '@/lib/claims'
import { canApproveItem } from '@/lib/claims/grounding'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: claimId, itemId } = await params
  const body = await req.json()

  const updates: UpdateClaimItemInput = {}

  if ('name' in body) {
    if (!body.name || typeof body.name !== 'string') {
      return Response.json({ error: 'name must be a non-empty string' }, { status: 400 })
    }
    updates.name = body.name.trim()
  }

  if ('brand' in body) updates.brand = body.brand ? String(body.brand).trim() : null
  if ('model' in body) updates.model = body.model ? String(body.model).trim() : null

  if ('category' in body) {
    const valid = ['electronics', 'appliances', 'furniture', 'clothing', 'jewelry', 'tools', 'other']
    if (!valid.includes(body.category)) {
      return Response.json({ error: 'Invalid category' }, { status: 400 })
    }
    updates.category = body.category
  }

  if ('condition' in body) {
    const valid = ['new', 'good', 'fair', 'poor']
    if (!valid.includes(body.condition)) {
      return Response.json({ error: 'Invalid condition' }, { status: 400 })
    }
    updates.condition = body.condition
  }

  if ('quantity' in body) {
    const qty = Number(body.quantity)
    if (!Number.isInteger(qty) || qty < 1) {
      return Response.json({ error: 'quantity must be a positive integer' }, { status: 400 })
    }
    updates.quantity = qty
  }

  if ('price_sources' in body) {
    if (!Array.isArray(body.price_sources)) {
      return Response.json({ error: 'price_sources must be an array' }, { status: 400 })
    }
    updates.price_sources = body.price_sources
    updates.approved = false
  }

  if ('price' in body) {
    updates.price = body.price == null ? null : Number(body.price)
    updates.approved = false
  }

  if ('price_source' in body && !('manualPrice' in body)) {
    updates.price_source = body.price_source as UpdateClaimItemInput['price_source']
  }

  if ('manualPrice' in body) {
    const manualPrice = Number(body.manualPrice)
    if (isNaN(manualPrice) || manualPrice <= 0) {
      return Response.json({ error: 'manualPrice must be a positive number' }, { status: 400 })
    }
    updates.price = manualPrice
    updates.price_source = 'manual'
    updates.approved = false

    // Feed manual price into the cache so future similarity lookups benefit from it
    const item = {
      name: body.itemName as string,
      brand: body.itemBrand as string | undefined,
      condition: body.itemCondition as string,
    }
    if (item.name && item.condition) {
      const cacheKey = `price:${item.name}:${item.brand || ''}:${item.condition}`
      await Promise.allSettled([
        kv.set(cacheKey, { price: manualPrice, sources: [], cached_at: new Date().toISOString() }, { ex: 60 * 60 * 24 * 7 }),
        (async () => {
          const embedding = await embedItem({ name: item.name, brand: item.brand, condition: item.condition })
          await db`
            INSERT INTO item_prices (name, brand, condition, price, sources, embedding, cached_at)
            VALUES (${item.name}, ${item.brand || ''}, ${item.condition}, ${manualPrice}, ${JSON.stringify([])}, ${JSON.stringify(embedding)}::vector, NOW())
            ON CONFLICT (name, brand, condition) DO UPDATE
            SET price = EXCLUDED.price, sources = EXCLUDED.sources, embedding = EXCLUDED.embedding, cached_at = NOW()
          `
        })(),
      ])
    }
  }

  if ('flagged' in body) {
    updates.flagged = body.flagged === true
  }

  if ('flag_reason' in body) {
    updates.flag_reason = body.flag_reason == null ? null : String(body.flag_reason)
  }

  if ('approved' in body) {
    updates.approved = body.approved === true
    if (updates.approved) {
      const claim = await getClaim(claimId)
      const item = claim?.items.find((i) => i.id === itemId)
      if (!item) {
        return Response.json({ error: 'Item not found' }, { status: 404 })
      }
      const candidate = {
        ...item,
        ...updates,
        brand: updates.brand ?? item.brand ?? undefined,
        model: updates.model ?? item.model ?? undefined,
        price_sources: updates.price_sources ?? item.price_sources,
        price: 'price' in updates ? (updates.price ?? undefined) : item.price,
        flag_reason:
          'flag_reason' in updates
            ? (updates.flag_reason ?? undefined)
            : item.flag_reason,
      }
      if (!canApproveItem(candidate)) {
        return Response.json(
          { error: 'Item must have price and source URL before approval' },
          { status: 400 }
        )
      }
    }
  }

  const result = await updateClaimItem(claimId, itemId, updates)
  if (!result.item) {
    return Response.json({ error: result.error ?? 'Update failed' }, { status: 400 })
  }

  return Response.json({ item: result.item })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: claimId, itemId } = await params

  try {
    const { rows } = await db`
      DELETE FROM claim_items
      WHERE id = ${itemId} AND claim_id = ${claimId}
      RETURNING id
    `
    if (rows.length === 0) {
      return Response.json({ error: 'Item not found' }, { status: 404 })
    }
    return Response.json({ deleted: true })
  } catch (err) {
    console.error('Failed to delete claim item:', err)
    return Response.json({ error: 'Failed to delete item' }, { status: 500 })
  }
}
