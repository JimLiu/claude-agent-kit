import type { PropsWithChildren } from 'react'

export function ToolBody({ children }: PropsWithChildren) {
  return (
    <div className="flex flex-col">
      {children}
    </div>
  )
}
