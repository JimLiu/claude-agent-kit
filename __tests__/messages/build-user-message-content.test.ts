import { afterEach, describe, expect, it, vi } from "vitest";
import { buildUserMessageContent } from "../../src/messages/build-user-message-content";
import type { AttachmentPayload } from "../../src/types";

describe("buildUserMessageContent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates content blocks for supported attachments and appends the prompt", () => {
    const plainText = "Attachment text body";
    const attachments: AttachmentPayload[] = [
      {
        name: "diagram.png",
        mediaType: "image/png",
        data: Buffer.from("image-bytes").toString("base64"),
      },
      {
        name: "notes.txt",
        mediaType: "text/plain",
        data: Buffer.from(plainText, "utf-8").toString("base64"),
      },
      {
        name: "spec.pdf",
        mediaType: "application/pdf",
        data: Buffer.from("pdf bytes").toString("base64"),
      },
    ];

    const result = buildUserMessageContent("Summarize the attachment", attachments);

    expect(result).toEqual([
      {
        type: "image",
        source: {
          type: "base64",
          media_type: "image/png",
          data: attachments[0]!.data,
        },
      },
      {
        type: "document",
        source: {
          type: "text",
          media_type: "text/plain",
          data: plainText,
        },
        title: "notes.txt",
      },
      {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: attachments[2]!.data,
        },
        title: "spec.pdf",
      },
      {
        type: "text",
        text: "Summarize the attachment",
      },
    ]);
  });

  it("logs an error for unsupported attachments but still appends the prompt block", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const attachments: AttachmentPayload[] = [
      {
        name: "archive.zip",
        mediaType: "application/zip",
        data: "ZmFrZS1iaW5hcnk=",
      },
    ];

    const result = buildUserMessageContent("Only text should remain", attachments);

    expect(errorSpy).toHaveBeenCalledWith("Cannot processing file: archive.zip");
    expect(result).toEqual([
      {
        type: "text",
        text: "Only text should remain",
      },
    ]);
  });
});
