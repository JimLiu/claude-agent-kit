import { ChatMessage, ChatMessagePart } from "./chat-message";


export type ToolUseStatus = 'success' | 'failure' | 'progress';

export function getToolUseStatus(message: ChatMessage): ToolUseStatus | null {
  if (message.type !== 'assistant') {
    return null;
  }

  for (const part of message.content) {
    if (isToolUsePart(part)) {
      const result = part.toolResult;
      if (!result) {
        return 'progress';
      }
      return result.is_error ? 'failure' : 'success';
    }
  }

  return null;
}

function isToolUsePart(part: ChatMessagePart): part is ChatMessagePart & {
  content: Extract<ChatMessagePart['content'], { type: 'tool_use' }>;
} {
  return part.content.type === 'tool_use';
}
