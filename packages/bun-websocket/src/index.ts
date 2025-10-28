import type { ServerWebSocket } from "bun";

export type WSClient = ServerWebSocket<{ sessionId: string }>;

export { BunWebSocketHandler } from "./bun-websocket-handler";
export { BunWebSocketSessionClient } from "./bun-websocket-session-client";
