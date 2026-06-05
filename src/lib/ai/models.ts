import { createGateway } from '@ai-sdk/gateway'

const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY,
  providerOptions: {
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
    },
  },
})

export const MODELS = {
  extraction: gateway('openai/gpt-4o'),
  priceNorm: gateway('openai/gpt-4o-mini'),
  chat: gateway('openai/gpt-4o'),
  docGen: gateway('openai/gpt-4o'),
}
