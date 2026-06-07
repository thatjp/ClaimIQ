'use client'

interface Props {
  completion: string
  isLoading: boolean
  error: Error | undefined
  claimId: string
  onRetry: () => void
}

export function DocumentPane({ completion, isLoading, error, claimId, onRetry }: Props) {
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
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 shrink-0">
        <p className="text-xs text-gray-500">
          {isLoading ? 'Generating…' : error ? 'Generation failed' : 'Ready'}
        </p>
        <div className="flex gap-2">
          {error && (
            <button onClick={onRetry} className="text-xs text-red-600 hover:underline">
              Retry
            </button>
          )}
          {completion && !isLoading && (
            <button
              onClick={handleExport}
              className="text-xs px-3 py-1 bg-gray-800 text-white rounded-md hover:bg-gray-900 transition-colors"
            >
              Export
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded border border-red-100 mb-4">
            {error.message}
          </p>
        )}
        {isLoading && !completion && (
          <div className="flex items-center gap-3 py-16 justify-center">
            <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full" />
            <span className="text-sm text-gray-500">Generating document…</span>
          </div>
        )}
        {completion && (
          <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono leading-relaxed">
            {completion}
            {isLoading && <span className="inline-block w-2 h-4 bg-blue-600 ml-0.5 animate-pulse" />}
          </pre>
        )}
      </div>
    </div>
  )
}
