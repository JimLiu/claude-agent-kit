import type { PermissionMode, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { IClaudeAgentSDKClient } from "./client";
import type { AttachmentPayload } from "./messages";

export type ThinkingLevel = "off" | "default_on";

export interface ClaudeModelOption {
  value: string;
  displayName: string;
  description?: string;
}

export interface ClaudeConfig {
  models?: ClaudeModelOption[];
}

export interface SessionConfig {
  modelSetting?: string;
}

export interface ISessionClient {
  sessionId: string | undefined;
  sdkClient: IClaudeAgentSDKClient;
  receiveSessionMessage(event: string, message: OutcomingMessage): void;
}


export type OutcomingMessageType =
  | "message_added"
  | "messages_updated"
  | "loading_state_changed"
  | "busy_state_changed";

export interface BaseOutcomingMessage {
  type: OutcomingMessageType;
  sessionId: string | null;
}

export interface MessageAddedOutcomingMessage extends BaseOutcomingMessage {
  type: "message_added";
  message: SDKMessage;
}


export interface MessagesUpdatedOutcomingMessage extends BaseOutcomingMessage {
  type: "messages_updated";
  messages: SDKMessage[];
}

export interface LoadingStateChangedOutcomingMessage extends BaseOutcomingMessage {
  type: "loading_state_changed";
  isLoading: boolean;
}

export interface BusyStateChangedOutcomingMessage extends BaseOutcomingMessage {
  type: "busy_state_changed";
  isBusy: boolean;
}

export type OutcomingMessage =
  | MessageAddedOutcomingMessage
  | MessagesUpdatedOutcomingMessage
  | LoadingStateChangedOutcomingMessage
  | BusyStateChangedOutcomingMessage;


interface BaseIncomingMessage {
  type: "chat" | "setPermissionMode" | "setThinkingLevel";
  sessionId?: string | null;
}

export interface ChatIncomingMessage extends BaseIncomingMessage {
  type: "chat";
  content: string;
  attachments?: AttachmentPayload[];
  newConversation?: boolean;
}

export interface SetPermissionModeIncomingMessage extends BaseIncomingMessage {
  type: "setPermissionMode";
  mode: PermissionMode;
}

export interface SetThinkingLevelIncomingMessage extends BaseIncomingMessage {
  type: "setThinkingLevel";
  value: ThinkingLevel;
}

export type IncomingMessage =
  | ChatIncomingMessage
  | SetPermissionModeIncomingMessage
  | SetThinkingLevelIncomingMessage;
