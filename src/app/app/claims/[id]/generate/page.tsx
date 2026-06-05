'use client'

import { useParams } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { useCompletion } from '@ai-sdk/react'
import Link from 'next/link'

export default function GenerateDocumentPage() {
  const params = useParams()
  const claimId = params.id as string
  const hasStarted = useRef(false)

  const { completion, complete, isLoading, error } = useCompletion({
    api: '/api/generate',
    body: { claimId },
  })

  // Auto-start generation on page load
  useEffect(() => {
    if (!hasStarted.current) {
      hasStarted.current = true
      complete('')
    }
  }, [complete])

  function handleExport() {
    const blob = new Blob([completion], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `claim-${claimId}-document.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Claim Document</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isLoading ? 'Generating document...' : 'Document ready for review'}
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/app/claims/${claimId}`}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Back to Claim
          </Link>
          {completion && !isLoading && (
            <button
              onClick={handleExport}
              className="bg-gray-800 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-900 transition-colors"
            >
              Export
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 mb-4">
          <p className="text-sm text-red-600">
            Error generating document: {error.message}
          </p>
          <button
            onClick={() => complete('')}
            className="text-sm text-red-700 font-medium mt-1 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-8">
        {isLoading && !completion && (
          <div className="flex items-center gap-3 py-8 justify-center">
            <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full" />
            <span className="text-sm text-gray-500">Generating document...</span>
          </div>
        )}

        {completion ? (
          <div className="prose prose-sm max-w-none">
            <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono leading-relaxed">
              {completion}
              {isLoading && (
                <span className="inline-block w-2 h-4 bg-blue-600 ml-0.5 animate-pulse" />
              )}
            </pre>
          </div>
        ) : !isLoading && (
          <p className="text-sm text-gray-400 text-center py-8">
            No document generated yet.
          </p>
        )}
      </div>
    </div>
  )
}
