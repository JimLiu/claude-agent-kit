
import { nanoid } from "nanoid";
import { Session } from "./session";
import type { WSClient, IncomingMessage } from "./types";

// Main WebSocket handler class
export class WebSocketHandler {
  private sessions: Map<string, Session> = new Map();
  private clients: Map<string, WSClient> = new Map();

  constructor() {
  }

  private generateSessionId(): string {
    return nanoid();
  }

  private getOrCreateSession(sessionId?: string): Session {
    if (sessionId && this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId)!;
    }

    const newSessionId = sessionId || this.generateSessionId();
    const session = new Session(newSessionId);
    this.sessions.set(newSessionId, session);
    return session;
  }

  public async onOpen(ws: WSClient) {
    const clientId = Date.now().toString() + '-' + Math.random().toString(36).substring(7);
    this.clients.set(clientId, ws);
    console.log('WebSocket client connected:', clientId);

    const requestedSessionId = ws.data.sessionId?.trim() || '';
    let session: Session | null = null;
    let resumed = false;

    if (requestedSessionId) {
      const existingSession = this.sessions.get(requestedSessionId);
      if (existingSession) {
        session = existingSession;
        existingSession.subscribe(ws);
        resumed = true;
      } else {
        ws.data.sessionId = '';
        ws.send(JSON.stringify({
          type: 'error',
          error: 'Session does not exist',
          code: 'session_not_found',
          sessionId: requestedSessionId
        }));
      }
    }

    if (!session && !requestedSessionId) {
      session = this.getOrCreateSession();
      session.subscribe(ws);
    }

    ws.send(JSON.stringify({
      type: 'connected',
      message: 'Connected to agent assistant',
      sessionId: session ? session.id : null,
      resumed,
      availableSessions: Array.from(this.sessions.keys())
    }));
  }

  public async onMessage(ws: WSClient, message: string) {
    try {
      const data = JSON.parse(message) as IncomingMessage;

      switch (data.type) {
        case 'chat': {
          // Handle chat message
          const session = this.getOrCreateSession(data.sessionId);

          // Auto-subscribe the sender to the session
          if (!ws.data.sessionId || ws.data.sessionId !== session.id) {
            session.subscribe(ws);
          }

          // Check if this is a request to start a new conversation
          if (data.newConversation) {
            session.endConversation();
          }

          // Add the user message to the session
          await session.addUserMessage(data.content, data.attachments);
          break;
        }

        case 'subscribe': {
          // Subscribe to a specific session
          const session = this.sessions.get(data.sessionId);
          if (session) {
            // Unsubscribe from current session if any
            if (ws.data.sessionId && ws.data.sessionId !== data.sessionId) {
              const currentSession = this.sessions.get(ws.data.sessionId);
              currentSession?.unsubscribe(ws);
            }

            session.subscribe(ws);
            ws.send(JSON.stringify({
              type: 'subscribed',
              sessionId: data.sessionId
            }));
          } else {
            if (ws.data.sessionId === data.sessionId) {
              ws.data.sessionId = '';
            }
            ws.send(JSON.stringify({
              type: 'error',
              error: 'Session does not exist',
              code: 'session_not_found',
              sessionId: data.sessionId
            }));
          }
          break;
        }

        case 'unsubscribe': {
          // Unsubscribe from a session
          const session = this.sessions.get(data.sessionId);
          if (session) {
            session.unsubscribe(ws);
            ws.data.sessionId = '';
            ws.send(JSON.stringify({
              type: 'unsubscribed',
              sessionId: data.sessionId
            }));
          }
          break;
        }

        default:
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Unknown message type'
          }));
      }
    } catch (error) {
      console.error('WebSocket error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Failed to process message'
      }));
    }
  }

  public onClose(ws: WSClient) {
    // Unsubscribe from any session
    if (ws.data.sessionId) {
      const session = this.sessions.get(ws.data.sessionId);
      session?.unsubscribe(ws);
    }

    // Remove from clients map
    const clientsArray = Array.from(this.clients.entries());
    for (const [id, client] of clientsArray) {
      if (client === ws) {
        this.clients.delete(id);
        console.log('WebSocket client disconnected:', id);
        break;
      }
    }

    // Clean up empty sessions
    this.cleanupEmptySessions();
  }

  private cleanupEmptySessions() {
    for (const [id, session] of this.sessions) {
      if (!session.hasSubscribers()) {
        // Keep session for a grace period (could be made configurable)
        setTimeout(() => {
          if (!session.hasSubscribers()) {
            session.cleanup();
            this.sessions.delete(id);
            console.log('Cleaned up empty session:', id);
          }
        }, 60000); // 1 minute grace period
      }
    }
  }

  public getActiveSessionsCount(): number {
    return this.sessions.size;
  }

  public getActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  public cleanup() {
    // Clean up sessions
    for (const session of this.sessions.values()) {
      session.cleanup();
    }
  }
}
