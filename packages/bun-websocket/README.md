# @claude-agent-kit/bun-websocket

WebSocket server utilities for Bun (`ServerWebSocket`) that stream Claude Agent sessions to browsers or other clients. Pairs with `@claude-agent-kit/server` for session lifecycle and state.

## Installation

```bash
pnpm add @claude-agent-kit/bun-websocket
```

## Quick Start (Bun)

```ts
import "dotenv/config"
import path from 'node:path'
import { BunWebSocketHandler } from '@claude-agent-kit/bun-websocket'
import { SimpleClaudeAgentSDKClient, type SessionSDKOptions } from '@claude-agent-kit/server'

const sdkClient = new SimpleClaudeAgentSDKClient()
const options: SessionSDKOptions = {
  cwd: path.join(process.cwd(), 'agent'),
  thinkingLevel: 'default_on',
}
const handler = new BunWebSocketHandler(sdkClient, options)

const server = Bun.serve({
  port: 3000,
  websocket: {
    open(ws) { handler.onOpen(ws) },
    message(ws, data) { handler.onMessage(ws, data) },
    close(ws) { handler.onClose(ws) },
  },
  fetch(req, server) {
    const url = new URL(req.url)
    if (url.pathname === '/ws') {
      server.upgrade(req, { data: { sessionId: '' } })
      return
    }
    return new Response('OK')
  },
})
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

- Mirrors the behavior of `@claude-agent-kit/websocket` but targets Bun’s `ServerWebSocket` API and runtime.
- See `examples/basic-example` for a fuller setup with static assets and a simple React UI.
