import { randomUUID } from "node:crypto";

import {
  buildUserMessageContent,
  type AttachmentPayload,
  type UsageSummary,
} from "@claude-agent-kit/messages";
import type {
  ClaudeConfig,
  SessionConfig,
  IClaudeAgentSDKClient,
  ISessionClient,
  OutcomingMessage,
  SessionStateUpdate,
  SessionStateSnapshot,
  SessionSDKOptions,
} from "../types";
import type {
  SDKMessage,
  SDKSystemMessage,
  SDKUserMessage,
  Options as SDKOptions,
} from "@anthropic-ai/claude-agent-sdk";

const DEFAULT_ALLOWED_TOOLS: readonly string[] = [
  "Task",
  "Bash",
  "Glob",
  "Grep",
  "LS",
  "ExitPlanMode",
  "Read",
  "Edit",
  "MultiEdit",
  "Write",
  "NotebookEdit",
  "WebFetch",
  "TodoWrite",
  "WebSearch",
  "BashOutput",
  "KillBash",
];

const DEFAULT_SESSION_OPTIONS: SessionSDKOptions = {
  maxTurns: 100,
  allowedTools: [...DEFAULT_ALLOWED_TOOLS],
  mcpServers: {},
  hooks: {},
  thinkingLevel: "default_on",
};

function normalizeWorkspacePath(value?: string | null): string | undefined {
  const trimmed = typeof value === "string" ? value.trim() : undefined;
  return trimmed ? trimmed : undefined;
}

function createDefaultOptions(workspacePath?: string | null): SessionSDKOptions {
  const cwd = normalizeWorkspacePath(workspacePath);
  return {
    ...DEFAULT_SESSION_OPTIONS,
    allowedTools: DEFAULT_SESSION_OPTIONS.allowedTools
      ? [...DEFAULT_SESSION_OPTIONS.allowedTools]
      : undefined,
    mcpServers: {
      ...(DEFAULT_SESSION_OPTIONS.mcpServers ?? {}),
    },
    hooks: {
      ...(DEFAULT_SESSION_OPTIONS.hooks ?? {}),
    },
    ...(cwd ? { cwd } : {}),
  };
}


export class Session {
  sessionId: string | null = null; // Claude session ID
  options: SessionSDKOptions = createDefaultOptions();
  usageSummary: UsageSummary | undefined;
  claudeConfig: ClaudeConfig | undefined;
  modelSelection: string | undefined;
  config: SessionConfig | undefined;
  lastModifiedTime = Date.now();
  summary: string | undefined;
  error: Error | string | undefined;

  private sdkClient: IClaudeAgentSDKClient;
  private queryPromise: Promise<void> | null = null;
  private loadingPromise: Promise<void> | null = null;
  private abortController: AbortController | undefined = undefined;
  private busyState: boolean = false;
  private loadingState: boolean = false;
  private messageList: SDKMessage[] = [];
  private isLoaded = false;
  private clients: Set<ISessionClient> = new Set();

  constructor(sdkClient: IClaudeAgentSDKClient) {
    this.sdkClient = sdkClient;
  }

  get isBusy(): boolean {
    return this.busyState;
  }

  private setBusyState(state: boolean): void {
    if (this.busyState === state) {
      return;
    }
    this.busyState = state;
    this.emitSessionStateChange({ isBusy: state });
  }

  get isLoading(): boolean {
    return this.loadingState;
  }

  private setLoadingState(state: boolean): void {
    if (this.loadingState === state) {
      return;
    }
    this.loadingState = state;
    this.emitSessionStateChange({ isLoading: state });
  }

  setSDKOptions(
    options: Partial<SessionSDKOptions>,
  ): void {
    const hasExplicitCwd = Object.prototype.hasOwnProperty.call(options, "cwd");
    const normalizedCwd = hasExplicitCwd ? normalizeWorkspacePath(options.cwd ?? undefined) : undefined;

    const normalized: Partial<SessionSDKOptions> = {
      ...options,
      ...(hasExplicitCwd ? { cwd: normalizedCwd } : {}),
    };

    const baseOptions = createDefaultOptions(hasExplicitCwd ? normalizedCwd : this.options.cwd);
    const nextOptions: SessionSDKOptions = {
      ...baseOptions,
      ...this.options,
      ...normalized,
    };

    if (hasExplicitCwd && !normalizedCwd) {
      delete (nextOptions as Record<string, unknown>).cwd;
    }

    this.options = nextOptions;
    this.emitSessionStateChange({ options: this.buildEffectiveOptions() });
  }

  private buildEffectiveOptions(): SessionSDKOptions {
    return {
      ...createDefaultOptions(this.options.cwd),
      ...this.options,
    };
  }

  get messages(): SDKMessage[] {
    return this.messageList;
  }

  findWorkspacePathFromMessages(messages: SDKMessage[]): string | undefined {
    const cwdMessage = messages.find(msg => (msg as SDKSystemMessage).cwd) as SDKSystemMessage | undefined;
    return cwdMessage?.cwd || undefined;
  }

  private setMessages(messages: SDKMessage[]): void {
    this.messageList = messages;

    if (!this.options.cwd) {
      const detectedWorkspace = this.findWorkspacePathFromMessages(messages);
      if (detectedWorkspace) {
        this.setSDKOptions({ cwd: detectedWorkspace });
      }
    }

    console.log(
      `[Session] setMessages for ${this.sessionId ?? "pending"} count=${messages.length} (wasLoaded=${this.isLoaded})`,
    );
    this.notifyClients("messagesUpdated", {
      type: "messages_updated",
      sessionId: this.sessionId,
      messages,
    });
  }

  private syncClientSessionIds(): void {
    const sessionId = this.sessionId ?? undefined;
    this.clients.forEach((client) => {
      client.sessionId = sessionId;
    });
  }

  private updateSessionId(sessionId: string | null | undefined): void {
    const normalized = sessionId ?? null;
    if (this.sessionId === normalized) {
      return;
    }
    this.sessionId = normalized;
    this.syncClientSessionIds();
  }

  interrupt(): void {
    this.abortController?.abort();
    this.setBusyState(false);
  }


  // Subscribe a WebSocket client to this session
  subscribe(client: ISessionClient) {
    if (this.clients.has(client)) {
      return;
    }
    this.clients.add(client);
    client.sessionId = this.sessionId ?? undefined;
    const sessionState = this.getSessionStateSnapshot();
    console.log(
      `[Session] Client subscribed to ${this.sessionId ?? "uninitialized"} (messages=${this.messageList.length}, loaded=${this.isLoaded})`,
    );
    client.receiveSessionMessage(
      "sessionStateChanged",
      this.createSessionStateMessage(sessionState),
    );

    // When a client attaches to an already loaded session, immediately send the
    // current transcript so switching sessions always repopulates the UI.
    if (this.isLoaded) {
      client.receiveSessionMessage("messagesUpdated", {
        type: "messages_updated",
        sessionId: this.sessionId,
        messages: [...this.messageList],
      });
      console.log(`[Session] Sent cached transcript to client for ${this.sessionId}: ${this.messageList.length} messages`);
    }
  }

  unsubscribe(client: ISessionClient) {
    this.clients.delete(client);
  }

  hasClient(client: ISessionClient): boolean {
    return this.clients.has(client);
  }

  notifyClients(event: string, message: OutcomingMessage) {
    this.clients.forEach((client: ISessionClient) => {
      if (!client) {
        return;
      }
      client.receiveSessionMessage(event, message);
    });
  }

  addNewMessage(message: SDKMessage): void {
    this.messageList.push(message);
    this.notifyClients("messageAdded", {
      type: "message_added",
      sessionId: this.sessionId,
      message,
    });
  }

  loadFromServer(sessionId?: string): Promise<void> | undefined {
    const targetSessionId = sessionId ?? this.sessionId ?? undefined;
    if (!targetSessionId) {
      return undefined;
    }

    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.updateSessionId(targetSessionId);
    this.setLoadingState(true);
    this.error = undefined;

    this.loadingPromise = (async () => {
      try {
        const { messages } = await this.sdkClient.loadMessages(targetSessionId);
        console.log(`[Session] loadFromServer(${targetSessionId}) returned ${messages.length} messages`);
        if (messages.length === 0) {
          this.setMessages([]);
          this.summary = undefined;
          this.lastModifiedTime = Date.now();
          this.setBusyState(false);
          return;
        }

        this.summary = undefined;
        this.setMessages(messages);
        this.setBusyState(false);
        this.isLoaded = true;
      } catch (error) {
        console.error(`Failed to load session '${targetSessionId}':`, error);
        this.error = error instanceof Error ? error : String(error);
      } finally {
        this.setLoadingState(false);
        this.loadingPromise = null;
        console.log(`[Session] Finished loading ${targetSessionId}`);
      }
    })();

    return this.loadingPromise;
  }

  async resumeFrom(sessionId: string): Promise<void> {
    if (!sessionId) {
      return;
    }

    console.log(
      `[Session] resumeFrom ${sessionId} (current=${this.sessionId ?? "none"}, loaded=${this.isLoaded})`,
    );

    if (this.sessionId === sessionId && this.isLoaded) {
      console.log(`[Session] resumeFrom short-circuited for ${sessionId} (already loaded)`);
      return;
    }

    await this.loadFromServer(sessionId);
    console.log(`[Session] resumeFrom finished loading ${sessionId}`);
  }

  // Process a single user message
  async send(
    prompt: string,
    attachments: AttachmentPayload[] | undefined
  ): Promise<void> {
    if (this.queryPromise) {
      // Queue is busy, wait for it
      await this.queryPromise;
    }

    // Build the synthetic user message that will kick off the stream.
    const userMessage: SDKUserMessage = {
      type: "user",
      uuid: randomUUID(),
      session_id: "",
      parent_tool_use_id: null,
      message: {
        role: "user",
        content: buildUserMessageContent(prompt, attachments),
      },
    };
    this.abortController = new AbortController();

    async function* generateMessages() {
      yield userMessage;
    }

    this.addNewMessage(userMessage);

    // Seed the session summary with the user's first prompt if needed.
    if (!this.summary) {
      this.summary = prompt;
    }

    this.lastModifiedTime = Date.now();
    this.setBusyState(true);

    this.queryPromise = (async () => {
      try {
        const { thinkingLevel: _thinkingLevel, ...effectiveOptions } = this.buildEffectiveOptions();
        const options: SDKOptions = {
          ...effectiveOptions,
          abortController: this.abortController,
        };

        // Use resume for multi-turn, continue for first message
        if (this.sessionId) {
          options.resume = this.sessionId;
        }


        for await (const message of this.sdkClient.queryStream(
          generateMessages(),
          options
        )) {
          console.log(message);
          this.processIncomingMessage(message);
        }
      } catch (error) {
        console.error(`Error in session ${this.sessionId}:`, error);
        this.error = error instanceof Error ? error : String(error);
      } finally {
        this.queryPromise = null;
        this.setBusyState(false);
      }
    })();

    await this.queryPromise;
    this.lastModifiedTime = Date.now();
  }


  processIncomingMessage(message: SDKMessage): void {
    console.log("Received message:", message);

    if (message.session_id) {
      this.updateSessionId(message.session_id);
    }

    this.addNewMessage(message);

    const rawTimestamp = (message as { timestamp?: unknown }).timestamp;
    const extracted = extractTimestamp(rawTimestamp);
    this.lastModifiedTime = extracted ?? Date.now();

    // Update high level state derived from system/result messages.
    if (message.type === "system") {
      if (message.subtype === "init") {
        this.setBusyState(true);
      }
    } else if (message.type === "result") {
      this.setBusyState(false);
    }
  }
  private getSessionStateSnapshot(): SessionStateSnapshot {
    return {
      isBusy: this.busyState,
      isLoading: this.loadingState,
      options: this.buildEffectiveOptions(),
    };
  }

  private createSessionStateMessage(update: SessionStateUpdate): OutcomingMessage {
    return {
      type: "session_state_changed",
      sessionId: this.sessionId,
      sessionState: update,
    };
  }

  private emitSessionStateChange(update: SessionStateUpdate): void {
    if (!update || Object.keys(update).length === 0) {
      return;
    }
    // TODO: debounce
    this.notifyClients("sessionStateChanged", this.createSessionStateMessage(update));
  }
}

function extractTimestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }

    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
}
