import { createGateway } from '@ai-sdk/gateway'

const gateway = createGateway()

export const MODELS = {
  extraction: gateway('anthropic/claude-sonnet-4-5'),
  priceNorm: gateway('anthropic/claude-haiku-4-5'),
  chat: gateway('anthropic/claude-sonnet-4-5'),
  docGen: gateway('anthropic/claude-sonnet-4-5'),
}
