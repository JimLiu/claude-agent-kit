import { PermissionMode } from "@anthropic-ai/claude-agent-sdk";
import { nanoid } from "nanoid";
import { randomUUID } from "node:crypto";
import {
  SDKMessage,
  SDKUserMessage,
  SDKAssistantMessage,
  SDKResultMessage,
  TodoItem,
  UsageSummary,
  IClaudeAgentSDKClient,
  AttachmentPayload,
  ToolResultContentBlock,
} from "./types";

import {
  appendRenderableMessage,
  AppendRenderableMessageResult,
  buildUserMessageContent,
  ChatMessage,
  coalesceReadMessages,
} from "./chat-message";
import { ClaudeAgentSDKClient } from "./cas-client";

export type BroadcastMessageType =
  | "session_info"
  | "messages_loaded"
  | "usage_updated"
  | "message_added"
  | "message_updated"
  | "message_removed"
  | "todos_updated"
  | "tools_updated"
  | "tool_result_updated";

export interface BaseBroadcastMessage {
  type: BroadcastMessageType;
  sessionId: string | null;
}

export interface SessionInfoBroadcastMessage extends BaseBroadcastMessage {
  type: "session_info";
  messageCount: number;
  isActive: boolean;
}

export interface UsageUpdateBroadcastMessage extends BaseBroadcastMessage {
  type: "usage_updated";
  usage: UsageSummary;
}

export interface TodosUpdateBroadcastMessage extends BaseBroadcastMessage {
  type: "todos_updated";
  todos: TodoItem[];
}

export interface ToolsUpdateBroadcastMessage extends BaseBroadcastMessage {
  type: "tools_updated";
  tools: string[];
}

export interface MessageAddedBroadcastMessage extends BaseBroadcastMessage {
  type: "message_added";
  message: ChatMessage;
}

export interface MessageUpdatedBroadcastMessage extends BaseBroadcastMessage {
  type: "message_updated";
  message: ChatMessage;
}

export interface MessageRemovedBroadcastMessage extends BaseBroadcastMessage {
  type: "message_removed";
  messageId: string;
}

export interface MessagesLoadedBroadcastMessage extends BaseBroadcastMessage {
  type: "messages_loaded";
  messages: ChatMessage[];
}

export interface ToolResultUpdatedBroadcastMessage extends BaseBroadcastMessage {
  type: "tool_result_updated";
  messageId: string;
  toolUseId: string;
  result: ToolResultContentBlock;
}

export type BroadcastMessage =
  | SessionInfoBroadcastMessage
  | MessagesLoadedBroadcastMessage
  | UsageUpdateBroadcastMessage
  | TodosUpdateBroadcastMessage
  | ToolsUpdateBroadcastMessage
  | MessageAddedBroadcastMessage
  | MessageUpdatedBroadcastMessage
  | MessageRemovedBroadcastMessage
  | ToolResultUpdatedBroadcastMessage;

export type SessionSubscriberCallback = (session: Session, message: BroadcastMessage, clientId: string) => void;

// Session class to manage a single Claude conversation
export class Session {
  public readonly _id: string;
  public messages: ChatMessage[] = [];
  private subscribers: Map<string, SessionSubscriberCallback> = new Map();
  private queryPromise: Promise<void> | null = null;
  private loadingPromise: Promise<void> | null = null;
  private messageCount = 0;
  private client: IClaudeAgentSDKClient;
  public claudeSessionId: string | null = null;
  public error: string | undefined;
  public busy = false;
  public isExplicit = false;
  public lastModifiedTime = Date.now();
  public permissionMode: PermissionMode = "default";
  public summary: string | undefined;
  public currentMainLoopModel: string | undefined;
  public todos: TodoItem[] = [];
  public tools: string[] = [];
  private _usageData: UsageSummary = {
    totalTokens: 0,
    totalCost: 0,
    contextWindow: 0,
  };
  public isLoading = false;
  private pendingTodosBroadcast = false;
  private pendingToolsBroadcast = false;

  constructor(client: IClaudeAgentSDKClient = new ClaudeAgentSDKClient()) {
    this._id = nanoid();
    this.client = client;
  }

  // Check if session has any subscribers
  hasSubscribers(): boolean {
    return this.subscribers.size > 0;
  }
  
  // Subscribe a WebSocket client to this session
  subscribe(clientId: string, callback: SessionSubscriberCallback) {
    const existing = this.subscribers.get(clientId);
    if (existing) {
      console.warn(`Client ${clientId} is already subscribed to session ${this.claudeSessionId}`);
      return;
    }

    this.subscribers.set(clientId, callback);

    // Send session info to new subscriber
    callback(
      this,
      {
        type: 'session_info',
        sessionId: this.claudeSessionId,
        messageCount: this.messageCount,
        isActive: this.queryPromise !== null
      },
      clientId
    );
  }

  // Unsubscribe a WebSocket client from this session
  unsubscribe(clientId: string) {
    this.subscribers.delete(clientId);
  }

  noticeSubscribers(message: BroadcastMessage) {
    for (const [clientId, callback] of this.subscribers) {
      callback(this, message, clientId);
    }
  }

  setMessages(messages: SDKMessage[]): void {
    const rendered: ChatMessage[] = [];
    // Process each historical SDK message before rendering.
    for (const message of messages) {
      // Keep session state in sync (todos, usage, etc.).
      this.processMessage(message);
      // Build renderable messages and connect tool_use/tool_result pairs.
      appendRenderableMessage(rendered, message);
    }

    // Merge consecutive Read tool invocations to keep the UI tidy.
    this.messages = coalesceReadMessages(rendered);
    this.messageCount = this.messages.length;
    this.emitMessagesLoaded();
    this.emitSessionInfo();

    if (!this.summary) {
      const summaryText = extractSummaryFromMessages(rendered);
      if (summaryText) {
        this.summary = summaryText;
      }
    }

    const lastTimestamp = extractLastMessageTimestamp(messages);
    if (lastTimestamp !== null) {
      this.lastModifiedTime = lastTimestamp;
    } else {
      this.lastModifiedTime = Date.now();
    }
  }

  get usageData(): UsageSummary {
    return this._usageData;
  }

  set usageData(value: UsageSummary) {
    this._usageData = value;

    this.noticeSubscribers({
      type: "usage_updated",
      sessionId: this.claudeSessionId,
      usage: this.usageData,
    });
  }

  loadFromServer(sessionId?: string): Promise<void> | undefined {
    const targetSessionId = sessionId ?? this.claudeSessionId ?? undefined;
    if (!targetSessionId) {
      return undefined;
    }

    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.claudeSessionId = targetSessionId;
    this.isLoading = true;
    this.error = undefined;

    this.loadingPromise = (async () => {
      try {
        const { messages } = await this.client.getSession(targetSessionId);
        if (messages.length === 0) {
          this.messages = [];
          this.messageCount = 0;
          this.summary = undefined;
          this.lastModifiedTime = Date.now();
          this.updateTodosState([]);
          this.updateToolsState([]);
          this.usageData = {
            totalTokens: 0,
            totalCost: 0,
            contextWindow: 0,
          };
          this.busy = false;
          this.isExplicit = false;
          this.emitMessagesLoaded();
          this.emitSessionInfo();
          return;
        }

        this.summary = undefined;
        this.updateTodosState([]);
        this.updateToolsState([]);
        this.usageData = {
          totalTokens: 0,
          totalCost: 0,
          contextWindow: 0,
        };
        this.setMessages(messages);
        this.busy = false;
        this.isExplicit = false;
      } catch (error) {
        console.error(`Failed to load session '${targetSessionId}':`, error);
        this.error = error instanceof Error ? error.message : String(error);
      } finally {
        this.isLoading = false;
        this.flushPendingStateUpdates();
        this.loadingPromise = null;
      }
    })();

    return this.loadingPromise;
  }

  resumeFrom(sessionId: string): Promise<void> | undefined {
    if (!sessionId) {
      return undefined;
    }
    return this.loadFromServer(sessionId);
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

    async function* generateMessages() {
      yield userMessage;
    }

    const pendingIndex = this.messageCount + 1;
    console.log(
      `Processing message ${pendingIndex} in session ${this.claudeSessionId}...`
    );

    const previousMessages = this.messages;
    const workingMessages = [...previousMessages];
    const appendResult = appendRenderableMessage(workingMessages, userMessage);
    const coalescedMessages = coalesceReadMessages(workingMessages);
    this.applyMessageUpdates(previousMessages, coalescedMessages, appendResult);

    // Seed the session summary with the user's first prompt if needed.
    if (!this.summary) {
      this.summary = prompt;
    }

    // Update session metadata flags before handing control to the stream.
    this.isExplicit = false;
    this.lastModifiedTime = Date.now();
    this.busy = true;

    this.queryPromise = (async () => {
      try {
        // Use resume for multi-turn, continue for first message
        const options = this.claudeSessionId
          ? { resume: this.claudeSessionId }
          : {};

        for await (const message of this.client.queryStream(
          generateMessages(),
          options
        )) {
          //console.log(message);
          this.processIncomingMessage(message);
        }
      } catch (error) {
        console.error(`Error in session ${this.claudeSessionId}:`, error);
        this.error = error instanceof Error ? error.message : String(error);
      } finally {
        this.queryPromise = null;
        this.emitSessionInfo();
      }
    })();

    await this.queryPromise;
    this.lastModifiedTime = Date.now();
  }

  /**
   * Handle an incoming SDK message from the streaming iterator.
   *
   * Steps:
   * 1. Update session state (todos, usage, tools, permission mode).
   * 2. Convert the SDK payload into renderable chat messages.
   * 3. Coalesce consecutive Read tool invocations for cleaner UI output.
   * 4. Broadcast message changes to subscribers.
   * 5. Adjust the busy flag based on lifecycle signals.
   */
  processIncomingMessage(message: SDKMessage): void {
    console.log("Received message:", message);
    this.processMessage(message);
    const previousMessages = this.messages;
    const workingMessages = [...previousMessages];
    const appendResult = appendRenderableMessage(workingMessages, message);
    const coalescedMessages = coalesceReadMessages(workingMessages);
    this.applyMessageUpdates(previousMessages, coalescedMessages, appendResult);

    const rawTimestamp = (message as { timestamp?: unknown }).timestamp;
    const extracted = extractTimestamp(rawTimestamp);
    this.lastModifiedTime = extracted ?? Date.now();

    this.claudeSessionId = message.session_id || this.claudeSessionId;

    // Update high level state derived from system/result messages.
    if (message.type === "system") {
      if (message.subtype === "init") {
        this.busy = true;
      }
    } else if (message.type === "result") {
      this.busy = false;
    }
  }

  private applyMessageUpdates(
    previousMessages: ChatMessage[],
    nextMessages: ChatMessage[],
    appendResult: AppendRenderableMessageResult
  ): void {
    this.messages = nextMessages;
    this.messageCount = nextMessages.length;

    const diff = diffMessages(previousMessages, nextMessages, appendResult.updatedMessages);
    const nextMap = buildMessageMap(nextMessages);

    for (const messageId of diff.removed) {
      this.noticeSubscribers({
        type: "message_removed",
        sessionId: this.claudeSessionId,
        messageId,
      });
    }

    for (const added of diff.added) {
      this.noticeSubscribers({
        type: "message_added",
        sessionId: this.claudeSessionId,
        message: added,
      });
    }

    for (const updated of diff.updated) {
      this.noticeSubscribers({
        type: "message_updated",
        sessionId: this.claudeSessionId,
        message: updated,
      });
    }

    for (const toolUpdate of appendResult.toolResultUpdates) {
      const message = nextMap.get(toolUpdate.message.id);
      if (!message) {
        continue;
      }
      this.noticeSubscribers({
        type: "tool_result_updated",
        sessionId: this.claudeSessionId,
        messageId: message.id,
        toolUseId: toolUpdate.toolUseId,
        result: toolUpdate.toolResult,
      });
    }

    this.emitSessionInfo();
  }

  private emitSessionInfo(): void {
    this.noticeSubscribers({
      type: "session_info",
      sessionId: this.claudeSessionId,
      messageCount: this.messageCount,
      isActive: this.queryPromise !== null,
    });
  }

  private emitMessagesLoaded(): void {
    this.noticeSubscribers({
      type: "messages_loaded",
      sessionId: this.claudeSessionId,
      messages: this.messages,
    });
  }

  /**
   * Handle the terminal result message and update cost/context metrics.
   */
  private handleResultMessage(message: SDKResultMessage): void {
    const usage = this.usageData;
    const modelName = this.currentMainLoopModel;
    const contextWindow =
      message.modelUsage?.[modelName || ""]?.contextWindow ??
      usage.contextWindow;

    this.usageData = {
      totalTokens: usage.totalTokens,
      totalCost: message.total_cost_usd,
      contextWindow,
    };
  }

  /**
   * Update session state derived from a raw SDK message.
   *
   * Key signals extracted per message type:
   * - assistant: todos, usage metadata, and tool state.
   * - system(init): model selection, tool list, and permission mode.
   * - result: aggregate cost and context window information.
   */
  private processMessage(message: SDKMessage): void {
    if (message.type === "assistant") {
      this.handleAssistantMessage(message);
    } else if (message.type === "system" && message.subtype === "init") {
      if (message.model) {
        this.currentMainLoopModel = message.model;
      }
      if (Array.isArray(message.tools)) {
        this.updateToolsState(message.tools);
      }
      if (message.permissionMode) {
        this.permissionMode = message.permissionMode;
      }
    } else if (
      message.type === "result" &&
      message.total_cost_usd !== undefined
    ) {
      this.handleResultMessage(message);
    }
  }

  /**
   * Handle assistant messages and extract actionable metadata.
   *
   * Specifically:
   * 1. TodoWrite tool invocations -> keep the todo list in sync.
   * 2. Usage summaries -> roll up token accounting.
   */
  private handleAssistantMessage(message: SDKAssistantMessage): void {
    if (message.message && Array.isArray(message.message.content)) {
      for (const block of message.message.content) {
        // Extract TodoWrite tool invocations to mirror Claude's todo list.
        if (
          block.type === "tool_use" &&
          block.name === "TodoWrite" &&
          block.input &&
          typeof block.input === "object" &&
          "todos" in block.input
        ) {
          const input = block.input as { todos?: TodoItem[] };
          if (input.todos) {
            this.updateTodosState(input.todos);
          }
        }
      }
    }

    // Update usage tracking when the assistant reports fresh metrics.
    if (message.message.usage) {
      this.updateUsage(message.message.usage);
    }
  }

  private updateTodosState(todos: TodoItem[]): void {
    const normalized = todos.map((todo) => ({ ...todo }));
    const changed = !areTodosEqual(this.todos, normalized);
    this.todos = normalized;
    if (!changed) {
      return;
    }

    if (this.isLoading) {
      this.pendingTodosBroadcast = true;
      return;
    }

    this.emitTodosUpdate();
  }

  private updateToolsState(tools: string[]): void {
    const normalized = [...tools];
    const changed = !areStringArraysEqual(this.tools, normalized);
    this.tools = normalized;
    if (!changed) {
      return;
    }

    if (this.isLoading) {
      this.pendingToolsBroadcast = true;
      return;
    }

    this.emitToolsUpdate();
  }

  private flushPendingStateUpdates(): void {
    if (this.pendingTodosBroadcast) {
      this.pendingTodosBroadcast = false;
      this.emitTodosUpdate();
    }

    if (this.pendingToolsBroadcast) {
      this.pendingToolsBroadcast = false;
      this.emitToolsUpdate();
    }
  }

  private emitTodosUpdate(): void {
    this.noticeSubscribers({
      type: "todos_updated",
      sessionId: this.claudeSessionId,
      todos: this.todos,
    });
  }

  private emitToolsUpdate(): void {
    this.noticeSubscribers({
      type: "tools_updated",
      sessionId: this.claudeSessionId,
      tools: this.tools,
    });
  }

  /**
   * Recompute the usage aggregate by summing input, cache, and output tokens.
   */
  private updateUsage(usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  }): void {
    const totalTokens =
      usage.input_tokens +
      (usage.cache_creation_input_tokens ?? 0) +
      (usage.cache_read_input_tokens ?? 0) +
      usage.output_tokens;

    const previous = this.usageData;

    this.usageData = {
      totalTokens,
      totalCost: previous.totalCost,
      contextWindow: previous.contextWindow,
    };
  }
}

interface MessageDiff {
  added: ChatMessage[];
  updated: ChatMessage[];
  removed: string[];
}

function diffMessages(
  previous: ChatMessage[],
  next: ChatMessage[],
  explicitlyUpdated: ChatMessage[] = []
): MessageDiff {
  const previousMap = buildMessageMap(previous);
  const nextMap = buildMessageMap(next);

  const added: ChatMessage[] = [];
  const removed: string[] = [];
  const updatedMap = new Map<string, ChatMessage>();
  const explicitIds = new Set(explicitlyUpdated.map((message) => message.id));

  for (const [id, message] of nextMap) {
    if (!previousMap.has(id)) {
      added.push(message);
    }
  }

  for (const [id] of previousMap) {
    if (!nextMap.has(id)) {
      removed.push(id);
    }
  }

  for (const [id, message] of nextMap) {
    if (explicitIds.has(id)) {
      updatedMap.set(id, message);
      continue;
    }
    const previousMessage = previousMap.get(id);
    if (previousMessage && previousMessage !== message) {
      updatedMap.set(id, message);
    }
  }

  return {
    added,
    updated: Array.from(updatedMap.values()),
    removed,
  };
}

function buildMessageMap(messages: ChatMessage[]): Map<string, ChatMessage> {
  const map = new Map<string, ChatMessage>();
  for (const message of messages) {
    if (!map.has(message.id)) {
      map.set(message.id, message);
    }
  }
  return map;
}

function areTodosEqual(left: TodoItem[], right: TodoItem[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const a = left[index];
    const b = right[index];
    if (!b || a.content !== b.content || a.status !== b.status) {
      return false;
    }
  }

  return true;
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

function extractSummaryFromMessages(
  messages: ChatMessage[]
): string | undefined {
  for (const message of messages) {
    if (message.type !== "user") {
      continue;
    }

    for (const part of message.content) {
      const content = part.content;
      if (content.type === "text" && content.text.trim().length > 0) {
        return content.text.trim();
      }
    }
  }

  return undefined;
}

function extractLastMessageTimestamp(messages: SDKMessage[]): number | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const candidate = messages[index];
    if (!candidate) {
      continue;
    }

    const timestamp = (candidate as { timestamp?: unknown }).timestamp;
    const extracted = extractTimestamp(timestamp);
    if (extracted !== null) {
      return extracted;
    }
  }
  return null;
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
