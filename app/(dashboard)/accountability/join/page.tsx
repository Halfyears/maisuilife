import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/server'
import { AccountabilityJoinFormPage } from './join-form'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: { code?: string }
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const code = (searchParams.code ?? '').toUpperCase().slice(0, 6)
  const BASE  = 'https://www.maisuijoy.com'

  let groupName = '同行小组'
  let groupType = 'daily'
  if (code.length === 6) {
    try {
      const db = createAdminClient()
      const { data } = await db
        .from('accountability_groups')
        .select('name, group_type')
        .eq('invite_code', code)
        .is('deleted_at', null)
        .maybeSingle()
      if (data?.name) {
        groupName = data.name
        groupType = data.group_type ?? 'daily'
      }
    } catch { /* 静默降级 */ }
  }

  const isVigil    = groupType === 'vigil'
  const emoji      = isVigil ? '🕊️' : '🌿'
  const typeLabel  = isVigil ? '守望相助' : '同行小组'
  const desc       = isVigil
    ? `你收到了守望相助邀请，诚邀你加入「${groupName}」，同心守望、彼此扶持。`
    : `你收到了同行小组邀请，诚邀你加入「${groupName}」，彼此激励、一起迈向目标。`
  const title      = `加入${typeLabel}「${groupName}」`
  const url        = code ? `${BASE}/accountability/join?code=${code}` : `${BASE}/accountability/join`

  return {
    title,
    description: desc,
    openGraph: {
      title:       `${emoji} ${title} — 麦穗喜乐`,
      description: desc,
      siteName:    '麦穗喜乐',
      url,
      type:        'website',
    },
    twitter: {
      card:        'summary',
      title:       `${emoji} ${title} — 麦穗喜乐`,
      description: desc,
    },
  }
}

export default function AccountabilityJoinPage() {
  return <AccountabilityJoinFormPage />
}
