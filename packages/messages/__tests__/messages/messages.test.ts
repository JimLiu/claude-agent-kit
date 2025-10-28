import { describe, expect, it } from "vitest";
import {
  addNewSDKMessage,
  coalesceReadMessages,
  convertSDKMessages,
} from "../../src/messages/messages";
import type { ChatMessage } from "../../src/types";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

function createAssistantReadSDKMessage(
  toolUseId = "tool-1",
  filePath = "README.md",
  timestamp = 1700000000000,
): SDKMessage {
  return {
    type: "assistant",
    uuid: `assistant-${toolUseId}`,
    timestamp,
    message: {
      content: [
        {
          type: "tool_use",
          id: toolUseId,
          name: "Read",
          input: { file_path: filePath },
        },
      ],
    },
  } as unknown as SDKMessage;
}

function createUserToolResultSDKMessage(
  toolUseId = "tool-1",
  options?: { includeText?: boolean; content?: string; isError?: boolean },
): SDKMessage {
  const blocks: unknown[] = [
    {
      type: "tool_result",
      tool_use_id: toolUseId,
      content: options?.content ?? "contents",
      is_error: options?.isError ?? false,
    },
  ];
  if (options?.includeText) {
    blocks.push({
      type: "text",
      text: "continue",
    });
  }
  return {
    type: "user",
    uuid: `user-${toolUseId}`,
    message: {
      content: blocks,
    },
  } as unknown as SDKMessage;
}

function createStreamEvent(): SDKMessage {
  return {
    type: "stream_event",
    uuid: "stream-1",
    message: { content: [] },
  } as unknown as SDKMessage;
}

function createSuccessfulReadChatMessage(
  toolUseId: string,
  filePath: string,
  timestamp: number,
): ChatMessage {
  return {
    id: toolUseId,
    type: "assistant",
    timestamp,
    content: [
      {
        content: {
          type: "tool_use",
          id: toolUseId,
          name: "Read",
          input: { file_path: filePath },
        },
        toolResult: {
          type: "tool_result",
          tool_use_id: toolUseId,
          content: "ok",
          is_error: false,
        },
      },
    ],
  };
}

describe("messages helpers", () => {
  it("converts SDK messages into chat messages while linking tool results", () => {
    const chatMessages = convertSDKMessages([
      createAssistantReadSDKMessage(),
      createUserToolResultSDKMessage("tool-1", { includeText: true }),
      createStreamEvent(),
    ]);

    expect(chatMessages).toHaveLength(1);
    expect(chatMessages[0]?.content[0]?.toolResult).toMatchObject({
      tool_use_id: "tool-1",
      is_error: false,
    });
    expect(chatMessages[0]?.content[0]?.toolResult?.content).toEqual("contents");
  });

  it("coalesces consecutive successful Read messages", () => {
    const coalesced = coalesceReadMessages([
      createSuccessfulReadChatMessage("tool-1", "README.md", 1),
      createSuccessfulReadChatMessage("tool-2", "api.md", 2),
    ]);

    expect(coalesced).toHaveLength(1);
    const invocation = coalesced[0]?.content[0]?.content as
      | { name: string; input: { fileReads: Array<Record<string, unknown>> } }
      | undefined;
    expect(invocation?.name).toBe("ReadCoalesced");
    expect(invocation?.input).toEqual({
      fileReads: [
        { file_path: "README.md" },
        { file_path: "api.md" },
      ],
    });
    const toolResult = coalesced[0]?.content[0]?.toolResult;
    expect(toolResult).toMatchObject({
      content: "Successfully read 2 files",
      is_error: false,
    });
    expect(toolResult?.tool_use_id).toBeDefined();
  });

  it("appends a new SDK message without mutating the previous list", () => {
    const existing = convertSDKMessages([createAssistantReadSDKMessage()]);

    const updated = addNewSDKMessage(
      existing,
      createUserToolResultSDKMessage("tool-1", { includeText: true }),
    );

    expect(existing).toHaveLength(1);
    expect(updated).toHaveLength(1);
    expect(updated[0]).toBe(existing[0]);
    expect(updated[0]?.content[0]?.toolResult?.tool_use_id).toBe("tool-1");
  });
});
