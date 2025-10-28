import { afterEach, describe, expect, it, vi } from "vitest";
import type { WebSocket } from "ws";
import { WebSocketHandler } from "../src/websocket-handler";
import type {
  IClaudeAgentSDKClient,
  ISessionClient,
  SessionSDKOptions,
} from "@claude-agent-kit/server";

type MockWs = WebSocket & { send: ReturnType<typeof vi.fn> };

type MockSessionManager = {
  subscribe: ReturnType<typeof vi.fn>;
  unsubscribe: ReturnType<typeof vi.fn>;
  sendMessage: ReturnType<typeof vi.fn>;
  setSDKOptions: ReturnType<typeof vi.fn>;
};

function createMockSessionManager(): MockSessionManager {
  return {
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    sendMessage: vi.fn(),
    setSDKOptions: vi.fn(),
  };
}

function createHandlerWithMockManager(mockManager: MockSessionManager) {
  const handler = new WebSocketHandler(
    {} as IClaudeAgentSDKClient,
    {} as SessionSDKOptions,
  );
  (handler as unknown as { sessionManager: MockSessionManager }).sessionManager = mockManager;
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

  it("validates chat message content and routes messages to the session manager", async () => {
    const mockManager = createMockSessionManager();
    const handler = createHandlerWithMockManager(mockManager);
    const ws = createWebSocket();

    await handler.onOpen(ws);
    const subscribedClient = mockManager.subscribe.mock.calls[0]![0] as ISessionClient;

    await handler.onMessage(ws, JSON.stringify({ type: "chat", content: "   " }));
    expect(getLastSentPayload(ws)).toMatchObject({
      type: "error",
      code: "empty_message",
    });

    await handler.onMessage(
      ws,
      JSON.stringify({ type: "chat", content: "Hello", attachments: [] }),
    );

    expect(mockManager.sendMessage).toHaveBeenCalledWith(
      subscribedClient,
      "Hello",
      [],
    );
  });

  it("updates SDK options through the session manager", async () => {
    const mockManager = createMockSessionManager();
    const handler = createHandlerWithMockManager(mockManager);
    const ws = createWebSocket();

    await handler.onOpen(ws);
    const subscribedClient = mockManager.subscribe.mock.calls[0]![0] as ISessionClient;

    await handler.onMessage(
      ws,
      JSON.stringify({ type: "setSDKOptions", options: { thinkingLevel: "default_on" } }),
    );

    expect(mockManager.setSDKOptions).toHaveBeenCalledWith(subscribedClient, {
      thinkingLevel: "default_on",
    });
  });

  it("returns an error when a state change message arrives before registration", async () => {
    const mockManager = createMockSessionManager();
    const handler = createHandlerWithMockManager(mockManager);
    const unregistered = createWebSocket();

    await handler.onMessage(
      unregistered,
      JSON.stringify({ type: "setSDKOptions", options: {} }),
    );

    expect(getLastSentPayload(unregistered)).toMatchObject({
      type: "error",
      error: "WebSocket client not registered",
    });
  });
});
