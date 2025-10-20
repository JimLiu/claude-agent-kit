import type {
  FileReadInput,
  ToolInput,
  ToolName,
  TodoItem,
} from "./tools";

declare const Buffer:
  | undefined
  | {
      from(input: string, encoding: string): { toString(encoding: string): string };
    };

export interface TextBlock {
  type: "text";
  text: string;
}

export interface ImageBlock {
  type: "image";
  source: {
    type: "base64" | "text" | "url";
    media_type: string;
    data?: string;
    url?: string;
  };
  title?: string;
}

export interface DocumentBlock {
  type: "document";
  title?: string;
  source: {
    type: "base64" | "text";
    media_type: string;
    data: string;
  };
}

export interface ThinkingBlock {
  type: "thinking";
  thinking: string;
}

export interface ThinkingRedactedBlock {
  type: "redacted_thinking";
  hint?: string;
}

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: ToolName;
  input: ToolInput;
}

export interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string | Array<TextBlock | ImageBlock | DocumentBlock>;
  is_error: boolean;
}

export interface SearchResultBlock {
  type: "search_result";
  query: string;
  results: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
}

export type ContentBlock =
  | TextBlock
  | ImageBlock
  | DocumentBlock
  | ThinkingBlock
  | ThinkingRedactedBlock
  | ToolUseBlock
  | ToolResultBlock
  | SearchResultBlock;

export interface MessageUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface BaseEvent {
  type: string;
  timestamp?: number;
}

export interface AssistantMessageEvent extends BaseEvent {
  type: "assistant";
  message: {
    id: string;
    role: "assistant";
    content: ContentBlock[];
    usage?: MessageUsage;
  };
}

export interface UserMessageEvent extends BaseEvent {
  type: "user";
  message: {
    id?: string;
    role: "user";
    content: string | ContentBlock[];
  };
}

export interface SystemMessageEvent extends BaseEvent {
  type: "system";
  subtype?: "init" | "status" | "error" | string;
  session_id?: string;
  model?: string;
  message?: { content: string };
}

export interface ResultMessageEvent extends BaseEvent {
  type: "result";
  subtype?: string;
  total_cost_usd?: number;
  duration_ms?: number;
  result?: unknown;
  modelUsage?: Record<
    string,
    {
      contextWindow?: number;
    }
  >;
}

export interface ToolStreamEvent extends BaseEvent {
  type: "stream_event";
  stream_event: {
    type: string;
    payload: unknown;
  };
}

export type RawMessageEvent =
  | AssistantMessageEvent
  | UserMessageEvent
  | SystemMessageEvent
  | ResultMessageEvent
  | ToolStreamEvent;

export interface ToolInvocationSegment {
  kind: "tool";
  block: ToolUseBlock;
  result?: ToolResultBlock;
}

export interface TextSegment {
  kind: "text";
  block: TextBlock;
}

export interface DocumentSegment {
  kind: "document";
  block:
    | DocumentBlock
    | ImageBlock
    | SearchResultBlock
    | ThinkingBlock
    | ThinkingRedactedBlock
    | ToolUseBlock;
}

export type MessageSegment =
  | ToolInvocationSegment
  | TextSegment
  | DocumentSegment;

export interface AttachmentPayload {
  id?: string;
  name: string;
  mediaType: string;
  data: string;
}


export interface ChatMessage {
  id: string;
  type: "assistant" | "user" | "system";
  timestamp: number;
  segments: MessageSegment[];
  raw?: RawMessageEvent;
}

export interface UsageSnapshot {
  totalTokens: number;
  totalCost: number;
  contextWindow: number;
}

export interface TodoState {
  todos: TodoItem[];
}

export interface ReadCoalescedPayload {
  fileReads: FileReadInput[];
}

export interface ChatSessionState {
  messages: ChatMessage[];
  todos?: TodoState;
  usage: UsageSnapshot;
  busy: boolean;
  sessionId?: string;
  currentModel?: string;
  lastError?: string;
}
