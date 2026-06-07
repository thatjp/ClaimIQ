'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { IntakeProgress } from '@/lib/pricing/intake-progress'

export type { IntakeProgress }
export type { IntakeProgressItem, IntakePhase, ItemPriceStatus } from '@/lib/pricing/intake-progress'

export type IntakeStage = 'form' | 'triggering' | 'polling' | 'done' | 'error'

export interface IntakeWorkflowState {
  stage: IntakeStage
  progress: IntakeProgress | null
  triggerError: string | null
}

const POLL_INTERVAL_MS = 2000
const MAX_POLLS = 150 // 5 minutes

export function useIntakeWorkflow() {
  const [state, setState] = useState<IntakeWorkflowState>({
    stage: 'form',
    progress: null,
    triggerError: null,
  })

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const claimIdRef = useRef<string | null>(null)
  const runIdRef = useRef<string | null>(null)
  const intakeKeyRef = useRef<string | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  useEffect(() => () => stopPolling(), [stopPolling])

  const startPolling = useCallback((
    claimId: string,
    workflowRunId: string,
    intakeKey: string,
    onDone: () => void
  ) => {
    let polls = 0

    pollRef.current = setInterval(async () => {
      polls++

      if (polls > MAX_POLLS) {
        stopPolling()
        setState((prev) => ({
          ...prev,
          stage: 'error',
          progress: { phase: 'error', items: [], error: 'Timed out waiting for intake to complete' },
        }))
        return
      }

      try {
        const res = await fetch(
          `/api/claims/${claimId}/intake/${workflowRunId}?intakeKey=${encodeURIComponent(intakeKey)}`
        )
        if (!res.ok) return

        const data = await res.json() as IntakeProgress & { workflowStatus?: string }

        setState((prev) => ({ ...prev, progress: data }))

        if (data.phase === 'done') {
          stopPolling()
          setState((prev) => ({ ...prev, stage: 'done', progress: data }))
          onDone()
        } else if (data.phase === 'error') {
          stopPolling()
          setState((prev) => ({ ...prev, stage: 'error', progress: data }))
        }
      } catch {
        // network blip — keep polling
      }
    }, POLL_INTERVAL_MS)
  }, [stopPolling])

  const trigger = useCallback(async (
    claimId: string,
    text: string,
    imageBase64: string | null,
    onDone: () => void
  ) => {
    stopPolling()
    setState({ stage: 'triggering', progress: null, triggerError: null })

    try {
      const res = await fetch(`/api/claims/${claimId}/intake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, imageBase64 }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as Record<string, unknown>
        throw new Error((data.error as string) ?? 'Failed to start intake')
      }

      const { workflowRunId, intakeKey } = await res.json() as {
        workflowRunId: string
        intakeKey: string
      }

      claimIdRef.current = claimId
      runIdRef.current = workflowRunId
      intakeKeyRef.current = intakeKey

      setState({
        stage: 'polling',
        progress: { phase: 'extracting', items: [] },
        triggerError: null,
      })

      startPolling(claimId, workflowRunId, intakeKey, onDone)
    } catch (err) {
      setState({
        stage: 'error',
        progress: null,
        triggerError: err instanceof Error ? err.message : 'An error occurred',
      })
    }
  }, [startPolling, stopPolling])

  const reset = useCallback(() => {
    stopPolling()
    setState({ stage: 'form', progress: null, triggerError: null })
  }, [stopPolling])

  return { state, trigger, reset }
}
