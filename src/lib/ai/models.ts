import { createGateway } from '@ai-sdk/gateway'

const gateway = createGateway()

export const MODELS = {
  extraction: gateway('openai/gpt-4o'),
  priceNorm: gateway('openai/gpt-4o-mini'),
  chat: gateway('openai/gpt-4o'),
  docGen: gateway('anthropic/claude-sonnet-4.6'),
}
