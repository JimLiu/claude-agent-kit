import { ChatMessage, ChatMessagePart } from '../../ccsdk/chat-message'
import type {
  ChatMessageType,
  MessageContentBlock,
  ToolResultContentBlock,
} from '../../ccsdk/types'

export type SerializedChatMessage = {
  id: string
  type: ChatMessageType
  timestamp: number
  content: Array<{
    content: MessageContentBlock
    toolResult?: ToolResultContentBlock
  }>
}

export function hydrateChatMessage(
  message: SerializedChatMessage,
): ChatMessage {
  const parts = message.content.map((part) => {
    const chatPart = new ChatMessagePart(part.content)
    if (part.toolResult) {
      chatPart.setToolResult(part.toolResult)
    }
    return chatPart
  })

  return new ChatMessage(message.type, parts, message.timestamp, message.id)
}

export function updateToolResult(
  message: ChatMessage,
  toolUseId: string,
  result: ToolResultContentBlock,
): ChatMessage {
  const parts = message.content.map((part) => {
    if (part.content.type === 'tool_use' && part.content.id === toolUseId) {
      const updated = new ChatMessagePart(part.content)
      updated.setToolResult(result)
      return updated
    }

    const cloned = new ChatMessagePart(part.content)
    const toolResult = part.toolResult
    if (toolResult) {
      cloned.setToolResult(toolResult)
    }
    return cloned
  })

  return new ChatMessage(message.type, parts, message.timestamp, message.id)
}

export function createSystemMessage(text: string): ChatMessage {
  const part = new ChatMessagePart({ type: 'text', text })
  return new ChatMessage('system', [part])
}

export function sortMessages(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort((a, b) => a.timestamp - b.timestamp)
}
