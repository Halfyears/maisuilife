'use client'

import { useState, useEffect } from 'react'

const DAYS = ['日', '一', '二', '三', '四', '五', '六']

function formatChip(d: Date) {
  return `${d.getMonth() + 1}月${d.getDate()}日 · 星期${DAYS[d.getDay()]}`
}

// Inline date chip for page headers (e.g. home page)
export function LocalDateChip({ className }: { className?: string }) {
  const [text, setText] = useState('')
  useEffect(() => { setText(formatChip(new Date())) }, [])
  if (!text) return null
  return <span className={className}>{text}</span>
}

// Two-line block for the 今日内室 header
export function LocalDailyDate() {
  const [dateStr, setDateStr] = useState('')
  useEffect(() => {
    const d = new Date()
    setDateStr(`${d.getMonth() + 1}月${d.getDate()}日 · 星期${DAYS[d.getDay()]}`)
  }, [])

  return (
    <div>
      <p className="text-xl font-black leading-none text-stone-900 tracking-wide">今日内室</p>
      <p className="text-[11px] text-stone-400 mt-1">
        {dateStr || ' '}
      </p>
    </div>
  )
}
