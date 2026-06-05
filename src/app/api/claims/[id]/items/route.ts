import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
            estimated_age, quantity, adjuster_notes, price, flagged
          )
          VALUES (
            ${claimId},
            ${item.name},
            ${item.brand ?? null},
            ${item.model ?? null},
            ${item.category},
            ${item.condition},
            ${item.estimatedAge ?? null},
            ${item.quantity ?? 1},
            ${item.adjusterNotes ?? null},
            ${item.price ?? null},
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
