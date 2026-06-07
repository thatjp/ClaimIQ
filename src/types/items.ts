import type { PriceTraceStep } from '@/lib/pricing/trace'

export type PriceSource = 'kv_cache' | 'vector_cache' | 'vector_cache_stale' | 'ebay' | 'amazon' | 'walmart' | 'home_depot' | 'manual'

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
  priceSource?: PriceSource
  priceTrace?: PriceTraceStep[]
  workflowRunId?: string
  /** Set after the item is persisted to the claim during price lookup. */
  claimItemId?: string
}

export interface ClaimItem {
  id: string
  claim_id?: string
  name: string
  brand?: string
  model?: string
  category: string
  condition: string
  estimated_age?: number
  quantity: number
  adjuster_notes?: string
  price?: number
  price_source?: PriceSource
  price_sources?: string[]
  price_cached_at?: string
  priceSource?: PriceSource
  priceTrace?: PriceTraceStep[]
  priceStale?: boolean
  approved?: boolean
  approved_at?: string
  flagged: boolean
  flag_reason?: string
  created_at?: string
}

export interface Claim {
  id: string
  user_id?: string
  title?: string | null
  state: string
  policy_type: string
  date_of_loss: string
  status: string
  created_at: string
  updated_at?: string
  items: ClaimItem[]
  regionalRules?: string
  policyType?: string
}
