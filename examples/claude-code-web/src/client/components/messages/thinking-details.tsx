import { useState } from 'react'

import type { ClaudeMessageContext } from './types'
import { cn } from '../../lib/utils'
import { MarkdownContent } from './tool-use/markdown-content'

type ThinkingDetailsProps = {
  thinking: string
  context: ClaudeMessageContext
}

export function ThinkingDetails({ thinking, context }: ThinkingDetailsProps) {
  const [open, setOpen] = useState(false)

  if (!thinking.trim()) {
    return null
  }

  return (
    <details
      className="text-muted-foreground"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary
        className={cn(
          'flex cursor-pointer select-none list-none items-center justify-between gap-2 text-muted-foreground italic opacity-80 transition-opacity marker:hidden',
          open ? 'opacity-100' : 'hover:opacity-100'
        )}
      >
        <span>Thinking</span>
        {open ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" fill="currentColor" className="ml-1 h-3 w-3">
            <path d="M2.22 7.78a.75.75 0 0 0 1.06 0L6 5.06l2.72 2.72a.75.75 0 0 0 1.06-1.06L6.53 3.47a.75.75 0 0 0-1.06 0L2.22 6.72a.75.75 0 0 0 0 1.06Z" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" fill="currentColor" className="ml-1 h-3 w-3">
            <path d="M2.22 4.22a.75.75 0 0 1 1.06 0L6 6.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L2.22 5.28a.75.75 0 0 1 0-1.06Z" />
          </svg>
        )}
      </summary>
      <div className="mt-1 font-normal text-muted-foreground">
        <MarkdownContent content={thinking} context={context} />
      </div>
    </details>
  )
}
