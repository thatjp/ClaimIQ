import type { PriceTraceStep } from '@/lib/pricing/trace'

export interface ExtractedItem {
  name: string
  brand?: string
  model?: string
  category: string
  condition: string
  quantity: number
  adjusterNotes?: string
  price?: number
  priceSources?: string[]
  priceStatus?: 'queued' | 'pending' | 'found' | 'error'
  priceSource?: ClaimItem['priceSource']
  priceTrace?: PriceTraceStep[]
  workflowRunId?: string
  /** Set after the item is persisted to the claim during price lookup. */
  claimItemId?: string
}

export const BLANK_ITEM: ExtractedItem = {
  name: '',
  brand: '',
  model: '',
  category: 'other',
  condition: 'good',
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
  quantity: number
  adjuster_notes?: string
  price?: number
  price_sources?: string[]
  priceSource?: 'cache' | 'vector_cache' | 'vector_cache_stale' | 'ebay' | 'amazon' | 'walmart' | 'bestbuy' | 'manual'
  priceTrace?: PriceTraceStep[]
  priceStale?: boolean
  approved?: boolean
  approved_at?: string
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
