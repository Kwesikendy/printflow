'use client'

import { useState, useEffect, useTransition } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { toast } from 'sonner'
import { 
  HardDrive, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  FileText,
  Sparkles
} from 'lucide-react'
import { getStorageStatsAction, cleanCompletedArtworksAction } from '@/app/actions/storage'

interface StorageStats {
  totalFiles: number
  totalBytes: number
  activeFiles: number
  activeBytes: number
  cleanableFiles: number
  cleanableBytes: number
}

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 MB'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const mb = bytes / (k * k)
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(dm)} GB`
  }
  return `${mb.toFixed(dm)} MB`
}

export function StorageMaintenanceCard() {
  const [stats, setStats] = useState<StorageStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [isCleaning, startCleaning] = useTransition()
  const [showConfirm, setShowConfirm] = useState(false)

  const fetchStats = async () => {
    setLoading(true)
    try {
      const res = await getStorageStatsAction()
      if (res.error) {
        toast.error(res.error)
      } else {
        setStats(res as StorageStats)
      }
    } catch (err: any) {
      toast.error('Failed to load storage statistics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  const handleClean = () => {
    setShowConfirm(false)
    startCleaning(async () => {
      try {
        const res = await cleanCompletedArtworksAction()
        if (res.error) {
          toast.error(res.error)
        } else if (res.success) {
          const freed = formatBytes(res.bytesFreed || 0)
          toast.success(`Storage cleanup complete! Freed ${freed} across ${res.deletedCount} files.`)
          await fetchStats()
        }
      } catch (err: any) {
        toast.error('An error occurred during storage cleanup')
      }
    })
  }

  // Supabase free tier storage quota is 1 GB (1,073,741,824 bytes)
  const freeTierLimit = 1024 * 1024 * 1024
  const usedPercentage = stats ? Math.min(100, Math.round((stats.totalBytes / freeTierLimit) * 100)) : 0
  const isOverQuota = (stats?.totalBytes || 0) > freeTierLimit

  return (
    <Card className="border-indigo-100/80 shadow-sm overflow-hidden">
      <CardHeader
        title="Supabase Storage Management"
        description="Monitor artwork bucket usage and purge archived files from completed jobs to save space."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStats}
            disabled={loading || isCleaning}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-indigo-600"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />
      <CardContent className="space-y-6 pt-2">
        {/* Storage Bar & Quota indicator */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className={`w-5 h-5 ${isOverQuota ? 'text-rose-500' : 'text-indigo-600'}`} />
              <span className="text-sm font-semibold text-slate-800">
                Artworks Bucket Storage ({formatBytes(stats?.totalBytes || 0)} used)
              </span>
            </div>
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
              isOverQuota 
                ? 'bg-rose-100 text-rose-700' 
                : 'bg-emerald-100 text-emerald-700'
            }`}>
              {isOverQuota ? `${usedPercentage}% Quota Exceeded` : `${usedPercentage}% of 1 GB Plan`}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden flex">
            <div
              className={`h-full transition-all duration-500 ${
                isOverQuota ? 'bg-rose-500' : 'bg-gradient-to-r from-indigo-500 to-indigo-600'
              }`}
              style={{ width: `${Math.min(100, usedPercentage)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>0 MB</span>
            <span>500 MB</span>
            <span className="font-medium text-slate-700">1,024 MB (Free Tier Quota)</span>
          </div>
        </div>

        {/* Breakdown statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/70 flex items-start gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-emerald-800 uppercase tracking-wider">
                Active Job Files (Protected)
              </div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {formatBytes(stats?.activeBytes || 0)}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {stats?.activeFiles ?? 0} files currently in production/queue
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/70 flex items-start gap-3">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-amber-800 uppercase tracking-wider">
                Cleanable Completed Files
              </div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {formatBytes(stats?.cleanableBytes || 0)}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {stats?.cleanableFiles ?? 0} files from completed / cancelled jobs
              </div>
            </div>
          </div>
        </div>

        {/* Cleanup Notice and Action */}
        <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-indigo-950 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Automated Space Reclaim
            </h4>
            <p className="text-xs text-indigo-700/90 leading-relaxed max-w-md">
              Purges artwork PDFs/TIFFs for jobs that have already been picked up or cancelled. 
              Invoice logs and historical records remain fully intact.
            </p>
          </div>

          <div>
            {showConfirm ? (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowConfirm(false)}
                  disabled={isCleaning}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleClean}
                  disabled={isCleaning}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Confirm Purge
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={() => setShowConfirm(true)}
                disabled={isCleaning || loading || (stats?.cleanableFiles === 0)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs flex items-center gap-1.5 w-full sm:w-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isCleaning ? 'Cleaning Storage...' : 'Clean Completed Artworks'}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
