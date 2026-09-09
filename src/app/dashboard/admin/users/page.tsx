'use client'

import { useEffect, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/Card'
import { ROLE_LABELS } from '@/lib/utils'
import { UserCircle, Mail, Trash2 } from 'lucide-react'
import { InviteUserModal } from '@/components/admin/InviteUserModal'
import { deleteUser } from '@/app/actions/users'
import { toast } from 'sonner'
import { useSession } from '@/contexts/SessionContext'

export default function AdminUsersPage() {
  const { session } = useSession()
  const [profiles, setProfiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const fetchProfiles = async () => {
    const supabase = createClient()
    const { data } = await supabase.from('profiles').select('*').order('created_at')
    setProfiles(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchProfiles() }, [])

  const handleDelete = (userId: string) => {
    startTransition(async () => {
      const res = await deleteUser(userId)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success('User removed successfully')
        setConfirmDeleteId(null)
        await fetchProfiles()
      }
    })
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Team Members</h1>
          <p className="text-slate-500 mt-2 text-lg">Manage employees and their dashboard access.</p>
        </div>
        <InviteUserModal />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="table-container">
            <table className="table-standard w-full">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="pl-6">Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th className="text-right pr-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/50">
                {profiles.map((user: any) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="pl-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                          <UserCircle className="w-5 h-5 text-indigo-600" />
                        </div>
                        <span className="font-semibold text-slate-900">{user.full_name}</span>
                        {user.id === session?.user.id && (
                          <span className="text-xs text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full font-medium">You</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        {user.email}
                      </div>
                    </td>
                    <td>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-100/80">
                        {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS]}
                      </span>
                    </td>
                    <td>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${user.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-100/80' : 'bg-red-50 text-red-700 border border-red-100/80'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${user.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="text-right pr-6">
                      {user.id !== session?.user.id && (
                        confirmDeleteId === user.id ? (
                          <div className="flex items-center gap-2 justify-end">
                            <span className="text-xs text-red-600 font-medium">Remove user?</span>
                            <button
                              onClick={() => handleDelete(user.id)}
                              disabled={isPending}
                              className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 font-semibold transition-colors disabled:opacity-50"
                            >
                              Yes, Remove
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-200 font-semibold transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(user.id)}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Remove user"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
                {(!profiles || profiles.length === 0) && !loading && (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-slate-400">
                      No team members yet. Invite someone to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
