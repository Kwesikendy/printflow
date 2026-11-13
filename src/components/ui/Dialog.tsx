'use client'

import { type ReactNode, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onOpenChange])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="dialog-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60"
          onClick={() => onOpenChange(false)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function DialogContent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      key="dialog-content"
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 8 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className={cn(
        'relative bg-white rounded-2xl shadow-xl border border-slate-200/90 w-full max-w-md p-6',
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </motion.div>
  )
}

export function DialogHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mb-4", className)}>{children}</div>
}

export function DialogTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn("text-lg font-bold text-slate-900 tracking-tight font-heading", className)}>{children}</h2>
}

export function DialogDescription({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-sm text-slate-500 mt-1", className)}>{children}</p>
}

export function DialogFooter({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex justify-end gap-3 mt-6", className)}>{children}</div>
}
