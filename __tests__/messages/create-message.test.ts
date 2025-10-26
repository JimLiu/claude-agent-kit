import { afterEach, describe, expect, it, vi } from "vitest";
import { createChatMessageFromSDKMessage } from "../../src/messages/create-message";
import type { MessageContentBlock } from "../../src/types";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

describe("createChatMessageFromSDKMessage", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it("creates a text chat message when the SDK payload includes a string", () => {
    const sdkMessage = {
      type: "user",
      uuid: "user-1",
      timestamp: 1700000000000,
      message: {
        content: "hello world",
      },
    } as unknown as SDKMessage;

    const chatMessage = createChatMessageFromSDKMessage(sdkMessage)!;

    expect(chatMessage).toMatchObject({
      id: "user-1",
      type: "user",
      timestamp: 1700000000000,
    });
    expect(chatMessage.content).toHaveLength(1);
    expect(chatMessage.content[0]!.content).toEqual({ type: "text", text: "hello world" });
  });

  it("creates a chat message with individual parts when the SDK payload has structured content", () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);
    const contentBlocks: MessageContentBlock[] = [
      { type: "text", text: "Step 1" },
      { type: "text", text: "Step 2" },
    ];
    const sdkMessage = {
      type: "assistant",
      uuid: "assistant-1",
      message: {
        content: contentBlocks,
      },
    } as unknown as SDKMessage;

    const chatMessage = createChatMessageFromSDKMessage(sdkMessage)!;

    expect(chatMessage.content).toHaveLength(2);
    expect(chatMessage.content[0]!.content).toEqual(contentBlocks[0]);
    expect(chatMessage.content[1]!.content).toEqual(contentBlocks[1]);
    expect(chatMessage.timestamp).toBe(now);
  });

  it("returns undefined for stream events because they are not renderable", () => {
    const sdkMessage = {
      type: "stream_event",
      uuid: "stream-1",
      message: {
        content: [],
      },
    } as unknown as SDKMessage;

    expect(createChatMessageFromSDKMessage(sdkMessage)).toBeUndefined();
  });
});
