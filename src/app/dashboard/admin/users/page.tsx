import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { ROLE_LABELS } from '@/lib/utils'
import { UserCircle, Mail } from 'lucide-react'
import { InviteUserModal } from '@/components/admin/InviteUserModal'

export default async function AdminUsersPage() {
  const supabase = await createClient()

  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at')

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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/50">
                {profiles?.map((user: any) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="pl-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                          <UserCircle className="w-5 h-5 text-indigo-600" />
                        </div>
                        <span className="font-semibold text-slate-900">{user.full_name}</span>
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
                  </tr>
                ))}
                {(!profiles || profiles.length === 0) && (
                  <tr>
                    <td colSpan={4} className="text-center py-10 text-slate-400">
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
