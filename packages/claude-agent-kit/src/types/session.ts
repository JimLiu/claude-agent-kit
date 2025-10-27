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
  | "session_state_changed";

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

export type SessionStateSnapshot = {
  isBusy: boolean;
  isLoading: boolean;
  permissionMode: PermissionMode;
  thinkingLevel: ThinkingLevel;
};

export type SessionStateUpdate = Partial<SessionStateSnapshot>;

export interface SessionStateChangedOutcomingMessage extends BaseOutcomingMessage {
  type: "session_state_changed";
  sessionState: SessionStateUpdate;
}

export type OutcomingMessage =
  | MessageAddedOutcomingMessage
  | MessagesUpdatedOutcomingMessage
  | SessionStateChangedOutcomingMessage;


interface BaseIncomingMessage {
  type: "chat" | "setPermissionMode" | "setThinkingLevel" | "resume";
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

export interface ResumeSessionIncomingMessage extends BaseIncomingMessage {
  type: "resume";
  sessionId: string;
}

export type IncomingMessage =
  | ChatIncomingMessage
  | SetPermissionModeIncomingMessage
  | SetThinkingLevelIncomingMessage
  | ResumeSessionIncomingMessage;
