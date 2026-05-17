'use client'

import Link from 'next/link'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-8 max-w-sm w-full">
        <p className="text-2xl mb-3">🌾</p>
        <p className="text-sm font-bold text-stone-900 mb-1.5">页面加载出现了问题</p>
        <p className="text-xs text-stone-500 mb-5 leading-relaxed">
          服务器暂时无法响应，请稍后再试。
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={reset}
            className="w-full py-2.5 rounded-xl bg-amber-500 text-sm font-bold text-white hover:bg-amber-600 transition-colors"
          >
            重新加载
          </button>
          <Link
            href="/daily"
            className="w-full py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
          >
            返回内室记录
          </Link>
        </div>
      </div>
    </div>
  )
}
