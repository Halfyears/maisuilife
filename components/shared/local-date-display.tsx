'use client'

const DAYS = ['日', '一', '二', '三', '四', '五', '六']

// Inline date chip for page headers (e.g. home page)
export function LocalDateChip({ className }: { className?: string }) {
  const d = new Date()
  const text = `${d.getMonth() + 1}月${d.getDate()}日 · 星期${DAYS[d.getDay()]}`
  return <span className={className}>{text}</span>
}

// Two-line date block for the 今日内室 header
export function LocalDailyDate() {
  const d = new Date()
  return (
    <div>
      <p className="text-lg font-black leading-none text-stone-900">
        {d.getMonth() + 1}月{d.getDate()}日
      </p>
      <p className="text-[11px] text-stone-400 mt-0.5 tracking-wide">
        星期{DAYS[d.getDay()]} · 今日内室
      </p>
    </div>
  )
}
