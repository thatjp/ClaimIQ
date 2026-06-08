import { getClaim } from '@/lib/claims'
import { resolveFlaggedItem } from '@/lib/ai/resolver'

export const maxDuration = 60

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: claimId, itemId } = await params

  const claim = await getClaim(claimId)
  if (!claim) {
    return Response.json({ error: 'Claim not found' }, { status: 404 })
  }

  const item = claim.items.find((i) => i.id === itemId)
  if (!item) {
    return Response.json({ error: 'Item not found' }, { status: 404 })
  }

  if (!item.flagged) {
    return Response.json({ error: 'Item is not flagged' }, { status: 400 })
  }

  let hint: string | undefined
  try {
    const body = await req.json()
    if (body?.hint && typeof body.hint === 'string') {
      hint = body.hint.trim() || undefined
    }
  } catch {
    // empty body is fine
  }

  try {
    const result = await resolveFlaggedItem({ claimId, item, hint })
    return Response.json(result)
  } catch (err) {
    console.error('[resolve] Failed:', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Resolution failed' },
      { status: 500 }
    )
  }
}
