import { nanoid } from "nanoid";
import type {
  ToolResultContentBlock,
  MessageContentBlock,
  ChatMessageType,
  ToolUseContentBlock,
  UserContentBlock,
  SDKMessage,
  AttachmentPayload
} from "./types";


export class ChatMessagePart {

  private toolResultData: ToolResultContentBlock | undefined;
  public readonly content: MessageContentBlock;

  constructor(content: MessageContentBlock) {
    this.content = content;
  }

  get toolResult(): ToolResultContentBlock | undefined {
    return this.toolResultData;
  }

  setToolResult(result: ToolResultContentBlock): void {
    this.toolResultData = result;
  }

  toJSON(): { content: MessageContentBlock; toolResult?: ToolResultContentBlock } {
    return {
      content: this.content,
      toolResult: this.toolResultData,
    };
  }
}


export class ChatMessage {

  public readonly type: ChatMessageType
  public readonly content: ChatMessagePart[]
  public readonly timestamp: number = Date.now()
  public readonly id: string

  constructor(
    type: ChatMessageType,
    content: ChatMessagePart[],
    timestamp: number = Date.now(),
    id: string = nanoid()
  ) {
    this.type = type;
    this.content = content;
    this.timestamp = timestamp;
    this.id = id;
  }

  get isEmpty(): boolean {
    if (this.type === 'system') {
      return false;
    }

    return (
      this.content.length === 0 ||
      this.content.every((part) => part.content.type === 'tool_result')
    );
  }

  toJSON(): {
    id: string;
    type: ChatMessageType;
    timestamp: number;
    content: ReturnType<ChatMessagePart["toJSON"]>[];
  } {
    return {
      id: this.id,
      type: this.type,
      timestamp: this.timestamp,
      content: this.content.map((part) => part.toJSON()),
    };
  }
}

function createTextMessage(type: ChatMessageType, text: string, id: string, timestamp?: number): ChatMessage {
  return new ChatMessage(type, [new ChatMessagePart({ type: 'text', text })], timestamp ?? Date.now(), id);
}


function extractMessageUuid(message: SDKMessage): string {
  const withUuid = message as { uuid?: string };
  return withUuid.uuid ?? nanoid();
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

export function createChatMessageFromSDKMessage(message: SDKMessage): ChatMessage | undefined {
  const messageId = extractMessageUuid(message);
  const timestamp = extractMessageTimestamp(message);

  if (message.type === 'user' || message.type === 'assistant') {
    const content = message.message.content;
    if (typeof content === 'string') {
      return createTextMessage(message.type, content, messageId, timestamp);
    }

    const parts = content.map((block: MessageContentBlock) => new ChatMessagePart(block));
    return new ChatMessage(message.type, parts, timestamp ?? Date.now(), messageId);
  }

  if (message.type === 'stream_event') {
    return undefined;
  }

  return new ChatMessage(message.type, [], timestamp ?? Date.now(), messageId);
}


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
          match.part.setToolResult(block);
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
  if (rendered) {
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
  const id = baseMessage?.id ?? nanoid();

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

  const part = new ChatMessagePart(toolUse);
  part.setToolResult(toolResult);

  return new ChatMessage('assistant', [part], timestamp, id);
}


/** MIME types that can be rendered inline within chat transcripts. */
function decodeBase64Text(value: string): string {
  const globalWithAtob = globalThis as typeof globalThis & {
    atob?: (input: string) => string;
  };

  if (typeof globalWithAtob.atob === 'function') {
    return globalWithAtob.atob(value);
  }

  return Buffer.from(value, 'base64').toString('utf-8');
}

const INLINE_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/**
 * Construct the content blocks for a user message.
 *
 * Combines the prompt text with any attachments into the order expected by Claude:
 * selection/context blocks first, followed by attachments, then the user's message.
 */
export function buildUserMessageContent(
  prompt: string,
  attachments: AttachmentPayload[] | undefined,
): UserContentBlock[] {
  const blocks: UserContentBlock[] = [];

  // Attach any user-supplied assets (images, documents, etc.).
  if (attachments) {
    for (const attachment of attachments) {
      try {
        const mediaType = attachment.mediaType;
        const base64Data = attachment.data;
        // Inline supported image types.
        if (INLINE_IMAGE_MIME_TYPES.includes(mediaType)) {
          blocks.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Data,
            },
          });
        } else if (mediaType === 'text/plain') {
          // Decode plain text files into inline document blocks.
          const decoded = decodeBase64Text(base64Data);
          blocks.push({
            type: 'document',
            source: {
              type: 'text',
              media_type: 'text/plain',
              data: decoded,
            },
            title: attachment.name,
          });
        } else if (mediaType === 'application/pdf') {
          // Preserve PDF files as base64 documents.
          blocks.push({
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64Data,
            },
            title: attachment.name,
          });
        } else {
          console.error(`Cannot processing file: ${attachment.name}`);
        }
      } catch (error) {
        console.error('Error processing file:', error);
      }
    }
  }

  // Always append the raw prompt text at the end.
  blocks.push({
    type: 'text',
    text: prompt,
  });

  return blocks;
}
