import type {
  ChatMessage,
  ChatMessagePart,
  ChatMessageType,
  MessageContentBlock,
  ToolResultContentBlock,
} from '@claude-agent-kit/messages'

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
    const chatPart: ChatMessagePart = {
      content: part.content,
      toolResult: part.toolResult,
    }
    if (part.toolResult) {
      chatPart.toolResult = part.toolResult
    }
    return chatPart
  })

  // return new ChatMessage(message.type, parts, message.timestamp, message.id)
  return {
    id: message.id,
    type: message.type,
    timestamp: message.timestamp,
    content: parts,
  }
}

export function updateToolResult(
  message: ChatMessage,
  toolUseId: string,
  result: ToolResultContentBlock,
): ChatMessage {
  const parts = message.content.map((part) => {
    if (part.content.type === 'tool_use' && part.content.id === toolUseId) {
      const updated: ChatMessagePart = { content: part.content, toolResult: result }
      return updated
    }

    const cloned: ChatMessagePart = { content: part.content, toolResult: part.toolResult }
    return cloned
  })

  return {
    id: message.id,
    type: message.type,
    timestamp: message.timestamp,
    content: parts,
  }
}

export function createSystemMessage(text: string): ChatMessage {
  const part = { content: { type: 'text', text }, toolResult: undefined }
  return { id: 'system', type: 'user', timestamp: Date.now(), content: [part] }
}

export function sortMessages(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort((a, b) => a.timestamp - b.timestamp)
}
