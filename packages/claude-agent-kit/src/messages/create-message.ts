import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { generateId } from "../utils/id";
import type { ChatMessage, MessageContentBlock, ChatMessagePart, ChatMessageType } from "../types";

function createChatMessagePart(content: MessageContentBlock) : ChatMessagePart {
  return {
    content,
    toolResult: undefined,
  }
}

export function createChatMessageFromSDKMessage(message: SDKMessage): ChatMessage | undefined {
  const messageId = extractMessageUuid(message);
  const timestamp = extractMessageTimestamp(message);

  if (message.type === 'user' || message.type === 'assistant') {
    const content = message.message.content;
    if (typeof content === 'string') {
      return createTextMessage(message.type, content, messageId, timestamp);
    }

    const parts = content.map((block: MessageContentBlock) => createChatMessagePart(block));
    return createChatMessage(message.type, parts, timestamp ?? Date.now(), messageId);
  }

  if (message.type === 'stream_event') {
    return undefined;
  }

  return createChatMessage(message.type, [], timestamp ?? Date.now(), messageId);
}


export function createChatMessage(
  type: ChatMessageType,
  content: ChatMessagePart[],
  timestamp: number = Date.now(),
  id: string = generateId()
) : ChatMessage {
  return {
    id,
    type,
    content,
    timestamp,
  }
}

export function createTextMessage(type: ChatMessageType, text: string, id: string, timestamp?: number): ChatMessage {
  return createChatMessage(type, [createChatMessagePart({ type: 'text', text })], timestamp ?? Date.now(), id);
}


function extractMessageUuid(message: SDKMessage): string {
  const withUuid = message as { uuid?: string };
  return withUuid.uuid ?? generateId();
}

function extractMessageTimestamp(message: SDKMessage): number | undefined {
  const raw = (message as { timestamp?: unknown }).timestamp;
  if (typeof raw === 'number') {
    return raw;
  }
  if (typeof raw === 'string') {
    const numeric = Number(raw);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
    const parsed = Date.parse(raw);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return undefined;
}
