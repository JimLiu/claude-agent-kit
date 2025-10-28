import type { WebSocket } from "ws";
import type {
  IClaudeAgentSDKClient,
  ISessionClient,
  OutcomingMessage,
} from "@claude-agent-kit/server";


export class WebSocketSessionClient implements ISessionClient {
  sessionId: string | undefined;
  sdkClient: IClaudeAgentSDKClient;
  webSocket: WebSocket;

  constructor(sdkClient: IClaudeAgentSDKClient, webSocket: WebSocket, sessionId?: string) {
    this.sdkClient = sdkClient;
    this.webSocket = webSocket;
    this.sessionId = sessionId;
  }

  receiveSessionMessage(_event: string, message: OutcomingMessage): void {
    try {
      if (process.env.DEBUG?.includes("session-client")) {
        console.log(
          `[WebSocketSessionClient] sending ${message.type} for session ${message.sessionId ?? "unknown"}`,
        );
      }
      this.webSocket.send(JSON.stringify(message));
    } catch (error) {
      console.error("Failed to send WebSocket message:", error);
    }
  }
}
