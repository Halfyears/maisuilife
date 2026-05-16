'use client'

import { cn } from '@/lib/utils'
import { STATUS_TAGS } from '@/lib/constants'
import type { StatusTagValue } from '@/lib/constants'

interface StatusSelectorProps {
  values:    StatusTagValue[]
  onToggle:  (value: StatusTagValue) => void
  disabled?: boolean
}

export function StatusSelector({ values, onToggle, disabled }: StatusSelectorProps) {
  return (
    <fieldset disabled={disabled} className="w-full">
      <legend className="mb-3 text-sm font-semibold text-stone-500">
        今日心境{' '}
        <span className="text-stone-300 font-normal text-xs">（可多选）</span>
      </legend>
      <div className="grid grid-cols-5 gap-2">
        {STATUS_TAGS.map((tag) => {
          const selected = values.includes(tag.value)
          return (
            <button
              key={tag.value}
              type="button"
              onClick={() => onToggle(tag.value)}
              aria-pressed={selected}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3',
                'text-center transition-all duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
                selected
                  ? 'border-amber-300 bg-amber-50/80 shadow-sm shadow-amber-400/20'
                  : 'border-stone-200 bg-white hover:border-amber-200 hover:bg-amber-50/30',
                disabled && 'cursor-not-allowed opacity-50',
              )}
            >
              <span className="text-2xl leading-none" aria-hidden>
                {tag.emoji}
              </span>
              <span className={cn(
                'text-xs font-medium leading-none',
                selected ? 'text-amber-700' : 'text-stone-500',
              )}>
                {tag.label}
              </span>
            </button>
          )
        })}
      </div>
      {values.length > 0 && (
        <p className="mt-2.5 text-xs text-stone-400 text-center">
          {values
            .map(v => STATUS_TAGS.find(t => t.value === v)?.hint)
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
    </fieldset>
  )
}
