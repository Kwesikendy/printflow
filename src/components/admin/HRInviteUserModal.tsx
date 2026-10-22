'use client'

import { useState, useTransition } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BriefcaseBusiness, CalendarDays, Mail, Phone, Shield, User, UserPlus, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { createUser } from '@/app/actions/users'
import { ROLE_LABELS, PRINT_ROOM_LABELS } from '@/lib/utils'
import { toast } from 'sonner'

const ROLES = ['front_desk', 'printer', 'accountant', 'admin', 'cleaner', 'rider'] as const
const DEPARTMENTS = ['Front Desk', 'Print Room 1', 'Print Room 2', 'Finance', 'Administration', 'Operations']

export function HRInviteUserModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<(typeof ROLES)[number]>('front_desk')
  const [selectedDepartment, setSelectedDepartment] = useState('Front Desk')

  const close = () => {
    if (!isPending) {
      setIsOpen(false)
      setError(null)
    }
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    const formData = new FormData(event.currentTarget)

    startTransition(async () => {
      const result = await createUser(formData)
      if (result.error) {
        setError(result.error)
        toast.error(result.error)
        return
      }

      if (result.temporaryPassword) {
        toast.success(`Employee created! Supabase email rate limit was reached. Temporary password: ${result.temporaryPassword}`, {
          duration: 12000,
        })
      } else {
        toast.success('Employee invited. They will receive an email to set their password.')
      }
      setIsOpen(false)
      setError(null)
      window.location.reload()
    })
  }

  return (
    <>
      <Button variant="primary" onClick={() => setIsOpen(true)}>
        <UserPlus className="w-4 h-4" aria-hidden="true" />
        Add employee
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" aria-label="Close dialog" onClick={close} />
            <motion.div
              className="relative z-10 w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
            >
              <Card noHover>
                <CardContent className="p-6 sm:p-8">
                  <div className="flex items-start justify-between gap-4 mb-6">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">HR onboarding</p>
                      <h2 className="text-2xl font-black text-slate-900 mt-1">Add employee</h2>
                      <p className="text-sm text-slate-500 mt-1">Create their profile, role, and first work assignment.</p>
                    </div>
                    <button type="button" onClick={close} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-800" aria-label="Close dialog">
                      <X className="w-5 h-5" aria-hidden="true" />
                    </button>
                  </div>

                  {error && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="Full name" icon={<User className="w-4 h-4" aria-hidden="true" />}>
                        <input name="full_name" required className="input-standard pl-10" placeholder="Jane Smith" />
                      </Field>
                      <Field label="Email address" icon={<Mail className="w-4 h-4" aria-hidden="true" />}>
                        <input name="email" required type="email" className="input-standard pl-10" placeholder="jane@printflow.com" />
                      </Field>
                      <Field label="Phone number" icon={<Phone className="w-4 h-4" aria-hidden="true" />}>
                        <input name="phone" type="tel" className="input-standard pl-10" placeholder="024 000 0000" />
                      </Field>
                      <Field label="Job title" icon={<BriefcaseBusiness className="w-4 h-4" aria-hidden="true" />}>
                        <input name="job_title" className="input-standard pl-10" placeholder="Customer service officer" />
                      </Field>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="block text-sm font-medium text-slate-700">
                        Role
                        <div className="relative mt-1.5">
                          <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
                          <select
                            name="role"
                            value={selectedRole}
                            onChange={(event) => {
                              const role = event.target.value as typeof selectedRole
                              setSelectedRole(role)
                              setSelectedDepartment(
                                role === 'front_desk' ? 'Front Desk' :
                                role === 'printer' ? 'Print Room 1' :
                                role === 'accountant' ? 'Finance' :
                                (role === 'cleaner' || role === 'rider') ? 'Operations' :
                                'Administration'
                              )
                            }}
                            className="input-standard pl-10 appearance-none"
                          >
                            {ROLES.map(role => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                          </select>
                        </div>
                      </label>
                      <label className="block text-sm font-medium text-slate-700">
                        Department / assignment
                        <select name="department" value={selectedDepartment} onChange={(event) => setSelectedDepartment(event.target.value)} className="input-standard mt-1.5 appearance-none">
                          {DEPARTMENTS.map(department => <option key={department}>{department}</option>)}
                        </select>
                      </label>
                      <label className="block text-sm font-medium text-slate-700">
                        Employment type
                        <select name="employment_type" defaultValue="full_time" className="input-standard mt-1.5 appearance-none">
                          <option value="full_time">Full-time</option>
                          <option value="part_time">Part-time</option>
                          <option value="contract">Contract</option>
                        </select>
                      </label>
                      <Field label="Start date" icon={<CalendarDays className="w-4 h-4" aria-hidden="true" />}>
                        <input name="employment_start_date" type="date" className="input-standard pl-10" />
                      </Field>
                    </div>

                    {selectedRole === 'printer' && (
                      <label className="block text-sm font-medium text-slate-700">
                        Print room
                        <select name="print_room" className="input-standard mt-1.5 appearance-none">
                          <option value="">Unassigned room</option>
                          {Object.entries(PRINT_ROOM_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                        </select>
                      </label>
                    )}

                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-sm text-indigo-800">
                      <span className="font-bold">Annual leave:</span> every new employee starts with a 20-day allowance. You can update used days from the HR directory.
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                      <Button type="button" variant="outline" className="flex-1" onClick={close}>Cancel</Button>
                      <Button type="submit" variant="primary" className="flex-1" loading={isPending}>Send invite</Button>
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

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <div className="relative mt-1.5">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>
        {children}
      </div>
    </label>
  )
}
