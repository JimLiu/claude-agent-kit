import { HookJSONOutput, query } from "@anthropic-ai/claude-agent-sdk";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Dirent } from "node:fs";
import type { IClaudeAgentSDKClient, SDKMessage, SDKOptions, SDKUserMessage } from "./types";
import { AGENT_PROMPT } from "./agent-prompt";

const SESSION_FILE_EXTENSION = ".jsonl";

export function parseSessionMessagesFromJsonl(fileContent: string): SDKMessage[] {
  if (!fileContent) {
    return [];
  }

  const lines = fileContent.split(/\r?\n/);
  const messages: SDKMessage[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (trimmed.length === 0) {
      continue;
    }

    try {
      const parsed = JSON.parse(trimmed);
      const message = normalizeSessionLogEntry(parsed);
      if (message) {
        messages.push(message);
      }
    } catch {
      continue;
    }
  }

  return messages;
}

export class ClaudeAgentSDKClient implements IClaudeAgentSDKClient {
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

  async getSession(sessionId: string | undefined): Promise<{ messages: SDKMessage[] }> {
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
      const messages = await readSessionMessages(filePath);
      return { messages };
    } catch (error) {
      console.error(`Failed to read session file '${filePath}':`, error);
      return { messages: [] };
    }
  }
}

interface LocateSessionFileParams {
  projectsRoot: string;
  sessionId: string;
  cwd?: string;
}

async function locateSessionFile(params: LocateSessionFileParams): Promise<string | null> {
  const { projectsRoot, sessionId, cwd } = params;

  const orderedProjectDirs = await collectCandidateProjectDirs(projectsRoot, cwd);

  for (const projectDir of orderedProjectDirs) {
    const sessionPath = path.join(projectDir, `${sessionId}${SESSION_FILE_EXTENSION}`);
    try {
      await fs.access(sessionPath);
      return sessionPath;
    } catch (error) {
      if (isNotFoundError(error)) {
        continue;
      }
    }
  }

  return null;
}

async function collectCandidateProjectDirs(projectsRoot: string, cwd?: string): Promise<string[]> {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(projectsRoot, { withFileTypes: true });
  } catch (error) {
    if (isNotFoundError(error)) {
      return [];
    }
    throw error;
  }

  const directories = entries.filter((entry) => entry.isDirectory());
  const candidates: string[] = [];
  const seen = new Set<string>();

  if (cwd) {
    const sanitized = sanitizeProjectId(cwd);
    for (const entry of directories) {
      if (!entry.name.startsWith(sanitized)) {
        continue;
      }
      const fullPath = path.join(projectsRoot, entry.name);
      if (seen.has(fullPath)) {
        continue;
      }
      candidates.push(fullPath);
      seen.add(fullPath);
    }
  }

  for (const entry of directories) {
    const fullPath = path.join(projectsRoot, entry.name);
    if (seen.has(fullPath)) {
      continue;
    }
    candidates.push(fullPath);
    seen.add(fullPath);
  }

  return candidates;
}

export async function readSessionMessages(filePath: string): Promise<SDKMessage[]> {
  let fileContent: string;
  try {
    fileContent = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (isNotFoundError(error)) {
      return [];
    }
    throw error;
  }

  if (!fileContent) {
    return [];
  }

  return parseSessionMessagesFromJsonl(fileContent);
}

function normalizeSessionLogEntry(entry: unknown): SDKMessage | null {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const record = entry as Record<string, unknown>;
  const rawType = record.type;
  if (typeof rawType !== "string") {
    return null;
  }

  if (rawType.toLowerCase() === "summary") {
    return null;
  }

  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (key === "sessionId") {
      normalized["session_id"] = value;
      continue;
    }
    normalized[key] = value;
  }

  if (!("message" in normalized)) {
    return null;
  }

  const messageValue = normalized["message"];
  if (
    typeof messageValue !== "string" &&
    (typeof messageValue !== "object" || messageValue === null)
  ) {
    return null;
  }

  if (isSummaryMessage(messageValue)) {
    return null;
  }

  normalized["type"] = rawType;

  return normalized as SDKMessage;
}

function isSummaryMessage(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  const rawType = record.type;
  if (typeof rawType === "string" && rawType.toLowerCase() === "summary") {
    return true;
  }

  return false;
}

function getProjectsRoot(): string | null {
  const bunHome = (globalThis as { Bun?: { env?: Record<string, string | undefined> } }).Bun?.env?.HOME;
  const processHome = typeof process !== "undefined" ? process.env?.HOME ?? process.env?.USERPROFILE : undefined;
  const homeDir = bunHome ?? processHome;

  if (!homeDir) {
    return null;
  }

  return path.join(homeDir, ".claude", "projects");
}

function normalizeSessionId(value: string): string {
  return value.toLowerCase().endsWith(SESSION_FILE_EXTENSION)
    ? value.slice(0, -SESSION_FILE_EXTENSION.length)
    : value;
}

function sanitizeProjectId(cwd: string): string {
  const replaced = cwd.replace(/[:\\/]+/g, "-").replace(/\//g, "-");
  return replaced.startsWith("-") ? replaced : `-${replaced}`;
}

function isNotFoundError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "ENOENT"
  );
}
