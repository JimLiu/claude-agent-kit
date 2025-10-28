# Claude Agent Kit — Web Example (Express + Vite + ws)

A full-stack example that streams Claude Agent sessions over WebSockets using `@claude-agent-kit/server` and `@claude-agent-kit/websocket`, served via Express with a Vite-powered client.

## Features
- Express server with `ws` WebSocket bridge
- React client with reconnect + resume support
- Session lifecycle via `SessionManager`/`Session`
- Clean separation of server and client code

## Prerequisites
- Node.js 18+
- An Anthropic API key exported as `ANTHROPIC_API_KEY`

## Getting Started
```bash
pnpm install
export ANTHROPIC_API_KEY=your-key-here
cd examples/claude-code-web
pnpm dev
# open http://localhost:5173
```

Build for production:
```bash
pnpm build
pnpm preview
```

## Server Wiring (simplified)
```ts
// src/server/server.ts
import { createServer as createHttpServer } from 'node:http'
import express from 'express'
import { WebSocketServer } from 'ws'
import { SimpleClaudeAgentSDKClient } from '@claude-agent-kit/server'
import { WebSocketHandler } from '@claude-agent-kit/websocket'

export async function createServer() {
  const app = express()
  const httpServer = createHttpServer(app)
  const wss = new WebSocketServer({ server: httpServer })
  const sdkClient = new SimpleClaudeAgentSDKClient()
  const wsHandler = new WebSocketHandler(sdkClient, { thinkingLevel: 'default_on' })

  wss.on('connection', (ws) => {
    void wsHandler.onOpen(ws)
    ws.on('message', (data) => wsHandler.onMessage(ws, String(data)))
    ws.on('close', () => wsHandler.onClose(ws))
  })

  return { app, httpServer, wss }
}
```

## Client Usage (hook)
A robust browser hook with auto-reconnect and session resume is provided:
`src/client/hooks/use-web-socket.ts`.

Minimal usage:
```ts
import { useWebSocket } from './hooks/use-web-socket'

const { isConnected, sendMessage, setSDKOptions } = useWebSocket({
  url: 'ws://localhost:5173',
  onMessage: (payload) => console.log(payload),
})

// send a chat message
sendMessage({ type: 'chat', content: 'Hello Claude!' })

// update SDK options
setSDKOptions({ thinkingLevel: 'default_on' })
```

## WebSocket Payloads
Inbound messages:
- chat: `{ type: 'chat', content: string, attachments?: AttachmentPayload[] }`
- setSDKOptions: `{ type: 'setSDKOptions', options: Partial<SessionSDKOptions> }`
- resume: `{ type: 'resume', sessionId: string }`

Outbound messages:
- message_added: `{ type: 'message_added', sessionId, message }`
- messages_updated: `{ type: 'messages_updated', sessionId, messages }`
- session_state_changed: `{ type: 'session_state_changed', sessionId, sessionState }`

Errors are serialized as: `{ type: 'error', code?: string, error: string }`.

## Customize
- Default SDK options: adjust when constructing `WebSocketHandler`.
- Client resume: include `{ type: 'resume', sessionId }` after reconnect to reload history.
- Message rendering: see `src/client/components` for mapping content blocks to UI.
