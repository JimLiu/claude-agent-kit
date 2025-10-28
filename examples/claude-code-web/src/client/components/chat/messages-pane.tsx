import { useEffect, useMemo, useRef } from 'react'

import type { ChatMessage } from '@claude-agent-kit/messages'
import type { ClaudeMessageContext } from '../messages/types'

import { EmptyState } from '../messages/empty-state'
import { Message } from '../messages/message'
import { ThinkingIndicator } from './thinking-indicator'

type MessagesPaneProps = {
  messages: ChatMessage[]
  isStreaming: boolean
}

export function MessagesPane({ messages, isStreaming }: MessagesPaneProps) {
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null)
  const context = useMemo<ClaudeMessageContext>(() => {
    const open = (filePath: string, range?: { startLine?: number; endLine?: number }) => {
      console.info('Requested open file', { filePath, range })
    }

    const openContent = async (
      content: string,
      title: string,
      preserveFocus: boolean,
    ): Promise<void> => {
      if (typeof window === 'undefined') {
        return
      }

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const newWindow = window.open(url, '_blank', 'noopener,noreferrer')

      if (newWindow) {
        newWindow.document.title = title
        if (preserveFocus) {
          newWindow.blur()
          window.focus()
        }
      } else {
        console.info('Unable to open preview window; falling back to console output.', {
          title,
        })
        console.info(content)
      }

      window.setTimeout(() => URL.revokeObjectURL(url), 5000)
    }

    return {
      fileOpener: { open, openContent },
    }
  }, [])

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming])

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 overflow-x-hidden flex-col relative">
      <div className="flex flex-col gap-0">
        {messages.length === 0 ? (
          <EmptyState context={context} />
        ) : (
          messages.map((message, index) => (
            <Message
              key={message.id}
              message={message}
              context={context}
              isHighlighted={isStreaming && index === messages.length - 1}
            />
          ))
        )}
        {isStreaming ? (
          <div className="mt-2 flex h-7 items-center">
            <div className="flex items-center">
              <ThinkingIndicator size={14} />
            </div>
          </div>
        ) : null}
        <div ref={scrollAnchorRef} />
      </div>
    </div>
  )
}
