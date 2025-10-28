import type { WebSocket } from "ws";
import {
  SessionManager,
  type ChatIncomingMessage,
  type IClaudeAgentSDKClient,
  type IncomingMessage,
  type ResumeSessionIncomingMessage,
  type SessionSDKOptions,
  type SetSDKOptionsIncomingMessage,
} from "@claude-agent-kit/server";
import { WebSocketSessionClient } from "./websocket-session-client";

export class WebSocketHandler {
  private clients: Map<WebSocket, WebSocketSessionClient> = new Map();
  private sessionManager = new SessionManager();

  sdkClient: IClaudeAgentSDKClient;
  options: SessionSDKOptions;

  constructor(sdkClient: IClaudeAgentSDKClient, options: SessionSDKOptions) {
    this.sdkClient = sdkClient;
    this.options = options;
  }

  private send(ws: WebSocket, payload: Record<string, unknown>): void {
    try {
      ws.send(JSON.stringify(payload));
    } catch (error) {
      console.error("Failed to send WebSocket message:", error);
    }
  }

  public async onOpen(ws: WebSocket) {
    const client = new WebSocketSessionClient(this.sdkClient, ws);
    this.clients.set(ws, client);
    console.log('WebSocket client connected:', client.sessionId);
    this.sessionManager.subscribe(client);

    this.send(ws, { type: "connected", message: 'Connected to the Claude Code WebSocket server.' });
  }

  public onClose(ws: WebSocket) {
    const client = this.clients.get(ws);
    if (!client) {
      console.error("WebSocket client not registered on close");
      return;
    }
    console.log('WebSocket client disconnected:', client.sessionId);
    this.sessionManager.unsubscribe(client);
    this.clients.delete(ws);
  }

  public async onMessage(ws: WebSocket, rawMessage: string): Promise<void> {
    let message: IncomingMessage;
    try {
      message = JSON.parse(rawMessage) as IncomingMessage;
    } catch (error) {
      console.error("Failed to parse WebSocket message:", error);
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

  
  private handleSetSDKOptions(ws: WebSocket, message: SetSDKOptionsIncomingMessage): void {
    const client = this.clients.get(ws);
    if (!client) {
      console.error("WebSocket client not registered");
      this.send(ws, { type: "error", error: "WebSocket client not registered" });
      return;
    }

    try {
      this.sessionManager.setSDKOptions(client, message.options);
    } catch (error) {
      console.error("Failed to set SDK options:", error);
      this.send(ws, { type: "error", error: "Failed to set SDK options" });
    }
  }

  private async handleChatMessage(ws: WebSocket, message: ChatIncomingMessage): Promise<void> {
    const client = this.clients.get(ws);
    if (!client) {
      console.error("WebSocket client not registered");
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

  private async handleResumeMessage(ws: WebSocket, message: ResumeSessionIncomingMessage): Promise<void> {
    const client = this.clients.get(ws);
    if (!client) {
      console.error("WebSocket client not registered");
      this.send(ws, { type: "error", error: "WebSocket client not registered" });
      return;
    }

    const targetSessionId = message.sessionId?.trim();
    console.log(`[WebSocketHandler] Client ${client.sessionId ?? "unknown"} requested resume to ${targetSessionId}`, message);
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
      console.log(`[WebSocketHandler] Unsubscribed client from previous session ${previousSessionId}`);
    }

    client.sessionId = targetSessionId;

    const session = this.sessionManager.getOrCreateSession(client);
    session.subscribe(client);
    client.sessionId = targetSessionId;
    console.log(`[WebSocketHandler] Client subscribed to ${targetSessionId}, session has ${session.messages.length} messages loaded`);

    try {
      await session.resumeFrom(targetSessionId);
      console.log(`[WebSocketHandler] Resume completed for ${targetSessionId}`);
    } catch (error) {
      console.error(`Failed to resume session '${targetSessionId}':`, error);
      this.send(ws, {
        type: "error",
        error: "Failed to resume session",
        code: "resume_failed",
      });
    }
  }
}
