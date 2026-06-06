'use client'

import { useState, useRef } from 'react'
import { ExtractedItem } from '@/types/items'

export type ExtractionStep = 'form' | 'extracting' | 'review' | 'pricing' | 'done'

export function useItemExtraction() {
  const [step, setStep] = useState<ExtractionStep>('form')
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([])
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

  async function pollForPrice(runId: string): Promise<{ price: number; sources: string[] } | null> {
    const maxAttempts = 30
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000))
      try {
        const res = await fetch(`/api/price/${runId}`)
        if (!res.ok) return null
        const data = await res.json()
        if (data.status === 'completed' && data.price) return { price: data.price, sources: data.sources ?? [] }
        if (data.status === 'failed') return null
      } catch {
        return null
      }
    }
    return null
  }

  async function priceAll() {
    setStep('pricing')
    const updatedItems = [...extractedItems]
    await Promise.all(
      updatedItems.map(async (item, i) => {
        try {
          const res = await fetch('/api/price', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item }),
          })
          const data = await res.json()
          if (data.price) {
            updatedItems[i] = { ...item, price: data.price, priceSources: data.sources ?? [], priceStatus: 'found' }
          } else if (data.workflowRunId) {
            updatedItems[i] = { ...item, priceStatus: 'pending', workflowRunId: data.workflowRunId }
            setExtractedItems([...updatedItems])
            const result = await pollForPrice(data.workflowRunId)
            updatedItems[i] = result
              ? { ...item, price: result.price, priceSources: result.sources, priceStatus: 'found' }
              : { ...item, priceStatus: 'error' }
          } else {
            updatedItems[i] = { ...item, priceStatus: 'error' }
          }
        } catch {
          updatedItems[i] = { ...item, priceStatus: 'error' }
        }
        setExtractedItems([...updatedItems])
      })
    )
    setStep('done')
  }

  return {
    step,
    setStep,
    extractedItems,
    setExtractedItems,
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
  }
}
