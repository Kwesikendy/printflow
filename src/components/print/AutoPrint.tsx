'use client'

import { useEffect } from 'react'

export function AutoPrint({ title }: { title?: string }) {
  useEffect(() => {
    if (title) {
      document.title = title
    }
    // Wait a brief moment for styles/fonts to load before opening print dialog
    const timer = setTimeout(() => {
      if (title) {
        document.title = title
      }
      window.print()
    }, 500)
    
    return () => clearTimeout(timer)
  }, [title])
  
  return null
}

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="mt-2 text-indigo-600 underline cursor-pointer font-medium hover:text-indigo-800 transition-colors">
      Print Again
    </button>
  )
}
