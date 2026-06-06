import type { PriceTraceStep } from '@/lib/pricing/trace'

export interface ExtractedItem {
  name: string
  brand?: string
  model?: string
  category: string
  condition: string
  estimatedAge?: number
  quantity: number
  adjusterNotes?: string
  price?: number
  priceSources?: string[]
  priceStatus?: 'queued' | 'pending' | 'found' | 'error'
  priceSource?: ClaimItem['priceSource']
  priceTrace?: PriceTraceStep[]
  workflowRunId?: string
}

export const BLANK_ITEM: ExtractedItem = {
  name: '',
  brand: '',
  model: '',
  category: 'other',
  condition: 'good',
  estimatedAge: undefined,
  quantity: 1,
}

export const CATEGORIES = ['electronics', 'appliances', 'furniture', 'clothing', 'jewelry', 'tools', 'other']
export const CONDITIONS = ['new', 'good', 'fair', 'poor']

export interface ClaimItem {
  id: string
  name: string
  brand?: string
  model?: string
  category: string
  condition: string
  estimated_age?: number
  quantity: number
  adjuster_notes?: string
  price?: number
  price_sources?: string[]
  priceSource?: 'cache' | 'vector_cache' | 'vector_cache_stale' | 'ebay' | 'web_search' | 'estimated'
  priceTrace?: PriceTraceStep[]
  priceStale?: boolean
  flagged: boolean
  flag_reason?: string
}

export interface Claim {
  id: string
  state: string
  policy_type: string
  date_of_loss: string
  status: string
  created_at: string
  items: ClaimItem[]
}
