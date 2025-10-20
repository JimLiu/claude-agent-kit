import { readFileSync } from "node:fs";
import type {
  ChatSessionState,
  RawMessageEvent,
  SystemMessageEvent,
  ToolInvocationSegment,
} from "@/shared/types/messages";
import { processIncomingMessage } from "./messages";

const CLAUDE_CODE_SESSION =
  "/Users/jimliu/.claude/projects/-Users-jimliu-GitHub-claude-code-v0/27cf2b2d-13c5-42ae-b488-cb83c43e40e7.jsonl";
const WHISPERKIT_SESSION =
  "/Users/jimliu/.claude/projects/-Users-jimliu-GitHub-WhisperKit/cba5ac36-cf08-4b28-a5af-c1a78a45b8af.jsonl";
const LOCAL_COMMAND_SESSION =
  "/Users/jimliu/.claude/projects/-Users-jimliu-GitHub/d6e10f9c-8274-4339-a591-a7e65b27f2ba.jsonl";
const CLAUDE_TOOL_SESSION =
  "/Users/jimliu/.claude/projects/-Users-jimliu-GitHub-claude-code-v0/4775ef99-d6d2-4dac-9c4c-f6d940497846.jsonl";

interface TranscriptRecord {
  type?: string;
  message?: Record<string, unknown>;
  sessionId?: string;
  session_id?: string;
  subtype?: string;
  model?: string;
  [key: string]: unknown;
}

function loadTranscript(path: string): TranscriptRecord[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TranscriptRecord);
}

function createBaseState(): ChatSessionState {
  return {
    messages: [],
    usage: { totalTokens: 0, totalCost: 0, contextWindow: 0 },
    busy: false,
  };
}

function coerceToRawEvent(record: TranscriptRecord): RawMessageEvent {
  return record as RawMessageEvent;
}

function getMessage(entry: TranscriptRecord): Record<string, unknown> | undefined {
  if (typeof entry.message === "object" && entry.message) {
    return entry.message as Record<string, unknown>;
  }
  return undefined;
}

function readNumber(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

describe("processIncomingMessage with real transcripts", () => {
  const claudeRecords = loadTranscript(CLAUDE_CODE_SESSION);
  const whisperRecords = loadTranscript(WHISPERKIT_SESSION);

  it("parses user text messages from conversation history", () => {
    const record = claudeRecords.find(
      (entry) => {
        if (entry.type !== "user") return false;
        const message = getMessage(entry);
        return typeof message?.content === "string";
      },
    );
    expect(record).toBeTruthy();

    const event = coerceToRawEvent(record!);
    const nextState = processIncomingMessage(createBaseState(), event);
    expect(nextState.messages).toHaveLength(1);
    const message = nextState.messages[0];
    expect(message.type).toBe("user");
    expect(message.segments).toHaveLength(1);
    expect(message.segments[0].kind).toBe("text");
    const originalMessage = getMessage(record!);
    const originalContent = originalMessage!.content as string;
    expect(message.segments[0].block).toHaveProperty("text", originalContent);
  });

  it("updates aggregate token usage from assistant events with usage metadata", () => {
    const record = whisperRecords.find((entry) => {
      if (entry.type !== "assistant") return false;
      const message = getMessage(entry);
      if (!message?.usage || typeof message.usage !== "object") return false;
      const usage = message.usage as Record<string, unknown>;
      const sum =
        readNumber(usage.input_tokens) +
        readNumber(usage.output_tokens) +
        readNumber(usage.cache_creation_input_tokens) +
        readNumber(usage.cache_read_input_tokens);
      return sum > 0;
    });
    expect(record).toBeTruthy();

    const event = coerceToRawEvent(record!);
    const nextState = processIncomingMessage(createBaseState(), event);
    const message = getMessage(record!);
    const usage = message!.usage as Record<string, unknown>;
    const expectedTotal =
      readNumber(usage.input_tokens) +
      readNumber(usage.output_tokens) +
      readNumber(usage.cache_creation_input_tokens) +
      readNumber(usage.cache_read_input_tokens);
    expect(nextState.usage.totalTokens).toBe(expectedTotal);
  });

  it("creates tool invocation segments for assistant tool use events", () => {
    const record = claudeRecords.find((entry) => {
      if (entry.type !== "assistant") return false;
      const message = getMessage(entry);
      const content = message?.content;
      return Array.isArray(content) && content.some((block) => (block as { type?: string })?.type === "tool_use");
    });
    expect(record).toBeTruthy();

    const event = coerceToRawEvent(record!);
    const nextState = processIncomingMessage(createBaseState(), event);
    expect(nextState.messages).toHaveLength(1);
    const message = nextState.messages[0];
    expect(message.type).toBe("assistant");
    expect(message.segments.some((segment) => segment.kind === "tool")).toBe(true);
    const toolSegment = message.segments.find((segment) => segment.kind === "tool");
    expect(toolSegment?.result).toBeUndefined();
  });

  it("preserves multiple text blocks from user array-based messages", () => {
    const record = whisperRecords.find((entry) => {
      if (entry.type !== "user") return false;
      const message = getMessage(entry);
      const content = message?.content;
      return Array.isArray(content) && content.every((block) => typeof (block as { type?: string }).type === "string");
    });
    expect(record).toBeTruthy();

    const event = coerceToRawEvent(record!);
    const nextState = processIncomingMessage(createBaseState(), event);
    expect(nextState.messages).toHaveLength(1);
    const message = nextState.messages[0];
    const originalContent = (getMessage(record!)!.content as Array<{ type: string }>).length;
    expect(message.segments).toHaveLength(originalContent);
    const textSegmentCount = message.segments.filter((segment) => segment.kind === "text").length;
    const originalTextCount = (getMessage(record!)!.content as Array<{ type: string }>).filter(
      (block) => block.type === "text",
    ).length;
    expect(textSegmentCount).toBe(originalTextCount);
  });

  it("attaches tool results from user events to the originating assistant tool call", () => {
    const assistantRecord = claudeRecords.find((entry) => {
      if (entry.type !== "assistant") return false;
      const message = getMessage(entry);
      const content = message?.content;
      return Array.isArray(content) && content.some((block) => (block as { type?: string })?.type === "tool_use");
    });
    const toolResultRecord = claudeRecords.find((entry) => {
      if (entry.type !== "user") return false;
      const message = getMessage(entry);
      const content = message?.content;
      return Array.isArray(content) && content.every((block) => (block as { type?: string })?.type === "tool_result");
    });
    expect(assistantRecord).toBeTruthy();
    expect(toolResultRecord).toBeTruthy();

    const assistantEvent = coerceToRawEvent(assistantRecord!);
    const toolResultEvent = coerceToRawEvent(toolResultRecord!);

    const intermediateState = processIncomingMessage(createBaseState(), assistantEvent);
    const nextState = processIncomingMessage(intermediateState, toolResultEvent);

    expect(nextState.messages).toHaveLength(1);
    const message = nextState.messages[0];
    const toolSegment = message.segments.find((segment) => segment.kind === "tool");
    expect(toolSegment?.result).toBeDefined();
    expect(toolSegment?.result?.is_error).toBe(false);
    expect(typeof toolSegment?.result?.content).toBe("string");
    expect(toolSegment?.result?.content).not.toHaveLength(0);
  });

  it("merges assistant segments that share a message id and retains tool results", () => {
    const toolRecords = loadTranscript(CLAUDE_TOOL_SESSION).filter(
      (entry) =>
        entry.type &&
        ["assistant", "user", "system", "result", "stream_event"].includes(entry.type),
    );

    let state = createBaseState();
    for (const record of toolRecords) {
      state = processIncomingMessage(state, coerceToRawEvent(record));
    }

    const mergedMessage = state.messages.find(
      (message) => message.id === "msg_20251012061347c87bde5048fc41d1",
    );
    expect(mergedMessage).toBeTruthy();
    expect(mergedMessage?.segments.some((segment) => segment.kind === "text")).toBe(true);
    const toolSegment = mergedMessage?.segments.find(
      (segment) => segment.kind === "tool" && segment.block.id === "call_9k6pupna9t",
    ) as ToolInvocationSegment | undefined;
    expect(toolSegment).toBeTruthy();
    expect(toolSegment?.result).toBeDefined();
    expect(toolSegment?.result?.is_error).toBe(false);
    expect(toolSegment?.result?.content).toContain("total 944");
  });

  it("preserves busy state and session metadata when processing system events", () => {
    const record = [...claudeRecords, ...whisperRecords, ...loadTranscript(LOCAL_COMMAND_SESSION)].find(
      (entry) => entry.type === "system",
    );
    expect(record).toBeTruthy();

    const systemEvent = coerceToRawEvent({
      type: "system",
      subtype: record!.subtype,
      session_id: record!.sessionId ?? record!.session_id,
      model: record!.model,
      timestamp: Date.now(),
    }) as SystemMessageEvent;

    const prevState: ChatSessionState = {
      ...createBaseState(),
      busy: false,
      sessionId: undefined,
    };

    const nextState = processIncomingMessage(prevState, systemEvent);
    expect(nextState.busy).toBe(false);
    if (systemEvent.session_id) {
      expect(nextState.sessionId).toBe(systemEvent.session_id);
    }
  });
});
