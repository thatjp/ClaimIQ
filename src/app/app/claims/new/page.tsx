'use client'

import { Suspense, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { US_STATES } from '@/lib/constants'
import { useIntakeWorkflow } from '@/lib/hooks/useIntakeWorkflow'

function NewClaimForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const existingClaimId = searchParams.get('claimId')
  const isAdding = !!existingClaimId

  const [state, setState] = useState('CA')
  const [policyType, setPolicyType] = useState('HO-3')
  const [dateOfLoss, setDateOfLoss] = useState(new Date().toISOString().split('T')[0])
  const [claimId, setClaimId] = useState<string | null>(existingClaimId)
  const [description, setDescription] = useState('')
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState('')
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const { state: intakeState, trigger } = useIntakeWorkflow()

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
          const { text } = await res.json() as { text: string }
          setDescription((prev) => prev ? `${prev} ${text}` : text)
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError('')

    try {
      let resolvedClaimId = claimId
      if (!isAdding) {
        const claimRes = await fetch('/api/claims', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state, policyType, dateOfLoss }),
        })
        if (!claimRes.ok) throw new Error('Failed to create claim')
        const claim = await claimRes.json() as { id: string }
        resolvedClaimId = claim.id
        setClaimId(claim.id)
      }

      // Wait until the workflow is triggered (intake_run_id written to DB), then redirect.
      // Pricing continues as a durable background workflow — dashboard reconnects via polling.
      await trigger(resolvedClaimId!, description, imageBase64, () => {})
      router.push('/app/dashboard')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  // Error view (only shown if trigger fails synchronously before redirect)
  if (intakeState.stage === 'error') {
    return (
      <div className="p-4 md:p-8 max-w-2xl">
        <h1 className="text-2xl font-semibold text-gray-900 mb-4">Something went wrong</h1>
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded border border-red-100 mb-4">
          {intakeState.progress?.error ?? intakeState.triggerError ?? 'An unexpected error occurred'}
        </p>
        <button
          onClick={() => router.push('/app/dashboard')}
          className="text-sm text-blue-600 hover:underline"
        >
          Back to dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">
        {isAdding ? 'Add Items' : 'New Claim'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        {!isAdding && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Claim Details</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {US_STATES.map((s) => (
                    <option key={s.code} value={s.code}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Policy Type</label>
                <select
                  value={policyType}
                  onChange={(e) => setPolicyType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="HO-3">HO-3 (Standard Homeowners)</option>
                  <option value="HO-4">HO-4 (Renters)</option>
                  <option value="HO-5">HO-5 (Comprehensive)</option>
                  <option value="HO-6">HO-6 (Condo)</option>
                  <option value="DP-1">DP-1 (Dwelling Fire)</option>
                  <option value="DP-3">DP-3 (Special Dwelling)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Loss</label>
              <input
                type="date"
                value={dateOfLoss}
                onChange={(e) => setDateOfLoss(e.target.value)}
                required
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Item Description</h2>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                {isAdding ? 'Describe additional items' : 'Describe damaged or lost items'}
              </label>
              <button
                type="button"
                onClick={recording ? stopRecording : startRecording}
                disabled={transcribing}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  recording
                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                    : transcribing
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${recording ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`} />
                {recording ? 'Stop recording' : transcribing ? 'Transcribing...' : 'Record'}
              </button>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              required
              placeholder={isAdding
                ? 'Example: Dyson V15 vacuum, Weber grill, two mountain bikes...'
                : 'Example: 65-inch Samsung QLED TV (model QN65Q80C, purchased 2022), KitchenAid stand mixer 5qt Artisan series, MacBook Pro 14-inch 2023 M2 Pro...'
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Photo (optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
            />
            <p className="text-xs text-gray-400 mt-1">Attach a photo for AI-assisted item identification.</p>
          </div>
        </div>

        {(submitError || intakeState.triggerError) && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded border border-red-100">
            {submitError || intakeState.triggerError}
          </p>
        )}

        <div className="flex gap-3">
          {isAdding && (
            <button
              type="button"
              onClick={() => router.push(`/app/claims/${existingClaimId}`)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={intakeState.stage === 'triggering'}
            className="bg-blue-600 text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {intakeState.stage === 'triggering'
              ? 'Starting…'
              : isAdding ? 'Extract & Price Items' : 'Create Claim & Extract Items'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function NewClaimPage() {
  return (
    <Suspense>
      <NewClaimForm />
    </Suspense>
  )
}
