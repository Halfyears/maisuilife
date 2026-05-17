'use client'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5)  return '深夜了'
  if (h < 12) return '早安'
  if (h < 14) return '午安'
  if (h < 18) return '下午好'
  return '晚安'
}

export function TimeGreeting({ name }: { name: string }) {
  return (
    <p className="text-sm font-medium text-stone-500" suppressHydrationWarning>
      {greeting()}，{name}
    </p>
  )
}
