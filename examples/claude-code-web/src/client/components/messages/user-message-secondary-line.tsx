import type { MouseEventHandler, PropsWithChildren } from 'react'

import { cn } from '../../lib/utils'

type SecondaryLineProps = {
  onClick?: MouseEventHandler<HTMLDivElement>
}

export function UserMessageSecondaryLine({
  onClick,
  children,
}: PropsWithChildren<SecondaryLineProps>) {
  const containerClassName = cn(
    'ml-[-2px] mt-[2px] mb-[2px] inline-flex w-full items-start gap-1 text-[0.85em] text-muted-foreground opacity-70',
    onClick && 'cursor-pointer'
  )

  const contentClassName = cn('w-full flex-1', onClick && 'hover:underline')

  return (
    <div className={containerClassName} onClick={onClick}>
      <span className="relative -top-[0.1em] flex-shrink-0">⎿</span>
      <span className={contentClassName}>{children}</span>
    </div>
  )
}
