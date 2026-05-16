import type { Metadata } from 'next'
import { Noto_Serif_SC } from 'next/font/google'
import { createClient } from '@/lib/supabase/server'
import { ElderModeWrapper } from '@/components/elder-mode-wrapper'
import './globals.css'

// 1. 移除了不可用的 Geist 字体
// 2. 修正 Noto_Serif_SC 的子集为 'latin'
const notoSerif = Noto_Serif_SC({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-serif',
})

export const metadata: Metadata = {
  title: '麦穗喜乐',
  description: '属灵陪伴，同行成长',
  icons: { icon: '/favicon.ico' },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let elderMode = false
  if (user) {
    const { data } = await supabase
      .from('users')
      .select('settings')
      .eq('id', user.id)
      .single()
    elderMode = (data?.settings as { elder_mode?: boolean })?.elder_mode ?? false
  }

  return (
    <html lang="zh-CN" suppressHydrationWarning className={notoSerif.variable}>
      <body
        className="font-sans antialiased"
      >
        <ElderModeWrapper elderMode={elderMode}>
          {children}
        </ElderModeWrapper>
      </body>
    </html>
  )
}