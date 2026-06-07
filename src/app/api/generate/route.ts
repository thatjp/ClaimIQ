import { streamText } from 'ai'
import { put } from '@vercel/blob'
import { getClaim } from '@/lib/claims'
import { getClaimReadiness } from '@/lib/claims/grounding'
import { MODELS, gatewayProviderOptions } from '@/lib/ai/models'

async function saveClaimDocument(claimId: string, text: string) {
  try {
    await put(`claims/${claimId}/document.txt`, text, {
      access: 'private',
      contentType: 'text/plain',
    })
  } catch (error) {
    console.error('Failed to save claim document to Blob:', error)
  }
}

export async function POST(req: Request) {
  const { claimId } = await req.json()

  if (!claimId) {
    return Response.json({ error: 'claimId is required' }, { status: 400 })
  }

  const claim = await getClaim(claimId)
  if (!claim) {
    return Response.json({ error: 'Claim not found' }, { status: 404 })
  }

  const readiness = getClaimReadiness(claim.items)
  if (!readiness.canGenerateDocument) {
    return Response.json(
      {
        error: 'All line items must be approved with price and source URL before generating a document',
        readiness,
      },
      { status: 422 }
    )
  }

  const approvedItems = claim.items.filter((item) => item.approved)

  const regionalRules =
    req.headers.get('x-claim-rules') || 'Standard HO-3 policy rules apply.'

  const result = streamText({
    model: MODELS.docGen,
    providerOptions: gatewayProviderOptions,
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
    onFinish: ({ text }) => {
      void saveClaimDocument(claimId, text)
    },
  })

  return result.toTextStreamResponse()
}
