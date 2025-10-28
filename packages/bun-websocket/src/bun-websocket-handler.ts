import type { ServerWebSocket } from "bun";
import {
  SessionManager,
  type ChatIncomingMessage,
  type IClaudeAgentSDKClient,
  type IncomingMessage,
  type ResumeSessionIncomingMessage,
  type SessionSDKOptions,
  type SetSDKOptionsIncomingMessage,
} from "@claude-agent-kit/server";
import { BunWebSocketSessionClient } from "./bun-websocket-session-client";

type WSClient = ServerWebSocket<{ sessionId: string }>;

export class BunWebSocketHandler {
  private clients: Map<WSClient, BunWebSocketSessionClient> = new Map();
  private sessionManager = new SessionManager();
  private textDecoder = new TextDecoder();

  sdkClient: IClaudeAgentSDKClient;
  options: SessionSDKOptions;

  constructor(sdkClient: IClaudeAgentSDKClient, options: SessionSDKOptions) {
    this.sdkClient = sdkClient;
    this.options = options;
  }

  private send(ws: WSClient, payload: Record<string, unknown>): void {
    try {
      ws.send(JSON.stringify(payload));
    } catch (error) {
      console.error("Failed to send Bun WebSocket message:", error);
    }
  }

  public async onOpen(ws: WSClient) {
    const client = new BunWebSocketSessionClient(this.sdkClient, ws);
    this.clients.set(ws, client);
    if (!ws.data) {
      ws.data = { sessionId: client.sessionId ?? "" };
    } else if (!ws.data.sessionId && client.sessionId) {
      ws.data.sessionId = client.sessionId;
    }
    console.log(
      "Bun WebSocket client connected",
      {
        sessionId: client.sessionId,
        clientCount: this.clients.size,
      },
    );
    this.sessionManager.subscribe(client);
    try {
      this.sessionManager.setSDKOptions(client, this.options);
    } catch (error) {
      console.error("Failed to apply default Bun SDK options:", error);
    }

    this.send(ws, {
      type: "connected",
      message: "Connected to the Claude Code Bun WebSocket server.",
    });
  }

  public onClose(ws: WSClient) {
    const client = this.clients.get(ws);
    if (!client) {
      console.error("Bun WebSocket client not registered on close");
      return;
    }
    console.log(
      "Bun WebSocket client disconnected",
      {
        sessionId: client.sessionId,
      },
    );
    this.sessionManager.unsubscribe(client);
    this.clients.delete(ws);
    console.log(
      "Bun WebSocket active clients after disconnect",
      { clientCount: this.clients.size },
    );
  }

  public async onMessage(
    ws: WSClient,
    rawMessage: string | ArrayBufferLike | ArrayBufferView,
  ): Promise<void> {
    const textMessage = this.normalizeMessage(rawMessage);
    if (textMessage === null) {
      console.error("Unsupported Bun WebSocket message type", typeof rawMessage);
      this.send(ws, { type: "error", error: "Unsupported message payload" });
      return;
    }
    let message: IncomingMessage;
    try {
      message = JSON.parse(textMessage) as IncomingMessage;
    } catch (error) {
      console.error("Failed to parse Bun WebSocket message:", error);
      this.send(ws, { type: "error", error: "Invalid JSON payload" });
      return;
    }

    switch (message.type) {
      case "chat":
        await this.handleChatMessage(ws, message);
        break;
      case "setSDKOptions":
        this.handleSetSDKOptions(ws, message);
        break;
      case "resume":
        await this.handleResumeMessage(ws, message);
        break;
      default:
        this.send(ws, {
          type: "error",
          error: `Unsupported message type: ${String((message as { type?: unknown }).type)}`,
          code: "unsupported_message_type",
        });
        break;
    }
  }

  private handleSetSDKOptions(ws: WSClient, message: SetSDKOptionsIncomingMessage): void {
    const client = this.clients.get(ws);
    if (!client) {
      console.error("Bun WebSocket client not registered");
      this.send(ws, { type: "error", error: "WebSocket client not registered" });
      return;
    }

    try {
      this.sessionManager.setSDKOptions(client, message.options);
    } catch (error) {
      console.error("Failed to set Bun SDK options:", error);
      this.send(ws, { type: "error", error: "Failed to set SDK options" });
    }
  }

  private async handleChatMessage(ws: WSClient, message: ChatIncomingMessage): Promise<void> {
    const client = this.clients.get(ws);
    if (!client) {
      console.error("Bun WebSocket client not registered");
      return;
    }

    const content = message.content?.trim();
    if (!content) {
      this.send(ws, {
        type: "error",
        error: "Message content cannot be empty",
        code: "empty_message",
      });
      return;
    }

    this.sessionManager.sendMessage(client, content, message.attachments);
  }

  private async handleResumeMessage(
    ws: WSClient,
    message: ResumeSessionIncomingMessage,
  ): Promise<void> {
    const client = this.clients.get(ws);
    if (!client) {
      console.error("Bun WebSocket client not registered");
      this.send(ws, { type: "error", error: "WebSocket client not registered" });
      return;
    }

    const targetSessionId = message.sessionId?.trim();
    console.log(
      `[BunWebSocketHandler] Client ${client.sessionId ?? "unknown"} requested resume to ${targetSessionId}`,
      message,
    );
    if (!targetSessionId) {
      this.send(ws, {
        type: "error",
        error: "Session ID is required to resume",
        code: "invalid_session_id",
      });
      return;
    }

    const previousSessionId = client.sessionId;
    if (previousSessionId && previousSessionId !== targetSessionId) {
      const previousSession = this.sessionManager.getSession(previousSessionId);
      previousSession?.unsubscribe(client);
      console.log(`[BunWebSocketHandler] Unsubscribed client from previous session ${previousSessionId}`);
    }

    client.sessionId = targetSessionId;
    if (!ws.data) {
      ws.data = { sessionId: targetSessionId };
    } else {
      ws.data.sessionId = targetSessionId;
    }

    const session = this.sessionManager.getOrCreateSession(client);
    session.subscribe(client);
    console.log(
      `[BunWebSocketHandler] Client subscribed to ${targetSessionId}, session has ${session.messages.length} messages loaded`,
    );

    try {
      await session.resumeFrom(targetSessionId);
      console.log(`[BunWebSocketHandler] Resume completed for ${targetSessionId}`);
    } catch (error) {
      console.error(`Failed to resume session '${targetSessionId}':`, error);
      this.send(ws, {
        type: "error",
        error: "Failed to resume session",
        code: "resume_failed",
      });
    }
  }

  private normalizeMessage(rawMessage: string | ArrayBufferLike | ArrayBufferView): string | null {
    if (typeof rawMessage === "string") {
      return rawMessage;
    }
    if (ArrayBuffer.isView(rawMessage)) {
      return this.textDecoder.decode(rawMessage);
    }
    if (typeof rawMessage === "object" && rawMessage !== null) {
      return this.textDecoder.decode(new Uint8Array(rawMessage));
    }
    return null;
  }
}
