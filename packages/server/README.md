# @claude-agent-kit/server

Session lifecycle and streaming utilities that wrap `@anthropic-ai/claude-agent-sdk`. Provides a `Session` that manages options, message history, busy/loading state, and fan-out to subscribed clients; a `SessionManager` to handle multi-session routing; and a simple SDK client implementation you can replace.

- Peer dependency: `@anthropic-ai/claude-agent-sdk`
- Exposes clean types/interfaces to plug in your own SDK client

## Installation

```bash
pnpm add @claude-agent-kit/server
```

## Quick Start

```ts
import {
  SessionManager,
  SimpleClaudeAgentSDKClient,
  type SessionSDKOptions,
} from '@claude-agent-kit/server'

const sdkClient = new SimpleClaudeAgentSDKClient()
const manager = new SessionManager()
const session = manager.createSession(sdkClient)

// Optional: configure SDK options for this session
const options: Partial<SessionSDKOptions> = {
  cwd: process.cwd(),
  thinkingLevel: 'default_on',
}
session.setSDKOptions(options)

// Send a prompt (attachments optional)
await session.send('Hello Claude', undefined)

// Access the transcript
console.log(session.sessionId, session.messages.length, session.isBusy)
```

Resume an existing session and read history from local logs:

```ts
await session.resumeFrom('your-session-id')
console.log(session.messages)
```

## Concepts

- `Session` – Orchestrates streaming with the SDK, tracks:
  - `messages`: raw SDK messages
  - `isBusy` / `isLoading`: derived from stream events
  - `lastModifiedTime`, `summary`, `error`
  - emits updates to subscribed `ISessionClient`s
- `SessionManager` – Creates or looks up sessions, routes `send`, `setSDKOptions`, and subscribe/unsubscribe.
- `IClaudeAgentSDKClient` – Interface for the underlying SDK client used by `Session`.
- `SimpleClaudeAgentSDKClient` – Minimal implementation of `IClaudeAgentSDKClient` using `query()` and local JSONL file loading.

## Implement your own SDK client

```ts
import type { IClaudeAgentSDKClient } from '@claude-agent-kit/server'
import type { SDKMessage, SDKUserMessage, Options as SDKOptions } from '@anthropic-ai/claude-agent-sdk'

class MyClient implements IClaudeAgentSDKClient {
  async *queryStream(prompt: string | AsyncIterable<SDKUserMessage>, options?: Partial<SDKOptions>): AsyncIterable<SDKMessage> {
    // call your transport and yield SDKMessage objects
  }
  async loadMessages(sessionId: string): Promise<{ messages: SDKMessage[] }> {
    // restore from your store
    return { messages: [] }
  }
}
```

## Related

- Transport bridges:
  - Node: `@claude-agent-kit/websocket`
  - Bun: `@claude-agent-kit/bun-websocket`
- Message shaping: `@claude-agent-kit/messages`
