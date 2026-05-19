import { createAdminClient } from '@/lib/supabase/server'

const STYLES: Record<string, { bar: string; text: string; icon: string }> = {
  info:    { bar: 'bg-blue-50 border-blue-200',   text: 'text-blue-800',   icon: '📢' },
  warning: { bar: 'bg-amber-50 border-amber-200', text: 'text-amber-900',  icon: '⚠️' },
  success: { bar: 'bg-green-50 border-green-200', text: 'text-green-800',  icon: '✅' },
}

export async function GlobalNotice() {
  try {
    const db = createAdminClient()
    const { data } = await db
      .from('system_configs')
      .select('value')
      .eq('key', 'global_notice')
      .maybeSingle()

    const v = data?.value as Record<string, unknown> | null
    if (!v?.enabled || !v?.text) return null

    const type   = typeof v.type === 'string' ? v.type : 'info'
    const style  = STYLES[type] ?? STYLES.info

    return (
      <div className={`border-b px-4 py-2.5 ${style.bar}`}>
        <p className={`text-xs font-medium leading-relaxed ${style.text}`}>
          <span className="mr-1.5">{style.icon}</span>
          {v.text as string}
        </p>
      </div>
    )
  } catch {
    return null
  }
}
