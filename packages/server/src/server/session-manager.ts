import { Session } from "./session";
import type { AttachmentPayload } from "@claude-agent-kit/messages";
import type {
  IClaudeAgentSDKClient,
  ISessionClient,
  SessionSDKOptions,
} from "../types";


export class SessionManager {

  /** List of known sessions, including inactive ones. */
  private sessionsList: Session[] = [];

  get sessions(): Session[] {
    return this.sessionsList;
  }

  /** Sessions sorted by last modification time, useful for quick-select menus. */
  get sessionsByLastModified(): Session[] {
    return [...this.sessionsList].sort(
      (left, right) => right.lastModifiedTime - left.lastModifiedTime,
    );
  }

  /** Look up a session by its Claude session id */
  getSession(sessionId: string, shouldLoadMessages = false): Session | undefined {
    const existing = this.sessionsList.find(
      (session) => session.sessionId === sessionId,
    );

    if (existing && shouldLoadMessages) {
      void existing.resumeFrom(sessionId);
    }

    return existing;
  }

  createSession(sdkClient: IClaudeAgentSDKClient): Session {
    const session = new Session(sdkClient);
    this.sessionsList.push(session);
    return session;
  }

  getOrCreateSession(client: ISessionClient): Session {
    let session = client.sessionId ? this.getSession(client.sessionId) : undefined;

    if (!session) {
      session = this.sessionsList.find((existing) => existing.hasClient(client));
    }

    if (!session) {
      session = this.createSession(client.sdkClient);
      // Update the client's sessionId to match the newly created session
      client.sessionId = session.sessionId || undefined;
    }
    return session;
  }


  subscribe(client: ISessionClient) {
    const session = this.getOrCreateSession(client);
    session.subscribe(client);
  }

  unsubscribe(client: ISessionClient): void {
    const session = client.sessionId ? this.getSession(client.sessionId) : undefined;
    if (!session) {
      return;
    }
    session.unsubscribe(client);
  }

  sendMessage(
    client: ISessionClient, 
    prompt: string,
    attachments: AttachmentPayload[] | undefined
  ): void {
    const session = this.getOrCreateSession(client);
    session.subscribe(client);
    session.send(prompt, attachments);
  }

  setSDKOptions(
    client: ISessionClient,
    options: Partial<SessionSDKOptions>
  ): void {
    const session = this.getOrCreateSession(client);
    session.setSDKOptions(options);
  }
}
