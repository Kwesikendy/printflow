'use client'

import { type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { playSound } from '../../lib/sounds'
import { cn } from '@/lib/utils'

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "disabled"> {
  variant?: 'primary' | 'ghost' | 'danger' | 'success' | 'outline' | 'accent'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  children: ReactNode
}

const variantClass = {
  primary: 'btn-primary',
  accent: 'btn-accent',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  success: 'btn-success',
  outline: 'btn-outline',
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
      whileTap={{ y: disabled || loading ? 0 : 1 }}
      transition={{ duration: 0.1 }}
      className={cn("btn font-semibold tracking-wide", variantClass[variant], sizeClass[size], className)}
      disabled={disabled || loading}
      onClick={handleClick}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
      {children}
    </motion.button>
  )
}
