'use client'

import { type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { playSound } from '../../lib/sounds'
import { cn } from '@/lib/utils'

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "disabled"> {
  variant?: 'primary' | 'ghost' | 'danger' | 'success' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  children: ReactNode
}

const variantClass = {
  primary: 'btn-primary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  success: 'btn-success',
  outline: 'border border-indigo-500/50 text-indigo-600 hover:bg-indigo-50',
}

const sizeClass = {
  sm: 'text-xs px-3 py-1.5',
  md: 'text-sm px-4 py-2',
  lg: 'text-base px-6 py-2.5',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  children,
  className = '',
  disabled,
  onClick,
  ...props
}: ButtonProps) {
  
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    playSound('click', 0.15)
    if (onClick) onClick(e)
  }
  
  return (
    <motion.button
      whileHover={{ scale: disabled || loading ? 1 : 1.015 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn("btn", variantClass[variant], sizeClass[size], className)}
      disabled={disabled || loading}
      onClick={handleClick}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
      {children}
    </motion.button>
  )
}
