# @claude-agent-kit/websocket

WebSocket server utilities (Node `ws`) for streaming Claude Agent sessions to browsers or other real-time clients. Bridges JSON payloads over a single socket to a `SessionManager`/`Session` pair from `@claude-agent-kit/server`.

## Installation

```bash
pnpm add @claude-agent-kit/websocket ws
```

## Quick Start (Node + ws)

```ts
import { createServer as createHttpServer } from 'node:http'
import { WebSocketServer } from 'ws'
import { WebSocketHandler } from '@claude-agent-kit/websocket'
import { SimpleClaudeAgentSDKClient } from '@claude-agent-kit/server'

const httpServer = createHttpServer()
const wss = new WebSocketServer({ server: httpServer })
const sdkClient = new SimpleClaudeAgentSDKClient()
const handler = new WebSocketHandler(sdkClient, { thinkingLevel: 'default_on' })

wss.on('connection', (ws) => {
  void handler.onOpen(ws)
  ws.on('message', (data) => handler.onMessage(ws, String(data)))
  ws.on('close', () => handler.onClose(ws))
})

httpServer.listen(5173)
```

## Inbound Message Types

- `chat`: `{ type: 'chat', content: string, attachments?: AttachmentPayload[] }`
- `setSDKOptions`: `{ type: 'setSDKOptions', options: Partial<SessionSDKOptions> }`
- `resume`: `{ type: 'resume', sessionId: string }`

## Outbound Message Types

- `message_added`: `{ type: 'message_added', sessionId, message }`
- `messages_updated`: `{ type: 'messages_updated', sessionId, messages }`
- `session_state_changed`: `{ type: 'session_state_changed', sessionId, sessionState }`

Errors are serialized as `{ type: 'error', code?: string, error: string }`.

## Notes

- One `WebSocketHandler` instance can serve multiple clients/sessions. It uses `SessionManager` under the hood.
- To resume a known session after reconnect, send `{ type: 'resume', sessionId }` when the socket opens.
- See a production-like setup in `examples/claude-code-web`.
