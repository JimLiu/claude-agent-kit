import { query } from "@anthropic-ai/claude-agent-sdk";
import type { 
  IClaudeAgentSDKClient, 
  PermissionMode, 
  SDKMessage, 
  SDKOptions, 
  SDKUserMessage 
} from "../types";
import { 
  getProjectsRoot, 
  locateSessionFile, 
  normalizeSessionId, 
  readSessionMessages as readSessionMessagesFromDisk 
} from "../utils/session-files";
// import { AGENT_PROMPT } from "./agent-prompt";

export { parseSessionMessagesFromJsonl, readSessionMessages } from "../utils/session-files";

export class SimpleClaudeAgentSDKClient implements IClaudeAgentSDKClient {
  private defaultOptions: SDKOptions;

  constructor(options?: Partial<SDKOptions>) {
    const workspacePath = process.cwd();
    this.defaultOptions = {
      maxTurns: 100,
      cwd: workspacePath,
      // model: "opus",
      allowedTools: [
        "Task", "Bash", "Glob", "Grep", "LS", "ExitPlanMode", "Read", "Edit", "MultiEdit", "Write", "NotebookEdit",
        "WebFetch", "TodoWrite", "WebSearch", "BashOutput", "KillBash",
      ],
      // systemPrompt: AGENT_PROMPT,
      mcpServers: {
      },
      hooks: {
      },
      ...options
    };
  }

  setPermissionMode(mode: PermissionMode) {
    this.defaultOptions.permissionMode = mode;
    return Promise.resolve(true);
  }

  async *queryStream(
    prompt: string | AsyncIterable<SDKUserMessage>,
    options?: Partial<SDKOptions>
  ): AsyncIterable<SDKMessage> {
    const mergedOptions = { ...this.defaultOptions, ...options };

    for await (const message of query({
      prompt,
      options: mergedOptions
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
        cwd: this.defaultOptions.cwd,
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
