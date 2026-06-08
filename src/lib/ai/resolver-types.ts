import { z } from 'zod'

export const ItemSuggestionSchema = z.object({
  action: z.enum(['update', 'exclude', 'merge']),
  name: z.string().optional(),
  brand: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  category: z
    .enum(['electronics', 'appliances', 'furniture', 'clothing', 'jewelry', 'tools', 'other'])
    .optional(),
  condition: z.enum(['new', 'good', 'fair', 'poor']).optional(),
  quantity: z.number().int().positive().optional(),
  clearFlag: z.boolean(),
  mergeIntoItemId: z.string().uuid().optional(),
  confidence: z.enum(['high', 'medium', 'low']),
  rationale: z.string(),
})

export type ItemSuggestion = z.infer<typeof ItemSuggestionSchema>

export interface ToolCallSummary {
  tool: string
  summary: string
}

export interface ResolveResult {
  suggestion: ItemSuggestion | null
  reasoning: string
  toolCalls: ToolCallSummary[]
  steps: number
  unresolved: boolean
}
