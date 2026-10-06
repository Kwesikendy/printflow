'use client'
 
import { useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { AlertTriangle, RefreshCcw } from 'lucide-react'
 
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service if needed
    console.error('Next.js Error Boundary caught an error:', error)
  }, [error])
 
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] p-4">
      <Card className="w-full max-w-lg border-red-100 shadow-xl shadow-red-900/5">
        <CardContent className="pt-6 p-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
            Something went wrong
          </h2>
          <p className="text-slate-600 mb-6">
            The application encountered an unexpected error. This usually happens if there's a temporary network failure or a synchronization issue.
          </p>
          
          <div className="w-full text-left bg-slate-900 rounded-xl p-4 mb-6 overflow-x-auto">
            <p className="text-red-400 font-mono text-sm font-semibold mb-2">Error Details:</p>
            <p className="text-slate-300 font-mono text-xs whitespace-pre-wrap">
              {error.message || 'Unknown error occurred'}
            </p>
            {error.digest && (
              <p className="text-slate-500 font-mono text-xs mt-2">Digest: {error.digest}</p>
            )}
          </div>

          <button
            onClick={() => reset()}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-colors"
          >
            <RefreshCcw className="w-4 h-4" />
            Try Again
          </button>
        </CardContent>
      </Card>
    </div>
  )
}
