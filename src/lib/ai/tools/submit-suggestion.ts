import { tool } from 'ai'
import { ItemSuggestionSchema, type ItemSuggestion } from '@/lib/ai/resolver-types'

export function createSubmitSuggestionTool(onCapture: (suggestion: ItemSuggestion) => void) {
  return tool({
    description:
      'Submit the final resolution suggestion. You MUST call this tool to complete resolution. Never invent model numbers not supported by prior tool results.',
    inputSchema: ItemSuggestionSchema,
    execute: async (input) => {
      const suggestion = ItemSuggestionSchema.parse(input)
      onCapture(suggestion)
      return { accepted: true, suggestion }
    },
  })
}
