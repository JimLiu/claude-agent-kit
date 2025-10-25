import { describe, expect, it, vi } from "vitest";
import { SessionManager } from "./session-manager";
import type { AttachmentPayload, IClaudeAgentSDKClient, ISessionClient, PermissionMode, ThinkingLevel } from "./types";

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

  it("updates permission mode and thinking level through the active session", () => {
    const manager = new SessionManager();
    const client = createMockSessionClient(createMockSdkClient());
    const session = manager.getOrCreateSession(client);
    session.sessionId = "session-permission";
    client.sessionId = "session-permission";
    const permissionSpy = vi.spyOn(session, "setPermissionMode");
    const thinkingSpy = vi.spyOn(session, "setThinkingLevel");

    manager.setPermissionMode(client, "default" as PermissionMode, true);
    manager.setThinkingLevel(client, "default_on" as ThinkingLevel);

    expect(permissionSpy).toHaveBeenCalledWith("default", true);
    expect(thinkingSpy).toHaveBeenCalledWith("default_on");
  });
});
