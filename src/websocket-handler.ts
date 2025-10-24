import type { WebSocket } from "ws";
import { SessionManager } from "./session-manager";
import type {
  ChatIncomingMessage,
  IClaudeAgentSDKClient,
  IncomingMessage,
  ISessionClient,
  OutcomingMessage,
  SetPermissionModeIncomingMessage,
  SetThinkingLevelIncomingMessage,
} from "./types";
import { SimpleClaudeAgentSDKClient } from "./simple-cas-client";
import { WebSocketSessionClient } from "./websocket-session-client";

export class WebSocketHandler {
  private clients: Map<WebSocket, WebSocketSessionClient> = new Map();
  private sessionManager = new SessionManager()
  
  sdkClient: IClaudeAgentSDKClient;

  constructor() {
    this.sdkClient = new SimpleClaudeAgentSDKClient();
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
      case "setPermissionMode":
        this.handleSetPermissionMode(ws, message);
        break;
      case "setThinkingLevel":
        this.handleSetThinkingLevel(ws, message);
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

  
  private handleSetPermissionMode(ws: WebSocket, message: SetPermissionModeIncomingMessage): void {
    const client = this.clients.get(ws);
    if (!client) {
      console.error("WebSocket client not registered");
      this.send(ws, { type: "error", error: "WebSocket client not registered" });
      return;
    }

    try {
      this.sessionManager.setPermissionMode(client, message.mode);
    } catch (error) {
      console.error("Failed to set permission mode:", error);
      this.send(ws, { type: "error", error: "Failed to set permission mode" });
    }
  }

  private handleSetThinkingLevel(ws: WebSocket, message: SetThinkingLevelIncomingMessage): void {
    const client = this.clients.get(ws);
    if (!client) {
      console.error("WebSocket client not registered");
      this.send(ws, { type: "error", error: "WebSocket client not registered" });
      return;
    }

    try {
      this.sessionManager.setThinkingLevel(client, message.value);
    } catch (error) {
      console.error("Failed to set thinking level:", error);
      this.send(ws, { type: "error", error: "Failed to set thinking level" });
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

}
