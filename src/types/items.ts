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
