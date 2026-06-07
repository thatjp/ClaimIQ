import { db } from '@/lib/db'
import { triggerIntakeWorkflow } from '@/lib/workflow'

export const maxDuration = 60

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: claimId } = await params

  const { rows } = await db`SELECT id FROM claims WHERE id = ${claimId} LIMIT 1`
  if (rows.length === 0) {
    return Response.json({ error: 'Claim not found' }, { status: 404 })
  }

  let body: { text?: string; imageBase64?: string | null }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.text?.trim()) {
    return Response.json({ error: 'text is required' }, { status: 400 })
  }

  try {
    const result = await triggerIntakeWorkflow(claimId, body.text, body.imageBase64)
    return Response.json(result, { status: 202 })
  } catch (err) {
    console.error('[intake] Failed to trigger workflow:', err)
    return Response.json({ error: 'Failed to start intake' }, { status: 500 })
  }
}
