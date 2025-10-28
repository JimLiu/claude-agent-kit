import { describe, expect, it, vi } from "vitest";
import { SessionManager } from "../src/server/session-manager";
import type { AttachmentPayload } from "@claude-agent-kit/messages";
import type {
  IClaudeAgentSDKClient,
  ISessionClient,
  SessionSDKOptions,
} from "../src/types";

function createMockSdkClient(): IClaudeAgentSDKClient {
  return {
    queryStream: vi.fn(),
    loadMessages: vi.fn().mockResolvedValue({ messages: [] }),
  };
}

function createMockSessionClient(sdkClient: IClaudeAgentSDKClient): ISessionClient {
  return {
    sessionId: undefined,
    sdkClient,
    receiveSessionMessage: vi.fn(),
  };
}

describe("SessionManager", () => {
  it("creates and retrieves sessions", () => {
    const manager = new SessionManager();
    const client = createMockSessionClient(createMockSdkClient());

    const session = manager.getOrCreateSession(client);

    expect(manager.sessions).toContain(session);
    expect(manager.getSession(session.sessionId ?? "")).toBeUndefined();

    session.sessionId = "session-123";
    expect(manager.getSession("session-123")).toBe(session);
  });

  it("sorts sessions by lastModifiedTime", () => {
    const manager = new SessionManager();
    const client = createMockSessionClient(createMockSdkClient());
    const sessionA = manager.getOrCreateSession(client);
    sessionA.lastModifiedTime = 1;
    const sessionB = manager.createSession(createMockSdkClient());
    sessionB.lastModifiedTime = 5;

    expect(manager.sessionsByLastModified).toEqual([sessionB, sessionA]);
  });

  it("delegates chat messages to the underlying session", () => {
    const manager = new SessionManager();
    const client = createMockSessionClient(createMockSdkClient());
    const session = manager.getOrCreateSession(client);
    session.sessionId = "session-abc";
    client.sessionId = "session-abc";
    const sendSpy = vi.spyOn(session, "send").mockResolvedValue(undefined);

    const attachments: AttachmentPayload[] = [];
    manager.sendMessage(client, "hi", attachments);

    expect(sendSpy).toHaveBeenCalledWith("hi", attachments);
  });

  it("updates SDK options through the active session", () => {
    const manager = new SessionManager();
    const client = createMockSessionClient(createMockSdkClient());
    const session = manager.getOrCreateSession(client);
    session.sessionId = "session-options";
    client.sessionId = "session-options";
    const optionsSpy = vi.spyOn(session, "setSDKOptions");

    const partialOptions: Partial<SessionSDKOptions> = { thinkingLevel: "default_on" };
    manager.setSDKOptions(client, partialOptions);

    expect(optionsSpy).toHaveBeenCalledWith(partialOptions);
  });
});
