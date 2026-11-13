'use client'

import { type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface CardProps {
  children: ReactNode
  className?: string
  noHover?: boolean
  onClick?: () => void
}

export function Card({ children, className = '', noHover = false, onClick }: CardProps) {
  const hasOverrideOverflow = className.includes('overflow-')
  return (
    <motion.div
      onClick={onClick}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={cn(
        "bg-white rounded-2xl border border-slate-200/90 shadow-xs transition-colors duration-150",
        !noHover && onClick && "hover:border-slate-300 cursor-pointer",
        !hasOverrideOverflow && "overflow-hidden",
        className
      )}
    >
      {children}
    </motion.div>
  )
}

interface CardHeaderProps {
  title: string
  description?: string
  action?: ReactNode
}

export function CardHeader({ title, description, action }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between p-4 sm:p-6 pb-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight font-heading">{title}</h2>
        {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

export function CardContent({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`px-4 sm:px-6 pb-4 sm:pb-6 ${className}`}>{children}</div>
}
