import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function ChurchLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['church_admin', 'super_admin'].includes(profile.role)) {
    redirect('/')
  }

  return <>{children}</>
}
