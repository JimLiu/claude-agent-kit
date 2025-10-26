import type { MessageProps } from './types'
import { AssistantMessage } from './assistant-message'
import { UserMessage } from './user-message'

export function Message({ message, context, isHighlighted }: MessageProps) {
  if (message.isEmpty) {
    return null
  }

  if (message.type === 'user') {
    return (
      <UserMessage
        parts={message.content}
        context={context}
        isHighlighted={Boolean(isHighlighted)}
      />
    )
  }

  if (message.type === 'assistant') {
    return (
      <AssistantMessage
        parts={message.content}
        context={context}
        isHighlighted={Boolean(isHighlighted)}
      />
    )
  }

  return null
}
