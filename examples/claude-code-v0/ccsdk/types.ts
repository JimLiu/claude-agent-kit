import type { ServerWebSocket } from "bun";
import type { SDKUserMessage, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { AttachmentPayload } from "../shared/types/messages";

// WebSocket client type
export type WSClient = ServerWebSocket<{ sessionId: string }>;

// Message types for WebSocket communication
export interface ChatMessage {
  type: "chat";
  content: string;
  sessionId?: string;
  newConversation?: boolean;
  attachments?: AttachmentPayload[];
}

export interface SubscribeMessage {
  type: "subscribe";
  sessionId: string;
}

export interface UnsubscribeMessage {
  type: "unsubscribe";
  sessionId: string;
}

export interface RequestInboxMessage {
  type: "request_inbox";
}

export type IncomingMessage = ChatMessage | SubscribeMessage | UnsubscribeMessage | RequestInboxMessage;

// Re-export SDK types for convenience
export type { SDKUserMessage, SDKMessage };
