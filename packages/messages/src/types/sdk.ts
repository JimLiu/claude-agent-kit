import type {
  SDKMessage,
  SDKUserMessage,
  SDKAssistantMessage,
  SDKResultMessage,
  Options as SDKOptions,
  PermissionMode
} from "@anthropic-ai/claude-agent-sdk";

export type { 
  SDKUserMessage, 
  SDKMessage, 
  SDKAssistantMessage, 
  SDKResultMessage, 
  SDKOptions,
  PermissionMode
};

export type ChatMessageType = SDKMessage['type'];
