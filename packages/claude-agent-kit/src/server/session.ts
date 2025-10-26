import { randomUUID } from "node:crypto";

import { buildUserMessageContent } from "../messages/build-user-message-content";
import type { 
  AttachmentPayload,
  ClaudeConfig, 
  PermissionMode, 
  SDKMessage, 
  SDKOptions, 
  SDKUserMessage, 
  SessionConfig, 
  ThinkingLevel, 
  UsageSummary,
  IClaudeAgentSDKClient,
  ISessionClient,
  OutcomingMessage
} from "../types";


export class Session {
  sessionId: string | null = null; // Claude session ID
  permissionMode: PermissionMode = "default";
  workspacePath: string | null = null;
  usageSummary: UsageSummary | undefined;
  claudeConfig: ClaudeConfig | undefined;
  modelSelection: string | undefined;
  config: SessionConfig | undefined;
  thinkingLevel: ThinkingLevel = "default_on";
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
    this.notifyClients("busyStateChanged", {
      type: "busy_state_changed",
      sessionId: this.sessionId,
      isBusy: state,
    });
  }

  get isLoading(): boolean {
    return this.loadingState;
  }

  private setLoadingState(state: boolean): void {
    if (this.loadingState === state) {
      return;
    }
    this.loadingState = state;
    this.notifyClients("loadingStateChanged", {
      type: "loading_state_changed",
      sessionId: this.sessionId,
      isLoading: state,
    });
  }

  setPermissionMode(mode: PermissionMode, persist?: boolean): void {
    this.permissionMode = mode;

    if (persist) {
      // Implementation for persisting the permission mode
    }
  }

  setThinkingLevel(value: ThinkingLevel): void {
    this.thinkingLevel = value;
  }

  get messages(): SDKMessage[] {
    return this.messageList;
  }

  private setMessages(messages: SDKMessage[]): void {
    this.messageList = messages;
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
  }

  unsubscribe(client: ISessionClient) {
    this.clients.delete(client);
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
      }
    })();

    return this.loadingPromise;
  }

  async resumeFrom(sessionId: string): Promise<void> {
    if (!sessionId) {
      return;
    }

    if (this.sessionId === sessionId && this.isLoaded) {
      return;
    }

    await this.loadFromServer(sessionId);
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
        const options: Partial<SDKOptions> = {
          abortController: this.abortController,
          cwd: this.workspacePath || undefined,
          permissionMode: this.permissionMode,
          // thinkingLevel: this.thinkingLevel, // @TODO
        };

        // Use resume for multi-turn, continue for first message
        if (this.sessionId) {
          options.resume = this.sessionId;
        }


        for await (const message of this.sdkClient.queryStream(
          generateMessages(),
          options
        )) {
          //console.log(message);
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
