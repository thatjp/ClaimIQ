import { getClaim, updateClaimItem, type UpdateClaimItemInput } from '@/lib/claims'
import { canApproveItem } from '@/lib/claims/grounding'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id: claimId, itemId } = await params
  const body = await req.json()

  const updates: UpdateClaimItemInput = {}

  if ('estimated_age' in body) {
    const age = body.estimated_age
    updates.estimated_age =
      age === null || age === '' ? null : Number(age)
    if (updates.estimated_age != null && Number.isNaN(updates.estimated_age)) {
      return Response.json({ error: 'Invalid estimated_age' }, { status: 400 })
    }
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
        estimated_age:
          'estimated_age' in updates ? (updates.estimated_age ?? undefined) : item.estimated_age,
        price_sources: updates.price_sources ?? item.price_sources,
        price: 'price' in updates ? (updates.price ?? undefined) : item.price,
      }
      if (!canApproveItem(candidate)) {
        return Response.json(
          { error: 'Item must have price, source URL, and age before approval' },
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
