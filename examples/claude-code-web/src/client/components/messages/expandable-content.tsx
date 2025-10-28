import { useEffect, useRef, useState } from 'react'

import type { ChatMessagePart } from '@claude-agent-kit/messages'
import type { ClaudeMessageContext } from './types'
import { MessagePart } from './message-part'
import { cn } from '../../lib/utils'

type ExpandableContentProps = {
  part: ChatMessagePart
  context: ClaudeMessageContext
  maxHeight?: number
}

export function ExpandableContent({ part, context, maxHeight = 250 }: ExpandableContentProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const element = containerRef.current
    if (!element) {
      return
    }

    setIsOverflowing(element.scrollHeight > maxHeight)
  }, [part, maxHeight])

  const contentClassName = cn(
    'whitespace-pre-wrap overflow-hidden transition-[max-height] duration-300 ease-in-out',
    !expanded &&
      isOverflowing &&
      'relative after:pointer-events-none after:absolute after:bottom-0 after:left-0 after:right-0 after:h-10 after:bg-gradient-to-b after:from-transparent after:to-card after:content-[""]'
  )

  return (
    <div className="flex flex-col gap-1 max-w-fit">
      <div
        ref={containerRef}
        className={contentClassName}
        style={!expanded && isOverflowing ? { maxHeight } : undefined}
      >
        <MessagePart content={part} context={context} plainText />
      </div>
      {isOverflowing ? (
        <button
          type="button"
          className="mx-auto cursor-pointer border-0 bg-transparent p-[2px] font-mono text-[0.8em] text-muted-foreground hover:underline"
          onClick={() => setExpanded((value) => !value)}
          aria-label={expanded ? 'Show less' : 'Show more'}
        >
          {expanded ? '[Show less]' : '[Show more]'}
        </button>
      ) : null}
    </div>
  )
}
