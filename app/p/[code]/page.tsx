/**
 * 投屏短链接
 * maisuijoy.com/p/<invite_code>  →  /fellowship/console/projector?fellowship_id=<id>
 *
 * 无需鉴权——投屏页本身会处理登录跳转。
 * invite_code 大小写不敏感（统一转大写匹配）。
 */
import { redirect, notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'

export const revalidate = 60

export default async function ShortProjectorLink({
  params,
}: {
  params: { code: string }
}) {
  const db = createAdminClient()

  const { data: fellowship } = await db
    .from('fellowships')
    .select('id')
    .eq('invite_code', params.code.toUpperCase())
    .maybeSingle()

  if (!fellowship) notFound()

  redirect(`/fellowship/console/projector?fellowship_id=${fellowship.id}`)
}
