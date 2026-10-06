import { type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className={cn("flex flex-col items-center justify-center py-16 px-4 text-center", className)}
    >
      {icon && (
        <motion.div 
          animate={{ y: [0, -8, 0] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          className="w-20 h-20 rounded-full bg-indigo-50/50 border border-indigo-100 flex items-center justify-center mb-6 text-indigo-400 shadow-sm"
        >
          {icon}
        </motion.div>
      )}
      <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
      {description && <p className="text-sm text-slate-500 max-w-sm font-medium">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </motion.div>
  )
}

export function LoadingSpinner({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center p-8 ${className}`}>
      <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
    </div>
  )
}

export function PageLoader() {
  return (
    <div className="w-full p-6 space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between mb-8">
        <div className="h-8 bg-slate-200 rounded-md w-1/3"></div>
        <div className="h-8 bg-slate-200 rounded-md w-24"></div>
      </div>
      
      {/* Cards/List Skeleton */}
      <div className="space-y-4">
        <div className="h-32 bg-slate-100 rounded-xl w-full border border-slate-200"></div>
        <div className="h-32 bg-slate-100 rounded-xl w-full border border-slate-200"></div>
        <div className="h-32 bg-slate-100 rounded-xl w-full border border-slate-200"></div>
      </div>
    </div>
  )
}
