import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { 
  ChatMessage, 
  ChatMessagePart, 
  ToolResultContentBlock, 
  ToolUseContentBlock 
} from "../types";
import { createChatMessageFromSDKMessage } from "./create-message";

export interface ToolResultUpdate {
  message: ChatMessage;
  toolUseId: string;
  toolResult: ToolResultContentBlock;
}

export interface AppendRenderableMessageResult {
  addedMessage?: ChatMessage;
  updatedMessages: ChatMessage[];
  toolResultUpdates: ToolResultUpdate[];
}

export function appendRenderableMessage(
  messages: ChatMessage[],
  incoming: SDKMessage,
): AppendRenderableMessageResult {
  const updatedMessages: ChatMessage[] = [];
  const toolResultUpdates: ToolResultUpdate[] = [];

  if (incoming.type === 'user' && Array.isArray(incoming.message.content)) {
    for (const block of incoming.message.content) {
      if (block.type === 'tool_result') {
        const match = findMostRecentToolUse(messages, block.tool_use_id);
        if (match) {
          match.part.toolResult = block;
          if (!updatedMessages.includes(match.message)) {
            updatedMessages.push(match.message);
          }
          toolResultUpdates.push({
            message: match.message,
            toolUseId: block.tool_use_id,
            toolResult: block,
          });
        }
      }
    }
  }

  const rendered = createChatMessageFromSDKMessage(incoming);
  // If the incoming message didn't update any tool results, add it as a new message
  if (rendered && updatedMessages.length === 0) {
    messages.push(rendered);
    return {
      addedMessage: rendered,
      updatedMessages,
      toolResultUpdates,
    };
  }

  return {
    addedMessage: undefined,
    updatedMessages,
    toolResultUpdates,
  };
}



type ToolUseMatch = {
  message: ChatMessage;
  part: ChatMessagePart & { content: ToolUseContentBlock };
};

function findMostRecentToolUse(
  messages: ChatMessage[],
  toolUseId: string,
): ToolUseMatch | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || message.type !== 'assistant') {
      continue;
    }

    for (const part of message.content) {
      const { content } = part;
      if (content.type === 'tool_use' && content.id === toolUseId) {
        return { message, part: part as ToolUseMatch['part'] };
      }
    }
  }

  return undefined;
}
