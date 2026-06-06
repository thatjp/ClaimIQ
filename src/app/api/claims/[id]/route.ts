import { getClaim } from '@/lib/claims'
import { db } from '@/lib/db'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const claim = await getClaim(id)

  if (!claim) {
    return Response.json({ error: 'Claim not found' }, { status: 404 })
  }

  return Response.json(claim)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const { rows } = await db`
      DELETE FROM claims WHERE id = ${id} AND user_id = 'demo' RETURNING id
    `
    if (rows.length === 0) {
      return Response.json({ error: 'Claim not found' }, { status: 404 })
    }
    return Response.json({ deleted: true })
  } catch (err) {
    console.error('Failed to delete claim:', err)
    return Response.json({ error: 'Failed to delete claim' }, { status: 500 })
  }
}
