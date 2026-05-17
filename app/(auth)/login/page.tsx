import { Suspense } from 'react'
import { LoginForm } from './_components/login-form'

export const metadata = { title: '登录 — 麦穗喜乐' }

function LoginFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-stone-100/85 bg-white/90 p-8 shadow-sm backdrop-blur-md">
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="h-8 w-8 rounded-full bg-amber-100 animate-pulse" />
          <div className="h-4 w-24 rounded bg-stone-100 animate-pulse" />
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  )
}
