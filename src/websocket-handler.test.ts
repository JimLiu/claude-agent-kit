import { afterEach, describe, expect, it, vi } from "vitest";
import type { WebSocket } from "ws";
import { WebSocketHandler } from "./websocket-handler";
import type { ISessionClient, PermissionMode, ThinkingLevel } from "./types";
import type { SessionManager } from "./session-manager";

type MockWs = WebSocket & { send: ReturnType<typeof vi.fn> };

function createMockSessionManager() {
  return {
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    sendMessage: vi.fn(),
    setPermissionMode: vi.fn(),
    setThinkingLevel: vi.fn(),
  };
}

function createHandlerWithMockManager(mockManager: ReturnType<typeof createMockSessionManager>) {
  const handler = new WebSocketHandler();
  (handler as unknown as { sessionManager: SessionManager }).sessionManager = mockManager as unknown as SessionManager;
  return handler;
}

function createWebSocket(): MockWs {
  return {
    send: vi.fn(),
  } as unknown as MockWs;
}

function getLastSentPayload(ws: MockWs) {
  const call = ws.send.mock.calls.at(-1);
  return call ? JSON.parse(call[0]) : undefined;
}

describe("WebSocketHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects invalid JSON payloads", async () => {
    const mockManager = createMockSessionManager();
    const handler = createHandlerWithMockManager(mockManager);
    const ws = createWebSocket();

    await handler.onOpen(ws);
    await handler.onMessage(ws, "{ not json }");

    expect(getLastSentPayload(ws)).toMatchObject({
      type: "error",
      error: "Invalid JSON payload",
    });
  });

  it("validates chat message content and routes valid messages to the session manager", async () => {
    const mockManager = createMockSessionManager();
    const handler = createHandlerWithMockManager(mockManager);
    const ws = createWebSocket();

    await handler.onOpen(ws);
    const subscribedClient = mockManager.subscribe.mock.calls[0][0] as ISessionClient;

    await handler.onMessage(ws, JSON.stringify({ type: "chat", content: "   " }));
    expect(getLastSentPayload(ws)).toMatchObject({
      type: "error",
      code: "empty_message",
    });

    await handler.onMessage(ws, JSON.stringify({ type: "chat", content: "Hello", attachments: [] }));
    expect(mockManager.sendMessage).toHaveBeenCalledWith(subscribedClient, "Hello", []);
  });

  it("sets permission mode and thinking level through the session manager", async () => {
    const mockManager = createMockSessionManager();
    const handler = createHandlerWithMockManager(mockManager);
    const ws = createWebSocket();

    await handler.onOpen(ws);
    const client = mockManager.subscribe.mock.calls[0][0] as ISessionClient;

    await handler.onMessage(ws, JSON.stringify({ type: "setPermissionMode", mode: "default" as PermissionMode }));
    expect(mockManager.setPermissionMode).toHaveBeenCalledWith(client, "default");

    await handler.onMessage(ws, JSON.stringify({ type: "setThinkingLevel", value: "default_on" as ThinkingLevel }));
    expect(mockManager.setThinkingLevel).toHaveBeenCalledWith(client, "default_on");
  });

  it("returns an error when a state change message arrives before the socket is registered", async () => {
    const mockManager = createMockSessionManager();
    const handler = createHandlerWithMockManager(mockManager);
    const unregistered = createWebSocket();

    await handler.onMessage(unregistered, JSON.stringify({ type: "setPermissionMode", mode: "default" as PermissionMode }));

    expect(getLastSentPayload(unregistered)).toMatchObject({
      type: "error",
      error: "WebSocket client not registered",
    });
  });
});
