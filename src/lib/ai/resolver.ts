/*
 * AI SDK
 * The flagged item resolution pipeline is probably the most comprehensive use of the AI SDK.
 * While it is used elsewhere in the application such as in the intake pipeline for extracting fields,
 * This is a more complex use case for it. 
 * 
 * Creating a tool for each posisble flag action helped smooth out the triage flow. 
 * I originally opened up the claims page to raw manual edits to lean on the 
 * adjusters intuation however I already had AI powered flagging in place. 
 * It was not a far stretch for me to add a tool for each flag action.
 *
 * Using stopWhen: stepCountIs(5) helped in stopping the agent from calling tools indefinitely.
 * The flagging resolution system was one of the last pieces of the application, as such I had 
 * seen some runaway behavior previously in workflows UI. Being aware of those pitfalls I 
 * implemented the stopWhen limit.
 */
import { generateText, stepCountIs } from 'ai'
import { MODELS, gatewayProviderOptions } from '@/lib/ai/models'
import { searchSimilarItemsTool } from '@/lib/ai/tools/search-similar-items'
import { searchMarketplaceTool } from '@/lib/ai/tools/search-marketplace'
import { createListClaimItemsTool } from '@/lib/ai/tools/list-claim-items'
import { createSubmitSuggestionTool } from '@/lib/ai/tools/submit-suggestion'
import type { ClaimItem } from '@/types/items'
import type { ItemSuggestion, ResolveResult, ToolCallSummary } from '@/lib/ai/resolver-types'

export interface ResolveFlaggedItemInput {
  claimId: string
  item: ClaimItem
  hint?: string
}

function isStructuralFlag(reason: string): boolean {
  const lower = reason.toLowerCase()
  return (
    lower.includes('structural') ||
    lower.includes('fixture') ||
    lower.includes('cabinet') ||
    lower.includes('flooring') ||
    lower.includes('wall') ||
    lower.includes('ceiling') ||
    lower.includes('countertop') ||
    lower.includes('built-in')
  )
}

function summarizeToolResult(toolName: string, result: unknown): string {
  if (!result || typeof result !== 'object') return 'completed'
  const r = result as Record<string, unknown>

  switch (toolName) {
    case 'searchSimilarItems':
      return `${r.matchCount ?? 0} similar cached item${r.matchCount === 1 ? '' : 's'}`
    case 'searchMarketplace': {
      const engine = r.engine ?? 'marketplace'
      const count = r.listingCount ?? 0
      const avg = r.averagePrice != null ? `, avg $${r.averagePrice}` : ''
      return `${engine}: ${count} listing${count === 1 ? '' : 's'}${avg}`
    }
    case 'listClaimItems':
      return `${Array.isArray(r.items) ? r.items.length : 0} items on claim`
    case 'submitSuggestion':
      return 'suggestion submitted'
    default:
      return 'completed'
  }
}

function extractToolCalls(
  steps: Array<{ toolResults?: Array<{ toolName: string; output: unknown }> }>
): ToolCallSummary[] {
  const calls: ToolCallSummary[] = []
  for (const step of steps) {
    for (const result of step.toolResults ?? []) {
      calls.push({
        tool: result.toolName,
        summary: summarizeToolResult(result.toolName, result.output),
      })
    }
  }
  return calls
}

export async function resolveFlaggedItem(input: ResolveFlaggedItemInput): Promise<ResolveResult> {
  const { claimId, item, hint } = input
  let capturedSuggestion: ItemSuggestion | null = null

  const tools = {
    searchSimilarItems: searchSimilarItemsTool,
    searchMarketplace: searchMarketplaceTool,
    listClaimItems: createListClaimItemsTool(claimId),
    submitSuggestion: createSubmitSuggestionTool((s) => {
      capturedSuggestion = s
    }),
  }

  const structural = item.flag_reason ? isStructuralFlag(item.flag_reason) : false

  const result = await generateText({
    model: MODELS.resolver,
    providerOptions: gatewayProviderOptions,
    tools,
    toolChoice: 'auto',
    stopWhen: stepCountIs(5),
    system: `You resolve flagged insurance claim line items for adjusters.

Rules:
- Only use data from tool results. Do not invent brand names or model numbers.
- For structural/fixture items (cabinets, flooring, walls, built-ins): recommend action "exclude" with clearFlag false. Do NOT call searchMarketplace.
- For duplicate items: call listClaimItems first, then suggest action "merge" with mergeIntoItemId set to the sibling item id.
- For vague items: try searchSimilarItems first, then searchMarketplace if needed.
- You MUST finish by calling submitSuggestion with your recommendation.
- Set confidence "low" when tools return no useful matches.
- For action "update", provide specific name/brand/model/category when possible and set clearFlag true only when the item is now specific enough to price.`,
    prompt: `Resolve this flagged claim item:

Item ID: ${item.id}
Name: ${item.name}
Brand: ${item.brand ?? '(none)'}
Model: ${item.model ?? '(none)'}
Category: ${item.category}
Condition: ${item.condition}
Quantity: ${item.quantity}
Flag reason: ${item.flag_reason ?? '(unknown)'}
Structural/fixture item: ${structural ? 'yes' : 'no'}
${hint ? `Adjuster hint: ${hint}` : ''}

Call the appropriate tools, then submitSuggestion with your final recommendation.`,
  })

  const toolCalls = extractToolCalls(result.steps ?? [])

  return {
    suggestion: capturedSuggestion,
    reasoning: result.text,
    toolCalls,
    steps: result.steps?.length ?? 0,
    unresolved: capturedSuggestion == null,
  }
}
