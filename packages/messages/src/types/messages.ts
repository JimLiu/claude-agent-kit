import type { SDKAssistantMessage } from "@anthropic-ai/claude-agent-sdk";

export interface TextContentBlock {
  type: 'text';
  text: string;
}

export interface ImageContentSource {
  type: 'base64';
  media_type: string;
  data: string;
}

export interface ImageContentBlock {
  type: 'image';
  source: ImageContentSource;
}

export interface DocumentContentSource {
  type: 'base64' | 'text';
  media_type: string;
  data: string;
}

export interface DocumentContentBlock {
  type: 'document';
  source: DocumentContentSource;
  title?: string;
}

export interface ToolUseContentBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ThinkingContentBlock {
  type: 'thinking';
  thinking?: string;
}

export interface ToolResultContentBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | TextContentBlock[];
  is_error: boolean;
}

export type APIAssistantContentBlock = SDKAssistantMessage['message']['content'];


export type UserContentBlock =
  | TextContentBlock
  | ImageContentBlock
  | DocumentContentBlock
  | ToolResultContentBlock;

export type AssistantContentBlock =
  | TextContentBlock
  | ImageContentBlock
  | DocumentContentBlock
  | ToolUseContentBlock
  | ThinkingContentBlock
  | ToolResultContentBlock
  | APIAssistantContentBlock;

export type MessageContentBlock = UserContentBlock | AssistantContentBlock;


/** Attachment payload for user-supplied assets such as images or documents. */
export interface AttachmentPayload {
  id?: string;
  name: string;
  mediaType: string;
  data: string;
}

/** Aggregated usage metrics returned by the Claude Agent service. */
export interface UsageSummary {
  totalTokens: number;
  totalCost: number;
  contextWindow: number;
}

/** Todo item emitted by Claude's TodoWrite tool. */
export interface TodoItem {
  content: string;
  status: string;
}

