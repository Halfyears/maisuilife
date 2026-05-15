'use client'

import { cn } from '@/lib/utils'
import { STATUS_TAGS } from '@/lib/constants'
import type { StatusTagValue } from '@/lib/constants'

interface StatusSelectorProps {
  value: StatusTagValue | null
  onChange: (value: StatusTagValue) => void
  disabled?: boolean
}

export function StatusSelector({ value, onChange, disabled }: StatusSelectorProps) {
  return (
    <fieldset disabled={disabled} className="w-full">
      <legend className="mb-3 text-sm font-medium text-muted-foreground">
        今日心境
      </legend>
      <div className="grid grid-cols-5 gap-2">
        {STATUS_TAGS.map((tag) => {
          const selected = value === tag.value
          return (
            <button
              key={tag.value}
              type="button"
              onClick={() => onChange(tag.value)}
              aria-pressed={selected}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3',
                'text-center transition-all duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected
                  ? 'border-gold-400 bg-gold-400/10 shadow-sm shadow-gold-400/20'
                  : 'border-border bg-card hover:border-gold-300 hover:bg-gold-400/5',
                disabled && 'cursor-not-allowed opacity-50',
              )}
            >
              <span className="text-2xl leading-none" aria-hidden>
                {tag.emoji}
              </span>
              <span className={cn(
                'text-xs font-medium leading-none',
                selected ? 'text-gold-700' : 'text-muted-foreground',
              )}>
                {tag.label}
              </span>
            </button>
          )
        })}
      </div>
      {value && (
        <p className="mt-2 text-xs text-muted-foreground text-center">
          {STATUS_TAGS.find(t => t.value === value)?.hint}
        </p>
      )}
    </fieldset>
  )
}
