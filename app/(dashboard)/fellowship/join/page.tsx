import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/server'
import { FellowshipJoinFormPage } from './join-form'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: { code?: string }
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const code = (searchParams.code ?? '').toUpperCase().slice(0, 8)
  const BASE  = 'https://www.maisuijoy.com'

  let fellowshipName = '麦穗团契'
  if (code.length >= 4) {
    try {
      const db = createAdminClient()
      const { data } = await db
        .from('fellowships')
        .select('name')
        .eq('invite_code', code)
        .is('deleted_at', null)
        .maybeSingle()
      if (data?.name) fellowshipName = data.name
    } catch { /* 静默降级 */ }
  }

  const title       = `加入团契「${fellowshipName}」`
  const description = `你收到了来自「${fellowshipName}」的团契邀请，点击加入，在信仰中彼此守望、微光同行。`
  const url         = code ? `${BASE}/fellowship/join?code=${code}` : `${BASE}/fellowship/join`

  return {
    title,
    description,
    openGraph: {
      title:       `🌾 ${title} — 麦穗喜乐`,
      description,
      siteName:    '麦穗喜乐',
      url,
      type:        'website',
    },
    twitter: {
      card:        'summary',
      title:       `🌾 ${title} — 麦穗喜乐`,
      description,
    },
  }
}

export default function FellowshipJoinPage() {
  return <FellowshipJoinFormPage />
}
