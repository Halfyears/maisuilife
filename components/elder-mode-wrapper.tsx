'use client'

import { cn } from '@/lib/utils'

interface ElderModeWrapperProps {
  elderMode: boolean
  children: React.ReactNode
  className?: string
}

/**
 * Wraps all page content. When elderMode is true, applies the .elder-mode
 * CSS class which bumps base font-size to 1.2rem and increases line-height.
 * Interactive elements (inputs, buttons) also receive a proportional bump
 * via the CSS rules in globals.css so nothing needs per-component changes.
 *
 * Usage: read settings.elder_mode from server, pass it down as a prop.
 */
export function ElderModeWrapper({ elderMode, children, className }: ElderModeWrapperProps) {
  return (
    <div className={cn(elderMode && 'elder-mode', className)}>
      {children}
    </div>
  )
}
