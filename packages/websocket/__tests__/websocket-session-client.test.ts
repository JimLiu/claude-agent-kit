import { afterEach, describe, expect, it, vi } from "vitest";
import type { WebSocket } from "ws";
import { WebSocketSessionClient } from "../src/websocket-session-client";
import type {
  IClaudeAgentSDKClient,
  OutcomingMessage,
} from "@claude-agent-kit/server";

function createMockSdkClient(): IClaudeAgentSDKClient {
  return {
    queryStream: vi.fn(),
    loadMessages: vi.fn(),
  };
}

function createMockWebSocket() {
  return {
    send: vi.fn(),
  } as unknown as WebSocket & { send: ReturnType<typeof vi.fn> };
}

describe("WebSocketSessionClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("serializes session messages over the socket", () => {
    const ws = createMockWebSocket();
    const client = new WebSocketSessionClient(createMockSdkClient(), ws);
    const message: OutcomingMessage = {
      type: "session_state_changed",
      sessionId: "abc",
      sessionState: { isBusy: true },
    };

    client.receiveSessionMessage("event", message);

    expect(ws.send).toHaveBeenCalledWith(JSON.stringify(message));
  });

  it("logs an error if the socket send fails", () => {
    const ws = createMockWebSocket();
    ws.send.mockImplementation(() => {
      throw new Error("boom");
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const client = new WebSocketSessionClient(createMockSdkClient(), ws);
    const message: OutcomingMessage = {
      type: "session_state_changed",
      sessionId: null,
      sessionState: { isLoading: true },
    };

    client.receiveSessionMessage("event", message);

    expect(consoleSpy).toHaveBeenCalled();
  });
});
