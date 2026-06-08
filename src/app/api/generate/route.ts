import { streamText } from 'ai'
import { getClaim } from '@/lib/claims'
import { MODELS, gatewayProviderOptions } from '@/lib/ai/models'

export async function POST(req: Request) {
  const { claimId, itemIds } = await req.json() as { claimId: string; itemIds?: string[] }

  if (!claimId) {
    return Response.json({ error: 'claimId is required' }, { status: 400 })
  }

  const claim = await getClaim(claimId)
  if (!claim) {
    return Response.json({ error: 'Claim not found' }, { status: 404 })
  }

  const approvedItems = claim.items.filter((item) =>
    itemIds ? itemIds.includes(item.id) : item.approved
  )

  if (approvedItems.length === 0) {
    return Response.json({ error: 'No items selected for document generation' }, { status: 422 })
  }

  const regionalRules = req.headers.get('x-claim-rules') || 'Standard HO-3 policy rules apply.'

  const result = streamText({
    model: MODELS.docGen,
    providerOptions: gatewayProviderOptions,
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'generate-claim-document',
      metadata: { claimId },
    },
    system: `You are generating a professional insurance claim document for submission.
Format the document with clear sections and use precise, defensible language.
Every line item MUST include: item name, condition, replacement value, and source URL.
Flag any items where the price source is older than 90 days with [STALE PRICE - VERIFY].
Flag any items without a price source with [UNSOURCED - REQUIRES VERIFICATION].
Use standard insurance industry formatting with dollar amounts, dates, and policy references.
Be conservative and accurate — this document has legal standing.
Regional rules: ${regionalRules}`,
    prompt: `Generate a complete, professional insurance claim document for the following claim data.
Only include these approved, grounded line items:

${JSON.stringify({ ...claim, items: approvedItems }, null, 2)}

The document should include:
1. Claim Summary (claim ID, date of loss, policy type, state, adjuster)
2. Policyholder Information
3. Itemized Loss Schedule (table with all items, conditions, ages, values, sources)
4. Total Replacement Cost Value
5. Total Actual Cash Value (with depreciation applied)
6. Supporting Notes and Flagged Items
7. Adjuster Certification Statement

Format as a professional document ready for submission.`,
  })

  return result.toTextStreamResponse()
}
