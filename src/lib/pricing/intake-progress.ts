import { kv } from '@/lib/kv'
import type { PriceTraceStep } from '@/lib/pricing/trace'

const INTAKE_TTL = 60 * 60 * 24 // 24 hours

export type IntakePhase = 'extracting' | 'pricing' | 'done' | 'error'
export type ItemPriceStatus = 'queued' | 'pricing' | 'found' | 'error'

export interface IntakeProgressItem {
  id: string
  name: string
  priceStatus: ItemPriceStatus
  price?: number
  source?: string
  trace?: PriceTraceStep[]
  flagReason?: string | null
}

export interface IntakeProgress {
  phase: IntakePhase
  items: IntakeProgressItem[]
  error?: string
}

export function intakeProgressKey(intakeKey: string): string {
  return `intake:${intakeKey}`
}

export async function initIntakeProgress(intakeKey: string): Promise<void> {
  const initial: IntakeProgress = { phase: 'extracting', items: [] }
  await kv.set(intakeProgressKey(intakeKey), initial, { ex: INTAKE_TTL })
}

export async function readIntakeProgress(intakeKey: string): Promise<IntakeProgress | null> {
  return kv.get<IntakeProgress>(intakeProgressKey(intakeKey))
}

export async function writeIntakeProgress(intakeKey: string, progress: IntakeProgress): Promise<void> {
  await kv.set(intakeProgressKey(intakeKey), progress, { ex: INTAKE_TTL })
}
