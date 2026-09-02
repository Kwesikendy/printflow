'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { type JobStatus } from '@/types/database'
import { JOB_STATUS_LABELS } from '@/lib/utils'
import { playSound } from '../../lib/sounds'
import { CheckCircle2, Loader2, Sparkles, AlertCircle, Circle, PlayCircle, PackageCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

const statusConfig: Record<JobStatus, { color: string, icon: any, animation?: any }> = {
  draft:            { color: 'bg-slate-100 text-slate-600 border-slate-200', icon: Circle },
  quoted:           { color: 'bg-blue-50 text-blue-700 border-blue-200', icon: AlertCircle },
  awaiting_payment: { color: 'bg-amber-50 text-amber-700 border-amber-200', icon: AlertCircle },
  paid_released:    { 
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.2)]', 
    icon: PlayCircle,
    animation: { scale: [1, 1.02, 1], transition: { repeat: Infinity, duration: 2, ease: "easeInOut" } }
  },
  in_production:    { 
    color: 'bg-indigo-50 text-indigo-700 border-indigo-200', 
    icon: Loader2,
  },
  completed:        { color: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: CheckCircle2 },
  picked_up:        { color: 'bg-slate-100 text-slate-500 border-slate-200', icon: PackageCheck },
  cancelled:        { color: 'bg-red-50 text-red-500 border-red-100 opacity-70', icon: AlertCircle },
}

export function StatusBadge({ status }: { status: JobStatus }) {
  const [hasMounted, setHasMounted] = useState(false)
  const config = statusConfig[status]
  const Icon = config.icon

  useEffect(() => {
    // Only trigger effects on mount if it's a "wow" status, or if status changes (needs prevStatus tracking for robust implementation, but this is simple)
    if (!hasMounted) {
      if (status === 'picked_up') {
        // Pop confetti if a status badge mounts as picked_up
        // In a real app we'd track prevStatus to only fire on transition, but for MVP, this is a nice surprise when navigating to the job details.
        const duration = 2 * 1000;
        const end = Date.now() + duration;

        const frame = () => {
          confetti({
            particleCount: 2,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ['#10b981', '#3b82f6']
          });
          confetti({
            particleCount: 2,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ['#10b981', '#3b82f6']
          });

          if (Date.now() < end) {
            requestAnimationFrame(frame);
          }
        };
        frame();
        playSound('success')
      } else if (status === 'paid_released') {
        playSound('pop')
      }
      setHasMounted(true)
    }
  }, [status, hasMounted])

  return (
    <motion.span 
      layout
      initial={{ scale: 0.9, opacity: 0 }}
      animate={config.animation || { scale: 1, opacity: 1 }}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border",
        config.color
      )}
    >
      <Icon className={cn("w-3.5 h-3.5", status === 'in_production' ? "animate-spin" : "")} />
      {JOB_STATUS_LABELS[status]}
    </motion.span>
  )
}
