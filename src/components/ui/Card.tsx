'use client'

import { type ReactNode } from 'react'
import { motion } from 'framer-motion'

interface CardProps {
  children: ReactNode
  className?: string
  noHover?: boolean
}

export function Card({ children, className = '', noHover = false }: CardProps) {
  const hasOverrideOverflow = className.includes('overflow-')
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ 
        duration: 0.6, 
        ease: [0.16, 1, 0.3, 1] // Very smooth expo out
      }}
      whileHover={noHover ? undefined : { 
        y: -4, 
        transition: { duration: 0.3, ease: 'easeOut' }
      }}
      className={`bg-white/60 backdrop-blur-2xl rounded-2xl shadow-premium-card border border-white/80 transition-shadow duration-300 ${noHover ? '' : 'hover:shadow-premium-hover'} ${hasOverrideOverflow ? '' : 'overflow-hidden'} ${className}`}
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
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}

export function CardContent({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`px-4 sm:px-6 pb-4 sm:pb-6 ${className}`}>{children}</div>
}
