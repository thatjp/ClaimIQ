import { db } from '@/lib/db'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: claimId } = await params
  const { items } = await req.json()

  if (!Array.isArray(items) || items.length === 0) {
    return Response.json({ error: 'items array is required' }, { status: 400 })
  }

  try {
    const inserted = await Promise.all(
      items.map((item) =>
        db`
          INSERT INTO claim_items (
            claim_id, name, brand, model, category, condition,
            quantity, adjuster_notes, price, price_sources, flagged
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
            ${item.price ?? null},
            ${item.priceSources ? JSON.stringify(item.priceSources) : null},
            false
          )
          RETURNING *
        `
      )
    )
    return Response.json({ items: inserted.map((r) => r.rows[0]) }, { status: 201 })
  } catch (err) {
    console.error('Failed to insert claim items:', err)
    return Response.json({ error: 'Failed to save items' }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: claimId } = await params
  const { itemIds } = await req.json() as { itemIds: string[] }

  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return Response.json({ error: 'itemIds array is required' }, { status: 400 })
  }

  try {
    const { rows } = await db`
      DELETE FROM claim_items
      WHERE claim_id = ${claimId} AND id = ANY(${itemIds}::uuid[])
      RETURNING id
    `
    return Response.json({ deleted: rows.map((r) => r.id as string) })
  } catch (err) {
    console.error('Failed to bulk delete claim items:', err)
    return Response.json({ error: 'Failed to delete items' }, { status: 500 })
  }
}
