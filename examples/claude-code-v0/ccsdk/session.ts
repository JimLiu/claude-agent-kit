import { MessageQueue } from "./message-queue";
import { promises as fsp, watch, type FSWatcher } from "fs";
import * as path from "path";
import type { WSClient, SDKUserMessage } from "./types";
import { AIClient } from "./ai-client";
import type {
  ChatSessionState,
  RawMessageEvent,
  UserMessageEvent,
} from "../shared/types/messages";
import { type AttachmentPayload } from "../shared/types/messages";
import { composeUserContent, generateMessageId, processIncomingMessage } from "./messages";
import { ensureSessionWorkspace } from "./utils/session-workspace";
import { isWorkspaceFileAllowed, readWorkspaceFiles } from "./utils/workspace-files";

export class Session {
  public readonly id: string;
  private messageQueue: MessageQueue<SDKUserMessage>;
  private queryPromise: Promise<void> | null = null;
  private subscribers: Set<WSClient> = new Set();
  private messageCount = 0;
  private aiClient: AIClient;
  private sdkSessionId: string | null = null;
  private state: ChatSessionState;
  private workspaceWatcher: FSWatcher | null = null;
  private workspacePath: string | null = null;
  private workspaceNotificationTimeout: NodeJS.Timeout | null = null;
  private pendingWorkspaceChanges: Set<string> = new Set();

  constructor(id: string) {
    this.id = id;
    this.messageQueue = new MessageQueue();
    this.aiClient = new AIClient(this.id);
    this.state = createInitialSessionState();
  }

  async addUserMessage(
    content: string,
    attachments?: AttachmentPayload[],
  ): Promise<void> {
    if (this.queryPromise) {
      await this.queryPromise;
    }

    this.messageCount++;
    console.log(`Processing message ${this.messageCount} in session ${this.id}`);

    const composedContent = composeUserContent(content, attachments);
    const userEvent: UserMessageEvent = {
      type: "user",
      timestamp: Date.now(),
      message: {
        id: `user_${generateMessageId()}`,
        role: "user",
        content: composedContent,
      },
    };
    this.handleIncomingEvent(userEvent);

    this.queryPromise = (async () => {
      try {
        const options = this.sdkSessionId ? { resume: this.sdkSessionId } : {};
        this.state = { ...this.state, busy: true };
        this.broadcastSessionUpdate();
        const prompt = {
          user: {
            content: composedContent,
            ...(this.sdkSessionId ? { sessionId: this.sdkSessionId } : {}),
          },
        };
        for await (const message of this.aiClient.queryStream(prompt, options)) {
          this.handleIncomingEvent(message as RawMessageEvent);
          if (message.type === "system" && message.subtype === "init") {
            this.sdkSessionId = message.session_id ?? null;
            console.log(`Captured SDK session ID: ${this.sdkSessionId}`);
          }
        }
      } catch (error) {
        const message = (error as Error).message ?? "Unknown error";
        console.error(`Error in session ${this.id}:`, error);
        this.state = {
          ...this.state,
          busy: false,
          lastError: `Query failed: ${message}`,
        };
        this.broadcastSessionUpdate();
        this.broadcastError(`Query failed: ${message}`);
      } finally {
        this.queryPromise = null;
      }
    })();

    await this.queryPromise;
  }

  subscribe(client: WSClient) {
    this.subscribers.add(client);
    client.data.sessionId = this.id;

    client.send(
      JSON.stringify({
        type: "session_info",
        sessionId: this.id,
        messageCount: this.messageCount,
        isActive: this.queryPromise !== null,
      }),
    );

    client.send(
      JSON.stringify({
        type: "session_snapshot",
        sessionId: this.id,
        state: sanitizeSessionStateForTransport(this.state),
      }),
    );

    void this.ensureWorkspaceMonitoring(client);
  }

  unsubscribe(client: WSClient) {
    this.subscribers.delete(client);
    if (this.subscribers.size === 0) {
      this.stopWorkspaceMonitoring();
    }
  }

  private handleIncomingEvent(event: RawMessageEvent) {
    this.state = processIncomingMessage(this.state, event);
    this.broadcastSessionUpdate(event);
  }

  private broadcastSessionUpdate(event?: RawMessageEvent) {
    const payload = {
      type: "session_update",
      sessionId: this.id,
      state: sanitizeSessionStateForTransport(this.state),
      event,
    };
    this.broadcast(payload);
  }

  private broadcast(message: unknown) {
    const messageStr = JSON.stringify(message);
    for (const client of this.subscribers) {
      try {
        client.send(messageStr);
      } catch (error) {
        console.error("Error broadcasting to client:", error);
        this.subscribers.delete(client);
      }
    }
  }

  private broadcastError(error: string) {
    this.broadcast({
      type: "error",
      error,
      sessionId: this.id,
    });
  }

  hasSubscribers(): boolean {
    return this.subscribers.size > 0;
  }

  async cleanup() {
    this.messageQueue.close();
    this.subscribers.clear();
    this.stopWorkspaceMonitoring();
  }

  endConversation() {
    this.sdkSessionId = null;
    this.queryPromise = null;
    this.state = createInitialSessionState();
  }

  private async ensureWorkspaceMonitoring(target?: WSClient): Promise<void> {
    try {
      const workspaceDir = await ensureSessionWorkspace(this.id);
      this.workspacePath = workspaceDir;

      if (!this.workspaceWatcher) {
        try {
          this.workspaceWatcher = watch(workspaceDir, { recursive: true }, (_event, filename) => {
            this.handleWorkspaceChange(filename ? filename.toString() : null);
          });
          this.workspaceWatcher.on("error", (error) => {
            console.error(`Workspace watcher error in session ${this.id}:`, error);
            this.handleWorkspaceChange(null);
          });
          console.log(`[Session ${this.id}] Workspace monitoring started at ${workspaceDir}`);
        } catch (error) {
          console.error(`Failed to start workspace watcher for session ${this.id}:`, error);
          this.workspaceWatcher = null;
        }
      }

      await this.notifyWorkspaceUpdate(target, "initial");
    } catch (error) {
      console.error(`Failed to initialize workspace monitoring for session ${this.id}:`, error);
    }
  }

  private handleWorkspaceChange(filename: string | null) {
    if (filename) {
      let relativePath = filename;
      if (this.workspacePath) {
        relativePath = path.relative(
          this.workspacePath,
          path.join(this.workspacePath, filename),
        );
      }

      const normalized = relativePath.replace(/\\/g, "/");
      if (!isWorkspaceFileAllowed(normalized)) {
        console.log(
          `[Session ${this.id}] Ignoring workspace change for unsupported file: ${normalized}`,
        );
        return;
      }
      console.log(`[Session ${this.id}] Workspace change detected: ${normalized}`);
      this.pendingWorkspaceChanges.add(normalized);
    }
    if (!filename) {
      console.warn(
        `[Session ${this.id}] Workspace change received without filename; scheduling full resync`,
      );
    }

    this.scheduleWorkspaceNotification();
  }

  private scheduleWorkspaceNotification() {
    if (this.workspaceNotificationTimeout) {
      clearTimeout(this.workspaceNotificationTimeout);
    }

    this.workspaceNotificationTimeout = setTimeout(() => {
      const changedFiles = Array.from(this.pendingWorkspaceChanges);
      this.pendingWorkspaceChanges.clear();
      console.log(
        `[Session ${this.id}] Broadcasting workspace update (${changedFiles.length} changed files)`,
      );
      void this.notifyWorkspaceUpdate(
        undefined,
        "change",
        changedFiles.length > 0 ? changedFiles : undefined,
      );
    }, 200);
  }

  private async notifyWorkspaceUpdate(
    target?: WSClient,
    reason: "initial" | "change" = "change",
    changedFiles?: string[],
  ) {
    let files: Record<string, string> | undefined;
    const deletedFiles: string[] = [];

    try {
      const workspaceDir =
        this.workspacePath ?? (await ensureSessionWorkspace(this.id));

      if (reason === "initial" || !changedFiles || changedFiles.length === 0) {
        files = await readWorkspaceFiles(workspaceDir);
      } else {
        files = {};
        for (const relative of changedFiles) {
          const absolutePath = path.join(workspaceDir, relative);
          try {
            await fsp.access(absolutePath);
            if (!isWorkspaceFileAllowed(relative)) {
              continue;
            }
            files[relative] = await fsp.readFile(absolutePath, "utf8");
          } catch (error) {
            const code = (error as NodeJS.ErrnoException).code;
            if (code === "ENOENT") {
              deletedFiles.push(relative);
              console.log(
                `[Session ${this.id}] Workspace file removed: ${relative}`,
              );
            } else {
              console.error(
                `[Session ${this.id}] Failed to read changed workspace file ${relative}:`,
                error,
              );
            }
          }
        }

        if (Object.keys(files).length === 0 && deletedFiles.length === 0) {
          files = undefined;
        }
      }
    } catch (error) {
      console.error(
        `[Session ${this.id}] Failed to gather workspace snapshot for ${reason} update:`,
        error,
      );
    }

    const payload = {
      type: "workspace_update",
      sessionId: this.id,
      reason,
      changedFiles: changedFiles ?? [],
      deletedFiles,
      files,
      timestamp: Date.now(),
    };
    const fileCount = files ? Object.keys(files).length : 0;
    console.log(
      `[Session ${this.id}] Sending workspace update (${reason}) - ${fileCount} file payload, ${deletedFiles.length} deletions`,
    );

    if (target) {
      try {
        target.send(JSON.stringify(payload));
      } catch (error) {
        console.error("Failed to notify client about workspace update:", error);
        this.subscribers.delete(target);
      }
      return;
    }

    this.broadcast(payload);
  }

  private stopWorkspaceMonitoring() {
    if (this.workspaceNotificationTimeout) {
      clearTimeout(this.workspaceNotificationTimeout);
      this.workspaceNotificationTimeout = null;
    }

    if (this.workspaceWatcher) {
      try {
        this.workspaceWatcher.close();
      } catch (error) {
        console.error(`Failed to stop workspace watcher for session ${this.id}:`, error);
      } finally {
        this.workspaceWatcher = null;
      }
    }

    this.pendingWorkspaceChanges.clear();
    this.workspacePath = null;
    console.log(`[Session ${this.id}] Workspace monitoring stopped`);
  }
}

function createInitialSessionState(): ChatSessionState {
  return {
    messages: [],
    usage: {
      totalTokens: 0,
      totalCost: 0,
      contextWindow: 0,
    },
    busy: false,
  };
}

function sanitizeSessionStateForTransport(state: ChatSessionState): ChatSessionState {
  return {
    ...state,
    messages: state.messages.map((message) => ({
      ...message,
      raw: undefined,
    })),
  };
}
