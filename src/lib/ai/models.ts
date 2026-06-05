import { createGateway } from '@ai-sdk/gateway'

const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY,
})

export const MODELS = {
  extraction: gateway('openai/gpt-4o-mini'),
  priceNorm: gateway('openai/gpt-4o-mini'),
  chat: gateway('openai/gpt-4o-mini'),
  docGen: gateway('openai/gpt-4o-mini'),
}
