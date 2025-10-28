import type { MouseEventHandler, PropsWithChildren } from 'react'

import { cn } from '../../../lib/utils'

type SecondaryLineProps = {
  onClick?: MouseEventHandler<HTMLDivElement>
  hideBracket?: boolean
}

export function SecondaryLine({
  onClick,
  hideBracket = false,
  children,
}: PropsWithChildren<SecondaryLineProps>) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 text-[12px] text-muted-foreground cursor-default',
        onClick && 'cursor-pointer'
      )}
      onClick={onClick}
    >
      {!hideBracket && <span className="text-muted-foreground">⎿</span>}
      <span>{children}</span>
    </div>
  )
}
