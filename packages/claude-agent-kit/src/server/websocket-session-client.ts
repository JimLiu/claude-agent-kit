import type { WebSocket } from "ws";
import type { IClaudeAgentSDKClient, ISessionClient, OutcomingMessage } from "../types";


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
      this.webSocket.send(JSON.stringify(message));
    } catch (error) {
      console.error("Failed to send WebSocket message:", error);
    }
  }
}