import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { AdminSidebar } from '@/components/admin/admin-sidebar'

/**
 * Admin layout — wraps all routes under (admin)/.
 * Super-admin check is the outermost gate; any child page
 * can trust that role === 'super_admin' by the time it renders.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/admin/hub')

  const db = createServiceClient()
  const { data: profile } = await db
    .from('users')
    .select('role, display_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') redirect('/')

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar adminName={profile.display_name} />

      {/* Main content — offset by sidebar width */}
      <div className="ml-56 flex-1 flex flex-col min-w-0">
        {children}
      </div>
    </div>
  )
}
