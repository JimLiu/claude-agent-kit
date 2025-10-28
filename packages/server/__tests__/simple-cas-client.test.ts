import { afterEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import { parseSessionMessagesFromJsonl, readSessionMessages } from "../src/server/simple-cas-client";

describe("parseSessionMessagesFromJsonl", () => {
  it("parses JSONL content, normalizes session_id, and skips summaries", () => {
    const jsonl = [
      JSON.stringify({
        type: "assistant",
        sessionId: "ABC",
        message: { type: "text", content: "hi" },
      }),
      JSON.stringify({
        type: "SUMMARY",
        sessionId: "ABC",
        message: { type: "summary", text: "skip" },
      }),
      "not-json",
      JSON.stringify({
        type: "user",
        sessionId: "XYZ",
        message: { type: "text", content: "hello" },
      }),
    ].join("\n");

    const messages = parseSessionMessagesFromJsonl(jsonl);

    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      type: "assistant",
      session_id: "ABC",
      message: { type: "text", content: "hi" },
    });
    expect(messages[1]).toMatchObject({
      type: "user",
      session_id: "XYZ",
    });
  });

  it("returns an empty array when the file content is empty", () => {
    expect(parseSessionMessagesFromJsonl(""))
      .toEqual([]);
  });
});

describe("readSessionMessages", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns parsed messages when the file exists", async () => {
    const jsonl = JSON.stringify({
      type: "assistant",
      sessionId: "abc",
      message: { type: "text", content: "hello" },
    });
    vi.spyOn(fs, "readFile").mockResolvedValue(jsonl);

    const messages = await readSessionMessages("/tmp/session.jsonl");

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      type: "assistant",
      session_id: "abc",
    });
  });

  it("swallows ENOENT errors and returns an empty array", async () => {
    const enoent = Object.assign(new Error("Not found"), { code: "ENOENT" });
    vi.spyOn(fs, "readFile").mockRejectedValue(enoent);

    expect(await readSessionMessages("/tmp/missing.jsonl")).toEqual([]);
  });
});
