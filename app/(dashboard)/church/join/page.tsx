import type { Metadata } from 'next'
import { ChurchJoinFormPage } from './join-form'

export const metadata: Metadata = {
  title: '加入教会 — 麦穗喜乐',
  description: '搜索教会或输入邀请码，加入你所在的教会，与弟兄姐妹一同在信仰中同行。',
  openGraph: {
    title:       '⛪ 加入教会 — 麦穗喜乐',
    description: '搜索教会或输入邀请码，加入你所在的教会，与弟兄姐妹一同在信仰中同行。',
    siteName:    '麦穗喜乐',
    url:         'https://www.maisuijoy.com/church/join',
    type:        'website',
  },
  twitter: {
    card:        'summary',
    title:       '⛪ 加入教会 — 麦穗喜乐',
    description: '搜索教会或输入邀请码，加入你所在的教会，与弟兄姐妹一同在信仰中同行。',
  },
}

export default function ChurchJoinPage() {
  return <ChurchJoinFormPage />
}
