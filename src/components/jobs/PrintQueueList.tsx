'use client'

import { useState, useEffect } from 'react'
import { useRealtime } from '@/contexts/RealtimeContext'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { transitionJobStatusAction } from '@/app/actions/jobs'
import { Printer, Play, CheckCircle2 } from 'lucide-react'
import type { Job } from '@/types/database'
import { toast } from 'sonner'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

export function PrintQueueList({ initialJobs }: { initialJobs: Job[] }) {
  const [jobs, setJobs] = useState<Job[]>(initialJobs)
  const { subscribeToJobs } = useRealtime()

  useEffect(() => {
    const unsubscribe = subscribeToJobs((payload) => {
      const newJob = payload.new
      
      if (payload.eventType === 'INSERT') {
        if (['paid_released', 'in_production'].includes(newJob.status)) {
          setJobs(prev => [...prev, newJob])
        }
      } else if (payload.eventType === 'UPDATE') {
        if (['paid_released', 'in_production'].includes(newJob.status)) {
          setJobs(prev => {
            const exists = prev.some(j => j.id === newJob.id)
            if (exists) {
              return prev.map(j => j.id === newJob.id ? { ...j, ...newJob } : j)
            }
            return [...prev, newJob]
          })
          if (newJob.status === 'paid_released' && payload.old.status === 'awaiting_payment') {
            toast.success(`New job ${newJob.job_number} released to queue!`)
          }
        } else {
          // It transitioned OUT of the queue (e.g. to completed)
          setJobs(prev => prev.filter(j => j.id !== newJob.id))
        }
      }
    })
    
    return unsubscribe
  }, [subscribeToJobs])

  const [loadingJobId, setLoadingJobId] = useState<string | null>(null)

  const handleStart = async (jobId: string, jobNumber: string) => {
    setLoadingJobId(jobId)
    const res = await transitionJobStatusAction(jobId, 'in_production')
    setLoadingJobId(null)
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success(`Started job ${jobNumber}`)
    }
  }

  const handleComplete = async (jobId: string, jobNumber: string) => {
    setLoadingJobId(jobId)
    const res = await transitionJobStatusAction(jobId, 'completed')
    setLoadingJobId(null)
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success(`Completed job ${jobNumber}`)
    }
  }

  // Sort: in_production first, then by updated_at ascending
  const sortedJobs = [...jobs].sort((a, b) => {
    if (a.status === 'in_production' && b.status !== 'in_production') return -1
    if (b.status === 'in_production' && a.status !== 'in_production') return 1
    return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
  })

  if (sortedJobs.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Printer />}
          title="Queue is empty"
          description="There are no jobs currently waiting for production."
        />
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <AnimatePresence mode="popLayout">
        {sortedJobs.map(job => (
          <motion.div
            key={job.id}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ y: -2, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)" }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="w-full"
          >
            <Card className={cn(
              "overflow-hidden transition-colors border-l-4",
              job.status === 'in_production' ? 'border-l-indigo-500 bg-white' : 'border-l-slate-200 bg-white'
            )}>
              <CardContent className="p-6 flex flex-col md:flex-row gap-6 justify-between md:items-center">
                
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-slate-900">{job.job_number}</h3>
                    <StatusBadge status={job.status} />
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                    <div>
                      <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Product</p>
                      <p className="text-sm font-medium text-slate-900 mt-1">{job.product_types?.name || 'Unknown'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Dimensions</p>
                      <p className="text-sm font-medium text-slate-900 mt-1">{job.width} × {job.height}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Quantity</p>
                      <p className="text-sm font-medium text-slate-900 mt-1">{job.quantity}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Total Area</p>
                      <p className="text-sm font-medium text-slate-900 mt-1">{job.area}</p>
                    </div>
                  </div>
                  
                  {job.notes && (
                    <div className="mt-5 p-3 bg-slate-50/80 rounded-xl text-sm text-slate-600 border border-slate-100">
                      <span className="font-semibold text-slate-500 block mb-1">Notes: </span>
                      {job.notes}
                    </div>
                  )}
                </div>

                <div className="flex flex-row md:flex-col gap-3 min-w-[160px]">
                  <Link href={`/dashboard/jobs/${job.id}`} className="flex-1 md:flex-none">
                    <Button variant="outline" className="w-full">Details</Button>
                  </Link>
                  
                  {job.status === 'paid_released' && (
                    <Button 
                      variant="primary" 
                      className="w-full flex-1 md:flex-none"
                      loading={loadingJobId === job.id}
                      onClick={() => handleStart(job.id, job.job_number)}
                    >
                      <Play className="w-4 h-4 mr-1.5" /> Start Job
                    </Button>
                  )}
                  
                  {job.status === 'in_production' && (
                    <Button 
                      variant="success" 
                      className="w-full flex-1 md:flex-none"
                      loading={loadingJobId === job.id}
                      onClick={() => handleComplete(job.id, job.job_number)}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1.5" /> Complete
                    </Button>
                  )}
                </div>
                
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
