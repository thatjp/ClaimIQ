/*
 * VERCEL AI GATEWAY
 * I chose to route most model calls through the Vercel AI Gateway
 * rather than hitting provider APIs directly. Early on I was managing separate
 * keys for Anthropic and had no real visibility into what was being called or
 * how much it was costing across the different parts of the app. 
 *
 * The fallback list was the other reason. Haiku went down a few times early on
 * but the application was able to recover and continue on.
 * 
 */
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
  resolver: gateway('anthropic/claude-haiku-4-5-20251001'),
  docGen: gateway('anthropic/claude-haiku-4-5-20251001'),
}
