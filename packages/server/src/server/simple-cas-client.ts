import { query } from "@anthropic-ai/claude-agent-sdk";
import type {
  Options as SDKOptions,
  SDKMessage,
  SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import type { IClaudeAgentSDKClient } from "../types";
import { 
  getProjectsRoot, 
  locateSessionFile, 
  normalizeSessionId, 
  readSessionMessages as readSessionMessagesFromDisk 
} from "../utils/session-files";
// import { AGENT_PROMPT } from "./agent-prompt";

export { parseSessionMessagesFromJsonl, readSessionMessages } from "../utils/session-files";

export class SimpleClaudeAgentSDKClient implements IClaudeAgentSDKClient {

  constructor() {
  }

  async *queryStream(
    prompt: string | AsyncIterable<SDKUserMessage>,
    options?: Partial<SDKOptions>
  ): AsyncIterable<SDKMessage> {

    for await (const message of query({
      prompt,
      options
    })) {
      yield message;
    }
  }

  async loadMessages(sessionId: string | undefined): Promise<{ messages: SDKMessage[] }> {
    if (!sessionId) {
      return { messages: [] };
    }

    const projectsRoot = getProjectsRoot();
    if (!projectsRoot) {
      return { messages: [] };
    }

    const normalizedSessionId = normalizeSessionId(sessionId);

    let filePath: string | null;
    try {
      filePath = await locateSessionFile({
        projectsRoot,
        sessionId: normalizedSessionId,
      });
    } catch (error) {
      console.error(`Failed to locate session '${normalizedSessionId}':`, error);
      return { messages: [] };
    }

    if (!filePath) {
      return { messages: [] };
    }

    try {
      const messages = await readSessionMessagesFromDisk(filePath);
      return { messages };
    } catch (error) {
      console.error(`Failed to read session file '${filePath}':`, error);
      return { messages: [] };
    }
  }
}
