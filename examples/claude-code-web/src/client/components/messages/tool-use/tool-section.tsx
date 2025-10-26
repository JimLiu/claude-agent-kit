import type { PropsWithChildren } from 'react'

import { cn } from '../../../lib/utils'

type ToolSectionProps = {
  label: string
  disableClipping?: boolean
  onClick?: () => void
}

export function ToolSection({
  label,
  disableClipping,
  onClick,
  children,
}: PropsWithChildren<ToolSectionProps>) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-[3px] min-w-[42px] text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          'flex-1 overflow-hidden whitespace-pre-wrap break-words rounded border border-primary/40 bg-background p-2 font-mono text-sm',
          disableClipping && 'overflow-visible',
          onClick && 'cursor-pointer'
        )}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
      >
        {children}
      </div>
    </div>
  )
}
