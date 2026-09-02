'use client'

import { useEffect } from 'react'

export function AutoPrint() {
  useEffect(() => {
    // Wait a brief moment for styles/fonts to load before opening print dialog
    const timer = setTimeout(() => {
      window.print()
    }, 500)
    
    return () => clearTimeout(timer)
  }, [])
  
  return null
}

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="mt-2 text-indigo-600 underline cursor-pointer font-medium hover:text-indigo-800 transition-colors">
      Print Again
    </button>
  )
}
