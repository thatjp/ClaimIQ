import { createGateway } from '@ai-sdk/gateway'
import { createAnthropic } from '@ai-sdk/anthropic'

const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY,
})

// Direct Anthropic client for features not yet supported through the gateway (web search)
export const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export const MODELS = {
  extraction: gateway('anthropic/claude-haiku-4-5'),
  priceSearch: anthropic('claude-sonnet-4-5'),
  priceNorm: gateway('anthropic/claude-haiku-4-5'),
  chat: gateway('anthropic/claude-haiku-4-5'),
  docGen: gateway('anthropic/claude-haiku-4-5'),
}
