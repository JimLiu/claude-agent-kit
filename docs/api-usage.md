# Claude Agent Kit — WebSocket API Guide

This document describes the WebSocket message protocol, how to integrate the `WebSocketHandler` on the server, and how clients send/receive chat events and session updates.

## Server Integration

Example using the `ws` library in Node.js:

import { WebSocketServer } from "ws";
import { WebSocketHandler } from "@claude-agent-kit/websocket";
import { SimpleClaudeAgentSDKClient } from "@claude-agent-kit/server";
import type { SessionSDKOptions } from "@claude-agent-kit/server";

const wss = new WebSocketServer({ port: 8787 });

const sessionOptions: SessionSDKOptions = {
  maxTurns: 100,
  thinkingLevel: "default_on",
};

const handler = new WebSocketHandler(
  new SimpleClaudeAgentSDKClient(),
  sessionOptions,
);

wss.on("connection", (ws) => {
  handler.onOpen(ws);

  ws.on("message", (data) => {
    handler.onMessage(ws, data.toString());
  });

  ws.on("close", () => {
    handler.onClose(ws);
  });
});
```

Notes

- Each socket is wrapped in a `WebSocketSessionClient` and subscribed to a Session via `SessionManager`.
- `WebSocketHandler` delegates Claude API calls to an `IClaudeAgentSDKClient`. The default helper, `SimpleClaudeAgentSDKClient`, is exported from `@claude-agent-kit/server` and can be replaced with your own implementation.

## Protocol Overview

- Transport: WebSocket text frames with JSON payloads.
- Direction:
  - Client → Server: control and chat messages.
  - Server → Client: session notifications and control messages.
- Sessions:
  - A session is implicitly created and bound upon first `chat` if none exists.
  - When the Claude SDK emits a `session_id`, the server propagates it to subscribed clients in all subsequent events.

## Client → Server Messages

All messages include a `type` field.

### Chat

Initiate or continue a conversation. Empty `content` is rejected.

```json
{
  "type": "chat",
  "content": "Summarize the last commit.",
  "attachments": [
    {
      "name": "screenshot.png",
      "mediaType": "image/png",
      "data": "<base64>"
    }
  ]
}
```

Attachments

- Shape: `{ name: string, mediaType: string, data: base64-string }`.
- Supported by default in `buildUserMessageContent`:
  - Inline images: `image/jpeg`, `image/png`, `image/gif`, `image/webp`
  - Text: `text/plain` (decoded and embedded as a document block)
  - PDF: `application/pdf` (kept as base64)

### Set Permission Mode

Adjusts the permission mode passed through to the underlying Claude Agent SDK. Values are defined by the SDK.

```json
{
  "type": "setPermissionMode",
  "mode": "default"
}
```

### Set Thinking Level

Toggles reasoning depth used by the agent orchestration. Current values: `"off" | "default_on"`.

```json
{
  "type": "setThinkingLevel",
  "value": "default_on"
}
```

## Server → Client Messages

### Connected (control)

Sent once on successful connection.

```json
{ "type": "connected", "message": "Connected to the Claude Code WebSocket server." }
```

### Error (control)

Format for protocol/validation errors.

```json
{ "type": "error", "error": "Message content cannot be empty", "code": "empty_message" }
```

Possible `code` values today:

- `unsupported_message_type`
- `empty_message`

### Session Events (streaming)

All session events include the current `sessionId` (or `null` before assignment):

```json
{ "type": "session_state_changed", "sessionId": null, "sessionState": { "isBusy": true, "permissionMode": "default" } }
{ "type": "message_added", "sessionId": "abc123", "message": { "type": "assistant", "message": { "content": [ { "type": "text", "text": "…" } ] } } }
{ "type": "messages_updated", "sessionId": "abc123", "messages": [ /* SDKMessage[] */ ] }
```

Notes

- `message_added` is emitted for every streamed `SDKMessage` (assistant, system, result, stream_event) passed through from the SDK.
- `session_state_changed` batches updates for `isBusy`, `isLoading`, `permissionMode`, and `thinkingLevel`; clients can merge these partial updates into their local session state.
- Clients should treat the stream as append‑only and render incrementally.

## Typical Client Usage

```js
const ws = new WebSocket("ws://localhost:8787");

ws.addEventListener("open", () => {
  ws.send(JSON.stringify({ type: "chat", content: "Hello!" }));
});

ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  switch (msg.type) {
    case "connected":
      console.log("connected");
      break;
    case "message_added":
      // append msg.message to transcript
      break;
    case "messages_updated":
      // replace transcript with msg.messages
      break;
    case "session_state_changed":
      // update session UI (isBusy, isLoading, permissionMode, thinkingLevel, etc.)
      break;
    case "error":
      console.error(msg.error);
      break;
  }
});
```

## Sequencing and Sessions

- A socket can receive many events for the same Session; multiple sockets can subscribe to the same Session.
- The first time a Session receives a streamed message with a `session_id`, the server syncs that id to all subscribers; clients can persist it locally.
- To hydrate historical messages for a known session id on reconnect, extend the protocol with a `resume` message that calls `SessionManager.getSession(id, /*shouldLoad=*/true)` or `Session.resumeFrom(id)`; the plumbing is already implemented server‑side.

## Security and Transport

- Prefer WSS in production and validate message sizes (especially attachments).
- Apply authentication/authorization at the WebSocket handshake and map principals to Sessions as appropriate for your app.
