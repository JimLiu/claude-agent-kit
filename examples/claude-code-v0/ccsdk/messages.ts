import {
  type AssistantMessageEvent,
  type AttachmentPayload,
  type ChatMessage,
  type ChatSessionState,
  type ContentBlock,
  type MessageSegment,
  type RawMessageEvent,
  type ToolInvocationSegment,
  type ToolResultBlock,
  type UserMessageEvent,
} from "@/shared/types/messages";
import type { FileReadInput } from "@/shared/types/tools";

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

const decodeBase64 = (value: string): string => {
  if (typeof atob === "function") {
    return atob(value);
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "base64").toString("utf8");
  }
  throw new Error("No base64 decoder available in this environment.");
};

export const composeUserContent = (
  text: string,
  attachments?: AttachmentPayload[],
): ContentBlock[] => {
  const blocks: ContentBlock[] = [];

  if (attachments) {
    for (const attachment of attachments) {
      try {
        const mediaType =
          attachment.mediaType?.toLowerCase?.() ?? "application/octet-stream";
        const base64Payload = attachment.data;
        if (!base64Payload) {
          console.error("Attachment missing base64 payload", attachment.name);
          continue;
        }

        if (ALLOWED_IMAGE_TYPES.includes(mediaType)) {
          blocks.push({
            type: "image",
            title: attachment.name,
            source: {
              type: "base64",
              media_type: mediaType,
              data: base64Payload,
            },
          });
          continue;
        }

        if (mediaType === "text/plain") {
          const decoded = decodeBase64(base64Payload);
          blocks.push({
            type: "document",
            title: attachment.name,
            source: {
              type: "text",
              media_type: "text/plain",
              data: decoded,
            },
          });
          continue;
        }

        if (mediaType === "application/pdf") {
          blocks.push({
            type: "document",
            title: attachment.name,
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64Payload,
            },
          });
          continue;
        }

        console.error(`Unsupported attachment media type: ${mediaType}`);
      } catch (error) {
        console.error("Failed to process attachment", error);
      }
    }
  }

  blocks.push({ type: "text", text });
  return blocks;
};

const READ_TOOL_NAME = "Read";
const READ_COALESCED_NAME = "ReadCoalesced";

type CryptoLike = {
  randomUUID?: () => string;
  getRandomValues?: (buffer: Uint8Array) => Uint8Array;
};

const cryptoRef = ((): CryptoLike | undefined => {
  const candidate = (globalThis as { crypto?: CryptoLike }).crypto;
  return candidate;
})();

export function generateMessageId(): string {
  if (cryptoRef?.randomUUID) {
    return cryptoRef.randomUUID();
  }
  if (cryptoRef?.getRandomValues) {
    const bytes = cryptoRef.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 32);
  }
  return Math.random().toString(36).slice(2, 10);
}

export function processIncomingMessage(
  previousState: ChatSessionState,
  event: RawMessageEvent,
): ChatSessionState {
  const nextState: ChatSessionState = {
    ...previousState,
    messages: [...previousState.messages],
    lastError: undefined,
  };

  switch (event.type) {
    case "assistant": {
      const assistantEvent = event as AssistantMessageEvent;
      const message = buildAssistantMessage(assistantEvent);
      nextState.messages = upsertAssistantMessage(nextState.messages, message);
      updateTodosFromAssistant(nextState, assistantEvent);
      updateUsageFromAssistant(nextState, assistantEvent);
      break;
    }
    case "user": {
      const userEvent = event as UserMessageEvent;
      const containsNonToolResult = hasNonToolResultBlocks(userEvent);
      attachToolResults(nextState.messages, userEvent);
      if (containsNonToolResult) {
        const message = buildUserMessage(userEvent);
        if (!messageExists(nextState.messages, message.id)) {
          nextState.messages.push(message);
        }
      }
      break;
    }
    case "system": {
      nextState.sessionId = (event as { session_id?: string }).session_id ?? nextState.sessionId;
      if ((event as { subtype?: string }).subtype === "init") {
        nextState.busy = true;
        const model = (event as { model?: string }).model;
        if (model) {
          nextState.currentModel = model;
        }
      }
      break;
    }
    case "result": {
      const resultEvent = event as { total_cost_usd?: number; modelUsage?: Record<string, { contextWindow?: number }>; model?: string };
      nextState.busy = false;
      if (typeof resultEvent.total_cost_usd === "number") {
        nextState.usage = {
          ...nextState.usage,
          totalCost: resultEvent.total_cost_usd,
        };
      }
      if (resultEvent.modelUsage && nextState.currentModel) {
        const usageEntry = resultEvent.modelUsage[nextState.currentModel];
        if (usageEntry?.contextWindow) {
          nextState.usage = {
            ...nextState.usage,
            contextWindow: usageEntry.contextWindow,
          };
        }
      }
      break;
    }
    case "stream_event": {
      break;
    }
    default: {
      console.warn("Received unhandled message type", event);
      nextState.lastError = "Unhandled event type";
      break;
    }
  }

  nextState.messages = coalesceReadMessages(nextState.messages);
  return nextState;
}

function buildAssistantMessage(event: AssistantMessageEvent): ChatMessage {
  const segments: MessageSegment[] = event.message.content.map((block) => {
    switch (block.type) {
      case "text":
        return { kind: "text", block };
      case "tool_use":
        return { kind: "tool", block, result: undefined };
      case "tool_result":
        return {
          kind: "document",
          block: {
            type: "document",
            title: "Tool Result",
            source: {
              type: "text",
              media_type: "text/plain",
              data:
                typeof block.content === "string"
                  ? block.content
                  : JSON.stringify(block.content, null, 2),
            },
          },
        };
      default:
        return { kind: "document", block };
    }
  });

  return {
    id: event.message.id,
    type: "assistant",
    timestamp: Date.now(),
    segments,
    raw: event,
  };
}

function upsertAssistantMessage(
  messages: ChatMessage[],
  incoming: ChatMessage,
): ChatMessage[] {
  const index = messages.findIndex((message) => message.id === incoming.id);
  if (index === -1) {
    return [...messages, incoming];
  }

  const merged = mergeAssistantMessages(messages[index], incoming);
  return messages.map((message, idx) => (idx === index ? merged : message));
}

function mergeAssistantMessages(
  existing: ChatMessage,
  incoming: ChatMessage,
): ChatMessage {
  const segments = [...existing.segments];
  const toolSegments = new Map<string, number>();
  const textSegments = new Set<string>();
  const documentSegments = new Set<string>();

  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index];
    if (segment.kind === "tool") {
      toolSegments.set(segment.block.id, index);
    } else if (segment.kind === "text") {
      textSegments.add(segment.block.text);
    } else if (segment.kind === "document") {
      documentSegments.add(JSON.stringify(segment.block));
    }
  }

  for (const segment of incoming.segments) {
    if (segment.kind === "tool") {
      const existingIndex = toolSegments.get(segment.block.id);
      if (existingIndex !== undefined) {
        const current = segments[existingIndex] as ToolInvocationSegment;
        segments[existingIndex] = {
          ...current,
          block: segment.block,
          result: segment.result ?? current.result,
        };
        continue;
      }
      toolSegments.set(segment.block.id, segments.length);
      segments.push(segment);
      continue;
    }

    if (segment.kind === "text") {
      const textContent = segment.block.text;
      if (textSegments.has(textContent)) {
        continue;
      }
      textSegments.add(textContent);
      segments.push(segment);
      continue;
    }

    if (segment.kind === "document") {
      const serialized = JSON.stringify(segment.block);
      if (documentSegments.has(serialized)) {
        continue;
      }
      documentSegments.add(serialized);
    }
    segments.push(segment);
  }

  const timestamp = Math.max(existing.timestamp, incoming.timestamp);

  return {
    ...existing,
    segments,
    timestamp,
    raw: incoming.raw ?? existing.raw,
  };
}

function buildUserMessage(event: UserMessageEvent): ChatMessage {
  const content = event.message.content;
  const segments: MessageSegment[] = [];

  if (typeof content === "string") {
    segments.push({
      kind: "text",
      block: { type: "text", text: content },
    });
  } else {
    for (const block of content) {
      if (block.type === "tool_result") {
        segments.push({
          kind: "tool",
          block: {
            type: "tool_use",
            id: block.tool_use_id,
            name: "Task",
            input: {},
          },
          result: block,
        });
      } else if (block.type === "text") {
        segments.push({ kind: "text", block });
      } else {
        segments.push({ kind: "document", block });
      }
    }
  }

  return {
    id: event.message.id ?? generateMessageId(),
    type: "user",
    timestamp: Date.now(),
    segments,
    raw: event,
  };
}

function hasNonToolResultBlocks(event: UserMessageEvent): boolean {
  const content = event.message.content;
  if (typeof content === "string") {
    return true;
  }
  return content.some((block) => block.type !== "tool_result");
}

function attachToolResults(
  messages: ChatMessage[],
  event: UserMessageEvent,
): void {
  const content = event.message.content;
  if (!Array.isArray(content)) {
    return;
  }

  const toolResults = content.filter(
    (block): block is ToolResultBlock => block.type === "tool_result",
  );
  if (toolResults.length === 0) {
    return;
  }

  const toolIndex = buildToolInvocationIndex(messages);
  if (toolIndex.size === 0) {
    return;
  }

  for (const block of toolResults) {
    const target = toolIndex.get(block.tool_use_id);
    if (!target) continue;

    const [messageIndex, segmentIndex] = target;
    const message = messages[messageIndex];
    const segment = message.segments[segmentIndex] as ToolInvocationSegment;

    const updatedSegment: ToolInvocationSegment = {
      ...segment,
      result: normalizeToolResult(block),
    };

    const updatedSegments = message.segments.slice();
    updatedSegments[segmentIndex] = updatedSegment;

    messages[messageIndex] = {
      ...message,
      segments: updatedSegments,
    };
  }
}

function normalizeToolResult(block: ToolResultBlock): ToolResultBlock {
  if (typeof block.content === "string") {
    return block;
  }
  const flattened = block.content
    .map((entry) => {
      if (entry.type === "text") {
        return entry.text;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
  return { ...block, content: flattened };
}

function buildToolInvocationIndex(
  messages: ChatMessage[],
): Map<string, [number, number]> {
  const index = new Map<string, [number, number]>();

  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex--) {
    const message = messages[messageIndex];
    if (message.type !== "assistant") continue;

    for (let segmentIndex = message.segments.length - 1; segmentIndex >= 0; segmentIndex--) {
      const segment = message.segments[segmentIndex];
      if (segment.kind !== "tool") continue;
      if (!index.has(segment.block.id)) {
        index.set(segment.block.id, [messageIndex, segmentIndex]);
      }
    }
  }

  return index;
}

function coalesceReadMessages(messages: ChatMessage[]): ChatMessage[] {
  const result: ChatMessage[] = [];
  let buffer: ChatMessage[] = [];

  const flushBuffer = () => {
    if (buffer.length === 0) return;
    if (buffer.length === 1) {
      result.push(buffer[0]);
    } else {
      result.push(buildCoalescedRead(buffer));
    }
    buffer = [];
  };

  for (const message of messages) {
    if (isSuccessfulReadMessage(message)) {
      buffer.push(message);
    } else {
      flushBuffer();
      result.push(message);
    }
  }

  flushBuffer();
  return result;
}

function isSuccessfulReadMessage(message: ChatMessage): boolean {
  if (message.type !== "assistant") return false;
  if (message.segments.length === 0) return false;
  const segment = message.segments[0];
  if (segment.kind !== "tool") return false;
  if (segment.block.name !== READ_TOOL_NAME) return false;
  if (!segment.result || segment.result.is_error) return false;
  return true;
}

function buildCoalescedRead(messages: ChatMessage[]): ChatMessage {
  const fileReads: FileReadInput[] = [];
  for (const message of messages) {
    const segment = message.segments[0] as ToolInvocationSegment;
    const input = segment.block.input as FileReadInput;
    fileReads.push({ ...input });
  }

  const coalescedId = `coalesced_${generateMessageId()}`;
  const resultBlock: ToolResultBlock = {
    type: "tool_result",
    tool_use_id: coalescedId,
    content: `Successfully read ${fileReads.length} files`,
    is_error: false,
  };
  const toolInvocation: ToolInvocationSegment = {
    kind: "tool",
    block: {
      type: "tool_use",
      id: coalescedId,
      name: READ_COALESCED_NAME,
      input: { fileReads },
    },
    result: resultBlock,
  };

  return {
    id: toolInvocation.block.id,
    type: "assistant",
    timestamp: Date.now(),
    segments: [toolInvocation],
    raw: messages[messages.length - 1]?.raw,
  };
}

function updateTodosFromAssistant(
  state: ChatSessionState,
  event: AssistantMessageEvent,
) {
  if (!event.message?.content) return;
  const validStatuses = new Set(["pending", "in_progress", "completed"]);
  for (const block of event.message.content) {
    if (block.type !== "tool_use") continue;
    if (block.name !== "TodoWrite") continue;
    const input = block.input as {
      todos?: Array<{ content: string; status: string; activeForm?: string }>;
    };
    if (Array.isArray(input.todos)) {
      const todos = input.todos
        .filter((todo) => todo.content && validStatuses.has(todo.status))
        .map((todo) => ({
          content: todo.content,
          status: todo.status as "pending" | "in_progress" | "completed",
          activeForm: todo.activeForm,
        }));
      state.todos = { todos };
    }
  }
}

function updateUsageFromAssistant(
  state: ChatSessionState,
  event: AssistantMessageEvent,
) {
  const usage = event.message.usage;
  if (!usage) return;
  const total =
    usage.input_tokens +
    usage.output_tokens +
    (usage.cache_creation_input_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0);

  state.usage = {
    ...state.usage,
    totalTokens: total,
  };
}

function messageExists(messages: ChatMessage[], id: string): boolean {
  return messages.some((message) => message.id === id);
}
