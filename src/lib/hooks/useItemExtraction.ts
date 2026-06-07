'use client'

import { useState, useRef } from 'react'
import { mapWithConcurrencyLimit, PRICE_LOOKUP_CONCURRENCY } from '@/lib/pricing/batch'
import { lookupItemPrice } from '@/lib/pricing/client'
import { patchClaimItem, postClaimItems, deleteClaimItem } from '@/lib/claims/client'
import type { PriceTraceStep } from '@/lib/pricing/trace'
import { ExtractedItem } from '@/types/items'

export type ExtractionStep = 'form' | 'extracting' | 'review' | 'pricing' | 'done'

function reindexTraces(
  traces: Record<number, PriceTraceStep[]>,
  removedIndex: number
): Record<number, PriceTraceStep[]> {
  const next: Record<number, PriceTraceStep[]> = {}
  for (const [key, trace] of Object.entries(traces)) {
    const idx = Number(key)
    if (idx === removedIndex) continue
    next[idx > removedIndex ? idx - 1 : idx] = trace
  }
  return next
}

function reindexReplayIndices(indices: Set<number>, removedIndex: number): Set<number> {
  const next = new Set<number>()
  for (const idx of indices) {
    if (idx === removedIndex) continue
    next.add(idx > removedIndex ? idx - 1 : idx)
  }
  return next
}

async function persistNewItemsToClaim(
  claimId: string,
  items: ExtractedItem[]
): Promise<ExtractedItem[]> {
  const pending = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !item.claimItemId)

  if (pending.length === 0) return items

  const { items: rows } = await postClaimItems(
    claimId,
    pending.map(({ item }) => item)
  )

  const updated = [...items]
  pending.forEach(({ index }, j) => {
    const row = rows[j] as { id: string }
    updated[index] = { ...updated[index], claimItemId: row.id }
  })
  return updated
}

export function useItemExtraction(claimId?: string) {
  const [step, setStep] = useState<ExtractionStep>('form')
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([])
  const [pricingTraces, setPricingTraces] = useState<Record<number, PriceTraceStep[]>>({})
  const [replayIndices, setReplayIndices] = useState<Set<number>>(new Set())
  const [description, setDescription] = useState('')
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = ev.target?.result as string
      setImageBase64(result.split(',')[1])
    }
    reader.readAsDataURL(file)
  }

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mediaRecorder = new MediaRecorder(stream)
    audioChunksRef.current = []
    mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data)
    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop())
      setTranscribing(true)
      try {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const formData = new FormData()
        formData.append('audio', blob, 'recording.webm')
        const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
        if (res.ok) {
          const { text } = await res.json()
          setDescription((prev) => (prev ? prev + ' ' + text : text))
        }
      } finally {
        setTranscribing(false)
      }
    }
    mediaRecorderRef.current = mediaRecorder
    mediaRecorder.start()
    setRecording(true)
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  async function extract() {
    setError('')
    setStep('extracting')
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: description, imageBase64 }),
      })
      if (!res.ok) throw new Error('Failed to extract items')
      const { items } = await res.json()
      setExtractedItems(items || [])
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setStep('form')
    }
  }

  async function removeItem(index: number) {
    const item = extractedItems[index]
    if (claimId && item?.claimItemId) {
      try {
        await deleteClaimItem(claimId, item.claimItemId)
      } catch (err) {
        console.error(err)
      }
    }

    setExtractedItems((prev) => prev.filter((_, idx) => idx !== index))
    setPricingTraces((prev) => reindexTraces(prev, index))
    setReplayIndices((prev) => reindexReplayIndices(prev, index))
  }

  async function priceAll() {
    setStep('pricing')
    setReplayIndices(new Set())

    let snapshot: ExtractedItem[] = extractedItems.map((item) => ({
      ...item,
      priceStatus: 'queued' as const,
    }))
    setExtractedItems(snapshot)

    if (claimId) {
      try {
        snapshot = await persistNewItemsToClaim(claimId, snapshot)
        setExtractedItems(snapshot)
      } catch (err) {
        console.error('Failed to add items to claim before pricing:', err)
      }
    }

    await mapWithConcurrencyLimit(snapshot, PRICE_LOOKUP_CONCURRENCY, async (item, i) => {
      const matchKey = item.claimItemId ?? `idx-${i}`

      setExtractedItems((prev) =>
        prev.map((it, idx) => {
          const key = it.claimItemId ?? `idx-${idx}`
          return key === matchKey ? { ...it, priceStatus: 'pending' } : it
        })
      )

      try {
        const outcome = await lookupItemPrice(
          {
            name: item.name,
            brand: item.brand,
            model: item.model,
            category: item.category,
            condition: item.condition,
            quantity: item.quantity,
          },
          {
            onTraceUpdate: (trace) => {
              setPricingTraces((prev) => ({ ...prev, [i]: trace }))
            },
          }
        )

        setPricingTraces((prev) => ({ ...prev, [i]: outcome.trace }))

        if (outcome.price != null) {
          const priced: Partial<ExtractedItem> = {
            price: outcome.price,
            priceSources: outcome.sources ?? [],
            priceSource: outcome.source,
            priceTrace: outcome.trace,
            priceStatus: 'found',
          }

          if (claimId && item.claimItemId) {
            try {
              await patchClaimItem(claimId, item.claimItemId, {
                price: outcome.price,
                price_sources: outcome.sources ?? [],
              })
            } catch (err) {
              console.error(err)
            }
          }

          setExtractedItems((prev) => {
            if (!prev.some((it) => (it.claimItemId ?? '') === (item.claimItemId ?? ''))) {
              return prev
            }
            return prev.map((it) =>
              it.claimItemId === item.claimItemId ? { ...it, ...priced } : it
            )
          })
          setReplayIndices((prev) => new Set(prev).add(i))
        } else {
          setExtractedItems((prev) => {
            if (!prev.some((it) => it.claimItemId === item.claimItemId)) return prev
            return prev.map((it) =>
              it.claimItemId === item.claimItemId
                ? { ...it, priceStatus: 'error', priceTrace: outcome.trace }
                : it
            )
          })
        }
      } catch {
        setExtractedItems((prev) => {
          if (!prev.some((it) => it.claimItemId === item.claimItemId)) return prev
          return prev.map((it) =>
            it.claimItemId === item.claimItemId ? { ...it, priceStatus: 'error' } : it
          )
        })
      }
    })

    setStep('done')
  }

  /** Persist any items not yet on the claim (e.g. saved without pricing). */
  async function saveUnpricedItemsToClaim() {
    if (!claimId) return
    const unsaved = extractedItems.filter((item) => !item.claimItemId)
    if (unsaved.length === 0) return

    const { items: rows } = await postClaimItems(claimId, unsaved)
    setExtractedItems((prev) => {
      let rowIdx = 0
      return prev.map((item) => {
        if (item.claimItemId) return item
        const row = rows[rowIdx++] as { id: string }
        return { ...item, claimItemId: row.id }
      })
    })
  }

  const isPricingInProgress =
    step === 'pricing' ||
    extractedItems.some((item) => item.priceStatus === 'queued' || item.priceStatus === 'pending')

  return {
    step,
    setStep,
    extractedItems,
    setExtractedItems,
    pricingTraces,
    replayIndices,
    description,
    setDescription,
    imageBase64,
    error,
    recording,
    transcribing,
    handleImageChange,
    startRecording,
    stopRecording,
    extract,
    priceAll,
    removeItem,
    saveUnpricedItemsToClaim,
    isPricingInProgress,
  }
}
