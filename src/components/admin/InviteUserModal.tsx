'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { createUser } from '@/app/actions/users'
import { toast } from 'sonner'
import { X, UserPlus, Mail, User, Shield } from 'lucide-react'
import { ROLE_LABELS } from '@/lib/utils'

interface InviteUserModalProps {
  onSuccess?: () => void
}

const ROLES = ['front_desk', 'printer', 'accountant', 'admin'] as const

export function InviteUserModal({ onSuccess }: InviteUserModalProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await createUser(formData)
      if (result.error) {
        setError(result.error)
        toast.error(result.error)
      } else {
        toast.success('Invitation sent! They\'ll receive an email to set their password.')
        setIsOpen(false)
        router.refresh()
        onSuccess?.()
      }
    })
  }

  return (
    <>
      <Button variant="primary" onClick={() => setIsOpen(true)}>
        <UserPlus className="w-4 h-4 mr-2" />
        Add User
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              className="relative w-full max-w-md z-10"
            >
              <Card>
                <CardContent className="p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">Invite New User</h2>
                      <p className="text-sm text-slate-500 mt-0.5">They'll receive an email to set their password.</p>
                    </div>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-600">
                        {error}
                      </div>
                    )}

                    <div>
                      <label htmlFor="full_name" className="block text-sm font-medium text-slate-700 mb-1.5">
                        Full Name
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          id="full_name"
                          name="full_name"
                          type="text"
                          required
                          className="input-standard pl-10"
                          placeholder="Jane Smith"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="invite_email" className="block text-sm font-medium text-slate-700 mb-1.5">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          id="invite_email"
                          name="email"
                          type="email"
                          required
                          className="input-standard pl-10"
                          placeholder="jane@yourshop.com"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="role" className="block text-sm font-medium text-slate-700 mb-1.5">
                        Role
                      </label>
                      <div className="relative">
                        <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select
                          id="role"
                          name="role"
                          required
                          className="input-standard pl-10 appearance-none"
                        >
                          {ROLES.map(role => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role as keyof typeof ROLE_LABELS]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="pt-2 flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => setIsOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                        className="flex-1"
                        loading={isPending}
                      >
                        Send Invite
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
