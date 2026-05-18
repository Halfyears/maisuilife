import type { Metadata, Viewport } from 'next'
import { Noto_Serif_SC } from 'next/font/google'
import { createClient } from '@/lib/supabase/server'
import { ElderModeWrapper } from '@/components/elder-mode-wrapper'
import { ClientDateSync } from '@/components/shared/client-date-sync'
import './globals.css'

// 1. 移除了不可用的 Geist 字体
// 2. 修正 Noto_Serif_SC 的子集为 'latin'
const notoSerif = Noto_Serif_SC({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-serif',
})

export const metadata: Metadata = {
  title: {
    default:  '麦穗喜乐 MaisuiJoy',
    template: '%s — 麦穗喜乐',
  },
  description:     '麦穗喜乐 平安喜乐',
  manifest:        '/manifest.json',
  appleWebApp: {
    capable:        true,
    statusBarStyle: 'default',
    title:          '麦穗喜乐',
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor:         '#F59E0B',
  width:              'device-width',
  initialScale:       1,
  maximumScale:       1,
  userScalable:       false,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let elderMode = false
  try {
    const supabase = createClient()
    const { data } = await supabase.auth.getUser()
    const user = data?.user ?? null
    if (user) {
      const { data: profile } = await supabase
        .from('users')
        .select('settings')
        .eq('id', user.id)
        .maybeSingle()
      elderMode = (profile?.settings as { elder_mode?: boolean })?.elder_mode ?? false
    }
  } catch {
    // Never let layout auth errors crash the entire app
  }

  return (
    <html lang="zh-CN" suppressHydrationWarning className={notoSerif.variable}>
      <body
        className="font-sans antialiased"
        style={{ backgroundColor: '#FBFBF9', color: '#1C1917' }}
      >
        <ClientDateSync />
        <ElderModeWrapper elderMode={elderMode}>
          {children}
        </ElderModeWrapper>
      </body>
    </html>
  )
}