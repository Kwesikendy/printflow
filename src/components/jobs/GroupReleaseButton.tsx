'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { releaseJobGroupAction } from '@/app/actions/jobs'
import { toast } from 'sonner'
import { Printer } from 'lucide-react'

interface GroupReleaseButtonProps {
  groupId: string
  awaitingCount: number
}

export function GroupReleaseButton({ groupId, awaitingCount }: GroupReleaseButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [released, setReleased] = useState(false)

  if (awaitingCount === 0 || released) return null

  const handleRelease = () => {
    startTransition(async () => {
      const res = await releaseJobGroupAction(groupId, 'Manually forwarded to print room')
      if (res.error) {
        toast.error(res.error)
      } else {
        setReleased(true)
        toast.success(`All ${awaitingCount} job${awaitingCount > 1 ? 's' : ''} forwarded to print room!`)
      }
    })
  }

  return (
    <Button
      variant="primary"
      onClick={handleRelease}
      loading={isPending}
      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-sm flex items-center gap-2"
    >
      <Printer className="w-4 h-4" />
      Forward All to Print Room ({awaitingCount})
    </Button>
  )
}
