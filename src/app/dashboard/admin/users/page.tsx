import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { ROLE_LABELS } from '@/lib/utils'
import { UserCircle } from 'lucide-react'

export default async function AdminUsersPage() {
  const supabase = await createClient()

  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at')

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader 
          title="Users" 
          description="Manage employees and their access roles." 
        />
        <CardContent>
          <table className="table-standard">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {profiles?.map(user => (
                <tr key={user.id}>
                  <td>
                    <div className="flex items-center gap-2 font-medium text-slate-900">
                      <UserCircle className="w-4 h-4 text-slate-500" />
                      {user.full_name}
                    </div>
                  </td>
                  <td>{user.email}</td>
                  <td>
                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs">
                      {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS]}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${user.is_active ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-slate-500 mt-4 text-center">MVP Demo: Users are created via Supabase Auth admin panel or seed script.</p>
        </CardContent>
      </Card>
    </div>
  )
}
