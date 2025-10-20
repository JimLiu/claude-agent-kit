import { query } from "@anthropic-ai/claude-agent-sdk";
import type { HookJSONOutput } from "@anthropic-ai/claude-agent-sdk";
import * as path from "path";
import { AGENT_PROMPT } from "./agent-prompt";
import type { SDKMessage, SDKUserMessage } from "./types";
import {
  type AttachmentPayload,
  type ContentBlock,
} from "../shared/types/messages";
import { composeUserContent } from "./messages";
import {
  ensureSessionWorkspace,
  getSessionWorkspacePath,
} from "./utils/session-workspace";

export interface AIQueryOptions {
  maxTurns?: number;
  cwd?: string;
  model?: string;
  allowedTools?: string[];
  systemPrompt?: string;
  mcpServers?: any;
  hooks?: any;
  resume?: string;
}

export class AIClient {
  private defaultOptions: AIQueryOptions;
  private readonly sessionId: string | null;
  private readonly workspaceReady: Promise<string> | null;

  constructor(sessionId?: string, options?: Partial<AIQueryOptions>) {
    this.sessionId = sessionId ?? null;

    const workspacePath = this.sessionId
      ? getSessionWorkspacePath(this.sessionId)
      : process.cwd();

    this.workspaceReady = this.sessionId
      ? ensureSessionWorkspace(this.sessionId)
      : null;

    this.defaultOptions = {
      maxTurns: 100,
      cwd: workspacePath,
      // model: "opus",
      allowedTools: [
        "Task", "Bash", "Glob", "Grep", "LS", "ExitPlanMode", "Read", "Edit", "MultiEdit", "Write", "NotebookEdit",
        "WebFetch", "TodoWrite", "WebSearch", "BashOutput", "KillBash",
      ],
      // appendSystemPrompt: AGENT_PROMPT,
      systemPrompt: AGENT_PROMPT,
      mcpServers: {
      },
      hooks: {
        PreToolUse: [
          {
            matcher: "Write|Edit|MultiEdit",
            hooks: [
              async (input: any): Promise<HookJSONOutput> => {
                const toolName = input.tool_name;
                const toolInput = input.tool_input;

                if (!['Write', 'Edit', 'MultiEdit'].includes(toolName)) {
                  return { continue: true };
                }

                let filePath = '';
                if (toolName === 'Write' || toolName === 'Edit') {
                  filePath = toolInput.file_path || '';
                } else if (toolName === 'MultiEdit') {
                  filePath = toolInput.file_path || '';
                }

                const ext = path.extname(filePath).toLowerCase();
                if (ext === '.js' || ext === '.ts') {
                  const customScriptsPath = path.join(process.cwd(), 'agent', 'custom_scripts');

                  if (!filePath.startsWith(customScriptsPath)) {
                    return {
                      decision: 'block',
                      stopReason: `Script files (.js and .ts) must be written to the custom_scripts directory. Please use the path: ${customScriptsPath}/${path.basename(filePath)}`,
                      continue: false
                    };
                  }
                }

                return { continue: true };
              }
            ]
          }
        ]
      },
      ...options
    };
  }

  async *queryStream(
    prompt:
      | string
      | AsyncIterable<SDKUserMessage>
      | {
          user:
            | {
                text: string;
                attachments?: AttachmentPayload[];
                sessionId?: string;
              }
            | {
                content: ContentBlock[];
                sessionId?: string;
              };
        },
    options?: Partial<AIQueryOptions>,
  ): AsyncIterable<SDKMessage> {
    if (this.workspaceReady) {
      await this.workspaceReady;
    }

    const mergedOptions = { ...this.defaultOptions, ...options };

    console.log("AIClient queryStream options:", mergedOptions);

    const promptSource = this.resolvePrompt(prompt);

    for await (const message of query({
      prompt: promptSource,
      options: mergedOptions,
    })) {
      console.log("AIClient queryStream message:", message);
      yield message;
    }
  }

  async querySingle(prompt: string, options?: Partial<AIQueryOptions>): Promise<{
    messages: SDKMessage[];
    cost: number;
    duration: number;
  }> {
    const messages: SDKMessage[] = [];
    let totalCost = 0;
    let duration = 0;

    for await (const message of this.queryStream(prompt, options)) {
      messages.push(message);

      if (message.type === "result" && message.subtype === "success") {
        totalCost = message.total_cost_usd;
        duration = message.duration_ms;
      }
    }

    return { messages, cost: totalCost, duration };
  }

  private resolvePrompt(
    prompt:
      | string
      | AsyncIterable<SDKUserMessage>
      | {
          user:
            | {
                text: string;
                attachments?: AttachmentPayload[];
                sessionId?: string;
              }
            | {
                content: ContentBlock[];
                sessionId?: string;
              };
        },
  ): string | AsyncIterable<SDKUserMessage> {
    if (typeof prompt === "string") {
      return prompt;
    }

    if (isAsyncIterable(prompt)) {
      return prompt;
    }

    if ("user" in prompt) {
      const { user } = prompt;
      const sessionId = user.sessionId;

      let content: ContentBlock[];
      if ("content" in user) {
        content = user.content;
      } else {
        content = composeUserContent(user.text, user.attachments);
      }

      return createUserMessageGenerator(content, sessionId);
    }

    throw new Error("Unsupported prompt type for AIClient.queryStream");
  }
}

const isAsyncIterable = (
  value: unknown,
): value is AsyncIterable<SDKUserMessage> => {
  return Boolean(
    value &&
      typeof value === "object" &&
      Symbol.asyncIterator in (value as AsyncIterable<SDKUserMessage>),
  );
};

const createUserMessageGenerator = (
  content: ContentBlock[],
  sessionId?: string,
): AsyncIterable<SDKUserMessage> => {
  return (async function* generateMessages() {
    const message = {
      type: "user",
      parent_tool_use_id: null,
      message: {
        role: "user",
        content,
      },
    } as SDKUserMessage;

    if (sessionId) {
      message.session_id = sessionId;
    }

    yield message;
  })();
};
