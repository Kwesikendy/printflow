'use client'

import { useState, useEffect } from 'react'
import { useRealtime } from '@/contexts/RealtimeContext'
import { useSession } from '@/contexts/SessionContext'
import { Card, CardContent } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { transitionJobStatusAction } from '@/app/actions/jobs'
import { PackageCheck, CheckCircle2 } from 'lucide-react'
import type { Job } from '@/types/database'
import { toast } from 'sonner'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { Label } from '@/components/ui/Label'
import { Switch } from '@/components/ui/Switch'

export function PickupQueueList({ initialJobs }: { initialJobs: Job[] }) {
  const [jobs, setJobs] = useState<Job[]>(initialJobs)
  const [searchQuery, setSearchQuery] = useState('')
  const { subscribeToJobs } = useRealtime()
  const { session } = useSession()

  useEffect(() => {
    const unsubscribe = subscribeToJobs((payload) => {
      if (payload.eventType === 'UPDATE') {
        const newJob = payload.new
        
        // If it transitioned TO completed, add it to the list
        if (newJob.status === 'completed' && payload.old.status !== 'completed') {
          // Fetch missing relations before adding (simplified here, in reality would do a refetch or optimistic insert)
          setJobs(prev => [newJob, ...prev.filter(j => j.id !== newJob.id)])
          toast.success(`Job ${newJob.job_number} is ready for pickup!`)
        }
        
        // If it transitioned FROM completed to picked_up or cancelled, remove it
        if (payload.old.status === 'completed' && newJob.status !== 'completed') {
          setJobs(prev => prev.filter(j => j.id !== newJob.id))
        }
      }
    })
    
    return unsubscribe
  }, [subscribeToJobs])

  const [loadingJobId, setLoadingJobId] = useState<string | null>(null)
  
  // Modal state
  const [pickupJob, setPickupJob] = useState<{id: string, number: string} | null>(null)
  const [isDifferentPerson, setIsDifferentPerson] = useState(false)
  const [pickupName, setPickupName] = useState('')
  const [pickupPhone, setPickupPhone] = useState('')

  const handleOpenPickup = (jobId: string, jobNumber: string) => {
    setPickupJob({ id: jobId, number: jobNumber })
    setIsDifferentPerson(false)
    setPickupName('')
    setPickupPhone('')
  }

  const handleConfirmPickup = async () => {
    if (!pickupJob) return
    
    if (isDifferentPerson && !pickupName.trim()) {
      toast.error('Please enter the pickup person\'s name')
      return
    }

    setLoadingJobId(pickupJob.id)
    const res = await transitionJobStatusAction(
      pickupJob.id, 
      'picked_up', 
      undefined, 
      isDifferentPerson ? pickupName : undefined, 
      isDifferentPerson ? pickupPhone : undefined
    )
    setLoadingJobId(null)
    
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success(`Job ${pickupJob.number} picked up successfully`)
      setJobs(prev => prev.filter(j => j.id !== pickupJob.id))
      setPickupJob(null)
    }
  }

  const filteredJobs = jobs.filter(job => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase().trim()
    return (
      job.job_number.toLowerCase().includes(query) ||
      job.customer_name.toLowerCase().includes(query) ||
      (job.product_types?.name || '').toLowerCase().includes(query)
    )
  })

  if (jobs.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<PackageCheck />}
          title="Queue is empty"
          description="There are currently no jobs waiting for pickup."
        />
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by Job No, Customer, or Product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-shadow shadow-sm"
          />
        </div>
      </div>

      {filteredJobs.length === 0 && searchQuery.trim() !== '' ? (
        <Card>
          <EmptyState
            icon={<PackageCheck />}
            title="No jobs found"
            description="No jobs match your current search query."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredJobs.map(job => (
            <motion.div
              key={job.id}
              layout
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              whileHover={{ y: -4, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)" }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
            >
              <Card className="border-t-4 border-t-purple-500 overflow-hidden relative h-full">
                <CardContent className="p-6 h-full flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">{job.job_number}</h3>
                      <p className="text-sm font-medium text-slate-500 mt-1">{job.customer_name}</p>
                    </div>
                    <StatusBadge status={job.status} />
                  </div>
      
                  <div className="space-y-3 mb-6 text-sm flex-1 mt-2">
                    <div className="flex justify-between items-center p-2 rounded-lg bg-slate-50">
                      <span className="text-slate-500 font-medium">Product:</span>
                      <span className="text-slate-900 font-bold">{job.product_types?.name || 'Unknown'}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-lg bg-slate-50">
                      <span className="text-slate-500 font-medium">Completed:</span>
                      <span className="text-slate-700 font-medium">{formatDateTime(job.updated_at)}</span>
                    </div>
                  </div>
      
                  <div className="flex gap-3 mt-auto">
                    <Link href={`/dashboard/jobs/${job.id}`} className="flex-1">
                      <Button variant="outline" className="w-full">View</Button>
                    </Link>
                    <Button 
                      variant="success" 
                      className="flex-1"
                      onClick={() => handleOpenPickup(job.id, job.job_number)}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1.5" /> Pick Up
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      )}

      <Dialog open={!!pickupJob} onOpenChange={(open) => !open && setPickupJob(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Pickup</DialogTitle>
            <DialogDescription>
              Mark job {pickupJob?.number} as picked up by the customer.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-6">
            <div className="flex items-center space-x-3">
              <Switch 
                id="different-person" 
                checked={isDifferentPerson} 
                onCheckedChange={setIsDifferentPerson} 
              />
              <Label htmlFor="different-person" className="cursor-pointer">
                Pickup person is different from the customer
              </Label>
            </div>
            
            {isDifferentPerson && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                <div>
                  <Label htmlFor="pickup-name">Pickup Person's Name <span className="text-red-500">*</span></Label>
                  <input
                    id="pickup-name"
                    type="text"
                    className="input-standard mt-1.5"
                    value={pickupName}
                    onChange={(e) => setPickupName(e.target.value)}
                    placeholder="Enter name"
                  />
                </div>
                <div>
                  <Label htmlFor="pickup-phone">Pickup Person's Phone</Label>
                  <input
                    id="pickup-phone"
                    type="text"
                    className="input-standard mt-1.5"
                    value={pickupPhone}
                    onChange={(e) => setPickupPhone(e.target.value)}
                    placeholder="Enter phone number"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPickupJob(null)}>Cancel</Button>
            <Button 
              variant="success" 
              loading={!!pickupJob && loadingJobId === pickupJob.id}
              onClick={handleConfirmPickup}
            >
              Confirm Pickup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
