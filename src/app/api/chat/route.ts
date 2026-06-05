import { streamText, tool, convertToModelMessages } from 'ai'
import { z } from 'zod'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getClaim, flagClaimItem, getPolicyRules } from '@/lib/claims'
import { triggerPriceWorkflow } from '@/lib/workflow'
import { MODELS } from '@/lib/ai/models'
import { sanitizeInput } from '@/lib/sanitize'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { messages, claimId } = await req.json()

  if (!claimId) {
    return Response.json({ error: 'claimId is required' }, { status: 400 })
  }

  const claim = await getClaim(claimId)

  if (!claim) {
    return Response.json({ error: 'Claim not found' }, { status: 404 })
  }

  const claimRules = claim.regionalRules || 'Standard HO-3 policy rules apply.'

  // Convert UI messages to model messages, sanitizing text content
  const modelMessages = await convertToModelMessages(messages)
  const sanitizedMessages = modelMessages.map((m) => {
    if (m.role === 'user' && typeof m.content === 'string') {
      return { ...m, content: sanitizeInput(m.content) }
    }
    return m
  })

  const result = streamText({
    model: MODELS.chat,
    system: `You are a claims assistant helping an insurance adjuster review claim ${claimId}.
Current claim items: ${JSON.stringify(claim.items)}
State: ${claim.state}
Policy type: ${claim.policy_type}
Regional rules: ${claimRules}

Be precise and conservative. Flag anything unusual. Always cite sources for prices.
When flagging items, provide a specific, defensible reason.
When checking policy rules, cite the relevant statute or regulation.`,
    messages: sanitizedMessages,
    tools: {
      flagItem: tool({
        description: 'Flag a claim item as needing review or investigation',
        inputSchema: z.object({
          itemId: z.string().describe('The ID of the claim item to flag'),
          reason: z
            .string()
            .describe(
              'The specific reason for flagging — must be defensible and precise'
            ),
        }),
        execute: async ({ itemId, reason }: { itemId: string; reason: string }) => {
          return flagClaimItem(claimId, itemId, reason)
        },
      }),
      refreshPrice: tool({
        description: 'Trigger a fresh price lookup for a claim item',
        inputSchema: z.object({
          itemId: z
            .string()
            .describe('The ID of the claim item to refresh pricing for'),
        }),
        execute: async ({ itemId }: { itemId: string }) => {
          const item = claim.items.find((i) => i.id === itemId)
          if (!item) {
            return { error: 'Item not found' }
          }
          return triggerPriceWorkflow(item)
        },
      }),
      checkPolicy: tool({
        description:
          'Look up policy coverage rules for a specific item category in a given state',
        inputSchema: z.object({
          category: z
            .string()
            .describe(
              'Item category (electronics, furniture, jewelry, appliances, clothing, tools, other)'
            ),
          state: z
            .string()
            .describe('Two-letter US state code (e.g., CA, FL, TX)'),
        }),
        execute: async ({ category, state }: { category: string; state: string }) => {
          const rules = await getPolicyRules(category, state)
          return { category, state, rules }
        },
      }),
    },
  })

  return result.toUIMessageStreamResponse()
}
