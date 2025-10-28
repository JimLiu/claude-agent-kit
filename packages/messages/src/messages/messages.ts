import type {
  ChatMessage,
  ChatMessagePart,
  SDKMessage,
  ToolResultContentBlock,
  ToolUseContentBlock,
} from "../types";
import { generateId } from "../utils/id";
import { appendRenderableMessage } from "./append-renderable-message";
import { createChatMessage } from "./create-message";

export function addNewSDKMessage(
  messages: ChatMessage[],
  newMessage: SDKMessage,
): ChatMessage[] {
  const workingMessages = [...messages];
  appendRenderableMessage(workingMessages, newMessage);
  return coalesceReadMessages(workingMessages);
}

export function convertSDKMessages(
  sdkMessages: SDKMessage[],
): ChatMessage[] {
  if (sdkMessages.length === 0) {
    return [];
  }

  const rendered: ChatMessage[] = [];
  for (const message of sdkMessages) {
    appendRenderableMessage(rendered, message);
  }
  return coalesceReadMessages(rendered);
}


export function coalesceReadMessages(messages: ChatMessage[]): ChatMessage[] {
  const result: ChatMessage[] = [];
  let index = 0;

  while (index < messages.length) {
    const message = messages[index];
    if (!message) {
      index += 1;
      continue;
    }

    if (isReadToolUse(message) && hasSuccessfulToolResult(message)) {
      const batch: ChatMessage[] = [message];
      let next = index + 1;

      while (next < messages.length) {
        const nextMessage = messages[next];
        if (
          !nextMessage ||
          !isReadToolUse(nextMessage) ||
          !hasSuccessfulToolResult(nextMessage)
        ) {
          break;
        }

        batch.push(nextMessage);
        next += 1;
      }

      if (batch.length > 1) {
        result.push(createCoalescedReadMessage(batch));
        index = next;
        continue;
      }
    }

    result.push(message);
    index += 1;
  }

  return result;
}

function isReadToolUse(message: ChatMessage): boolean {
  if (message.type !== 'assistant') {
    return false;
  }

  return message.content.some(
    (part) => part.content.type === 'tool_use' && part.content.name === 'Read',
  );
}

function hasSuccessfulToolResult(message: ChatMessage): boolean {
  if (message.type !== 'assistant' || message.content.length === 0) {
    return false;
  }

  const [firstPart] = message.content;
  if (!firstPart) {
    return false;
  }

  const result = firstPart.toolResult;
  return result ? !result.is_error : false;
}

function createCoalescedReadMessage(messages: ChatMessage[]): ChatMessage {
  const baseMessage = messages[0];
  const timestamp = baseMessage?.timestamp ?? Date.now();
  const id = baseMessage?.id ?? generateId();

  const toolUse: ToolUseContentBlock = {
    type: 'tool_use',
    id: `coalesced_${Math.random().toString(36).slice(2)}`,
    name: 'ReadCoalesced',
    input: {
      fileReads: messages.map((message) => {
        const toolUsePart = message.content.find(
          (part): part is ChatMessagePart & { content: ToolUseContentBlock } =>
            part.content.type === 'tool_use',
        );
        return toolUsePart ? toolUsePart.content.input : null;
      }),
    },
  };

  const toolResult: ToolResultContentBlock = {
    type: 'tool_result',
    tool_use_id: toolUse.id,
    content: `Successfully read ${messages.length} files`,
    is_error: false,
  };

  const part: ChatMessagePart = {
    content: toolUse,
    toolResult
  }

  return createChatMessage('assistant', [part], timestamp, id);
}