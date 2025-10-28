import { afterEach, describe, expect, it, vi } from "vitest";
import { Session } from "../src/server/session";
import type { IClaudeAgentSDKClient } from "../src/types";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

function createMockSdkClient(): IClaudeAgentSDKClient {
  return {
    queryStream: vi.fn(),
    loadMessages: vi.fn(),
  };
}

function createSdkMessage(overrides: Record<string, unknown>): SDKMessage {
  return {
    type: "system",
    message: { content: [] },
    session_id: "",
    ...overrides,
  } as unknown as SDKMessage;
}

describe("Session", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads messages from the server and updates state", async () => {
    const sdkClient = createMockSdkClient();
    const loadedMessages: SDKMessage[] = [
      createSdkMessage({ type: "assistant", session_id: "abc", uuid: "1" as never }),
    ];
    sdkClient.loadMessages.mockResolvedValue({ messages: loadedMessages });
    const session = new Session(sdkClient);

    await session.loadFromServer("abc");

    expect(session.sessionId).toBe("abc");
    expect(session.messages).toEqual(loadedMessages);
    expect(session.isLoading).toBe(false);
    expect(session.isBusy).toBe(false);
  });

  it("sends a user message and streams responses", async () => {
    const sdkClient = createMockSdkClient();
    sdkClient.loadMessages.mockResolvedValue({ messages: [] });
    const streamedMessages: SDKMessage[] = [
      createSdkMessage({
        type: "system",
        subtype: "init" as never,
        session_id: "session-123",
        timestamp: 10,
      }),
      createSdkMessage({
        type: "result",
        session_id: "session-123",
        timestamp: 20,
      }),
    ];
    sdkClient.queryStream.mockImplementation(async function* () {
      for (const entry of streamedMessages) {
        yield entry;
      }
    });
    const session = new Session(sdkClient);

    await session.send("Hello Claude", undefined);

    expect(session.messages).toHaveLength(3);
    expect(session.messages[0]!.type).toBe("user");
    expect(session.sessionId).toBe("session-123");
    expect(session.summary).toBe("Hello Claude");
    expect(session.isBusy).toBe(false);
    expect(sdkClient.queryStream).toHaveBeenCalledTimes(1);
  });

  it("processIncomingMessage updates session metadata from timestamps and result messages", () => {
    const sdkClient = createMockSdkClient();
    sdkClient.loadMessages.mockResolvedValue({ messages: [] });
    const session = new Session(sdkClient);

    const message = createSdkMessage({
      type: "system",
      session_id: "session-xyz",
      timestamp: "170000",
    });
    session.processIncomingMessage(message);

    expect(session.sessionId).toBe("session-xyz");
    expect(session.lastModifiedTime).toBe(170000);

    const resultMessage = createSdkMessage({
      type: "result",
      session_id: "session-xyz",
      timestamp: 200000,
    });
    session.processIncomingMessage(resultMessage);

    expect(session.isBusy).toBe(false);
    expect(session.lastModifiedTime).toBe(200000);
  });
});
