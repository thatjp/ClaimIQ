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
  priceStatus?: 'pending' | 'found' | 'error'
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
  priceSource?: 'cache' | 'vector_cache' | 'web_search'
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
