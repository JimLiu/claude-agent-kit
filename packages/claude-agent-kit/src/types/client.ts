import type { 
  SDKMessage, 
  SDKUserMessage,
  Options as SDKOptions,
} from "@anthropic-ai/claude-agent-sdk";

export interface IClaudeAgentSDKClient {

  queryStream(
    prompt: string | AsyncIterable<SDKUserMessage>,
    options?: Partial<SDKOptions>
  ): AsyncIterable<SDKMessage>;
  

  loadMessages(sessionId: string): Promise<{ messages: SDKMessage[] }>;
}
