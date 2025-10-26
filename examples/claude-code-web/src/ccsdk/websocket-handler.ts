import type { WebSocket } from "ws";
import { ClaudeAgentSDKClient } from "./cas-client";
import { BroadcastMessage, Session } from "./session";
import { SessionManager } from "./session-manager";
import { AttachmentPayload } from "./types";


// WebSocket client type
export type WSClient = WebSocket;

interface BaseIncomingMessage {
  type: "chat" | "subscribe" | "unsubscribe" | "resume";
}

interface ChatIncomingMessage extends BaseIncomingMessage {
  type: "chat";
  content: string;
  sessionId?: string | null;
  attachments?: AttachmentPayload[];
  newConversation?: boolean;
}

interface SubscribeIncomingMessage extends BaseIncomingMessage {
  type: "subscribe";
  sessionId: string;
}

interface UnsubscribeIncomingMessage extends BaseIncomingMessage {
  type: "unsubscribe";
  sessionId: string;
}

interface ResumeIncomingMessage extends BaseIncomingMessage {
  type: "resume";
  sessionId: string;
}

type IncomingMessage =
  | ChatIncomingMessage
  | SubscribeIncomingMessage
  | UnsubscribeIncomingMessage
  | ResumeIncomingMessage;

interface ClientInfo {
  id: string;
  sessionId: string | null;
}

// Main WebSocket handler class
export class WebSocketHandler {
  private clients: Map<WSClient, ClientInfo> = new Map();
  private sessionManager = new SessionManager(() => new ClaudeAgentSDKClient())

  constructor() {
    this.handleSessionMessage = this.handleSessionMessage.bind(this);
  }

  public async onOpen(ws: WSClient) {
    const clientId = Date.now().toString() + '-' + Math.random().toString(36).substring(7);
    this.clients.set(ws, { id: clientId, sessionId: null });
    console.log('WebSocket client connected:', clientId);

    this.send(ws, { type: "connected", message: 'Connected to the Claude Code WebSocket server.' });
  }

  public onClose(ws: WSClient) {
    const clientInfo = this.clients.get(ws);
    if (!clientInfo) {
      console.error("WebSocket client not registered on close");
      return;
    }
    console.log('WebSocket client disconnected:', clientInfo.id);
    this.clients.delete(ws);
    this.sessionManager.unsubscribe(clientInfo.id);
  }


  public async onMessage(ws: WSClient, rawMessage: string): Promise<void> {
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
        this.handleChatMessage(ws, message);
        break;
      case "subscribe":
        this.handleSubscribeMessage(ws, message);
        break;
      case "resume":
        this.handleResumeMessage(ws, message);
        break;
      case "unsubscribe":
        this.handleUnsubscribeMessage(ws, message);
        break;
    }

  }

  private async handleChatMessage(ws: WSClient, message: ChatIncomingMessage): Promise<void> {
    const clientInfo = this.clients.get(ws);
    if (!clientInfo) {
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

    let sessionId = message.sessionId?.trim() || clientInfo.sessionId || null;
    const session = this.sessionManager.getOrCreateSession(sessionId || undefined);
    sessionId = session.claudeSessionId;

    this.subscribe(session, ws);

    await session.send(content, message.attachments);
  }

  private handleSessionMessage(session: Session, message: BroadcastMessage, clientId: string) {
    for (const [ws, info] of this.clients.entries()) {
      if (info.id === clientId) {
        this.send(ws, {
          type: "session_message",
          sessionId: session.claudeSessionId,
          message,
        });
      }
    }
  }

  private subscribe(session: Session, client: WSClient) {
    const clientInfo = this.clients.get(client);
    if (!clientInfo) {
      console.error("WebSocket client not registered");
      return;
    }
    session.subscribe(clientInfo.id, this.handleSessionMessage);
  }

  private async handleResumeMessage(ws: WSClient, message: ResumeIncomingMessage): Promise<void> {
    const clientInfo = this.clients.get(ws);
    if (!clientInfo) {
      console.error("WebSocket client not registered");
      return;
    }

    const rawSessionId = message.sessionId;
    const trimmedId =
      typeof rawSessionId === "string" ? rawSessionId.trim() : "";
    if (!trimmedId) {
      this.send(ws, {
        type: "error",
        error: "Session ID is required to resume conversation",
        code: "missing_session_id",
      });
      return;
    }

    let session = this.sessionManager.getSession(trimmedId);
    if (!session) {
      session = this.sessionManager.createSession();
    }

    clientInfo.sessionId = trimmedId;
    this.clients.set(ws, clientInfo);

    this.subscribe(session, ws);

    try {
      const resumePromise = session.resumeFrom(trimmedId);
      if (resumePromise) {
        await resumePromise;
      }
    } catch (error) {
      console.error("Failed to resume session:", error);
      this.send(ws, {
        type: "error",
        error: "Failed to resume session",
        code: "resume_failed",
      });
    }
  }

  private async handleSubscribeMessage(ws: WSClient, message: SubscribeIncomingMessage): Promise<void> {
    const session = this.sessionManager.getSession(message.sessionId);
    if (!session) {
      this.send(ws, {
        type: "error",
        error: "Session not found",
        code: "session_not_found",
      });
      return;
    }

    // Handle subscription logic
    this.subscribe(session, ws);
    this.send(ws, { type: "subscribed", sessionId: message.sessionId });
  }

  private async handleUnsubscribeMessage(ws: WSClient, message: UnsubscribeIncomingMessage): Promise<void> {
    const clientInfo = this.clients.get(ws);
    if (!clientInfo) {
      console.error("WebSocket client not registered");
      return;
    }
    const session = this.sessionManager.getSession(message.sessionId);
    if (!session) {
      this.send(ws, {
        type: "error",
        error: "Session not found",
        code: "session_not_found",
      });
      return;
    }

    // Handle unsubscription logic
    session.unsubscribe(clientInfo.id);
    this.send(ws, { type: "unsubscribed", sessionId: message.sessionId });
  }

  private send(ws: WSClient, payload: Record<string, unknown>): void {
    try {
      ws.send(JSON.stringify(payload));
    } catch (error) {
      console.error("Failed to send WebSocket message:", error);
    }
  }
}
