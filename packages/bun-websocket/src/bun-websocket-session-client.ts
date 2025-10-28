import type { ServerWebSocket } from "bun";
import type {
  IClaudeAgentSDKClient,
  ISessionClient,
  OutcomingMessage,
} from "@claude-agent-kit/server";

export class BunWebSocketSessionClient implements ISessionClient {
  sessionId: string | undefined;
  sdkClient: IClaudeAgentSDKClient;
  webSocket: ServerWebSocket<{ sessionId: string }>;

  constructor(
    sdkClient: IClaudeAgentSDKClient,
    webSocket: ServerWebSocket<{ sessionId: string }>,
    sessionId?: string,
  ) {
    this.sdkClient = sdkClient;
    this.webSocket = webSocket;
    this.sessionId = sessionId;
  }

  receiveSessionMessage(_event: string, message: OutcomingMessage): void {
    try {
      if (process.env.DEBUG?.includes("session-client")) {
        console.log(
          `[BunWebSocketSessionClient] sending ${message.type} for session ${message.sessionId ?? "unknown"}`,
        );
      }
      this.webSocket.send(JSON.stringify(message));
    } catch (error) {
      console.error("Failed to send Bun WebSocket message:", error);
    }
  }
}
