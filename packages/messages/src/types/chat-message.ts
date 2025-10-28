import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { ToolResultContentBlock, MessageContentBlock } from "./messages";
import type { ChatMessageType } from "./sdk";

export interface ChatMessagePart {
  toolResult: ToolResultContentBlock | undefined;
  content: MessageContentBlock;
}

export interface ChatMessage {
  id: string;
  type: ChatMessageType;
  content: ChatMessagePart[];
  timestamp: number;
  raw?: SDKMessage;
}