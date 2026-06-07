import { createGateway, type GatewayProviderOptions } from '@ai-sdk/gateway'

const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY,
})

const GATEWAY_FALLBACK_MODELS = ['openai/gpt-4o-mini', 'google/gemini-2.0-flash'] as const

export const gatewayProviderOptions = {
  gateway: {
    models: [...GATEWAY_FALLBACK_MODELS],
  } satisfies GatewayProviderOptions,
}

export const MODELS = {
  extraction: gateway('anthropic/claude-haiku-4-5'),
  priceNorm: gateway('anthropic/claude-haiku-4-5'),
  chat: gateway('anthropic/claude-haiku-4-5'),
  docGen: gateway('anthropic/claude-haiku-4-5'),
}
