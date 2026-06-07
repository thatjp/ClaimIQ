import { createGateway, type GatewayProviderOptions } from '@ai-sdk/gateway'

const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY,
})

export const gatewayProviderOptions = {
  gateway: {
    models: ['openai/gpt-4o-mini', 'google/gemini-2.5-flash'],
  } satisfies GatewayProviderOptions,
}

export const MODELS = {
  extraction: gateway('anthropic/claude-haiku-4-5-20251001'),
  priceNorm: gateway('anthropic/claude-haiku-4-5-20251001'),
  docGen: gateway('anthropic/claude-haiku-4-5-20251001'),
}
