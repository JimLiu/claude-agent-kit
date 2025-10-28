import { describe, expect, it } from "vitest";
import { appendRenderableMessage } from "../../src/messages/append-renderable-message";
import type { ChatMessage } from "../../src/types";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

function createAssistantMessageWithToolUse(): ChatMessage {
  return {
    id: "assistant-1",
    type: "assistant",
    timestamp: 1,
    content: [
      {
        content: {
          type: "tool_use",
          id: "tool-123",
          name: "Bash",
          input: { command: "ls" },
        },
        toolResult: undefined,
      },
    ],
  };
}

describe("appendRenderableMessage", () => {
  it("updates the previous tool_use message when a tool_result arrives and appends the user message", () => {
    const messages: ChatMessage[] = [createAssistantMessageWithToolUse()];
    const toolResultBlock = {
      type: "tool_result",
      tool_use_id: "tool-123",
      content: [{ type: "text", text: "output" }],
      is_error: false,
    };
    const incoming = {
      type: "user",
      message: {
        content: [
          toolResultBlock,
          { type: "text", text: "continue" },
        ],
      },
    } as unknown as SDKMessage;

    const result = appendRenderableMessage(messages, incoming);

    expect(result.addedMessage).toBeUndefined();
    expect(result.updatedMessages).toEqual([messages[0]]);
    expect(result.toolResultUpdates).toEqual([
      {
        message: messages[0],
        toolUseId: "tool-123",
        toolResult: toolResultBlock,
      },
    ]);
    expect(messages[0]!.content[0]!.toolResult).toBe(toolResultBlock);
    expect(messages).toHaveLength(1);
  });

  it("ignores stream events because they cannot be rendered", () => {
    const messages: ChatMessage[] = [];
    const incoming = {
      type: "stream_event",
      message: {
        content: [],
      },
    } as unknown as SDKMessage;

    const result = appendRenderableMessage(messages, incoming);

    expect(result.addedMessage).toBeUndefined();
    expect(result.updatedMessages).toEqual([]);
    expect(messages).toHaveLength(0);
  });
});
