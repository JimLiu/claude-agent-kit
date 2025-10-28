# @claude-agent-kit/messages

Utilities and types for working with Claude Agent streaming transcripts. Provides helpers to build user content blocks (prompt + attachments), normalize/append SDK messages into UI-friendly chat messages, and coalesce noisy sequences (e.g., multiple Read tool calls) for better rendering.

- Peer dependency: `@anthropic-ai/claude-agent-sdk`
- Works in both Node and the browser

## Installation

```bash
pnpm add @claude-agent-kit/messages
```

## Quick Start

Build user content blocks (prompt + attachments) compatible with the Claude Agent SDK:

```ts
import { buildUserMessageContent, type AttachmentPayload } from '@claude-agent-kit/messages'

const attachments: AttachmentPayload[] = [
  {
    name: 'diagram.png',
    mediaType: 'image/png',
    data: '<base64-bytes>',
  },
]

const content = buildUserMessageContent('Summarize this image', attachments)
// pass `content` into the SDK user message
```

Convert/append SDK messages into chat messages for rendering:

```ts
import {
  appendRenderableMessage,
  convertSDKMessages,
  coalesceReadMessages,
  type ChatMessage,
} from '@claude-agent-kit/messages'
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'

// Convert a whole transcript
const chatMessages: ChatMessage[] = convertSDKMessages(sdkMessages)

// Stream updates: append one SDK message at a time
const working: ChatMessage[] = [...chatMessages]
const { addedMessage, updatedMessages } = appendRenderableMessage(working, incomingSdkMessage)

// Optional: condense consecutive successful Read tool uses
const condensed = coalesceReadMessages(working)
```

## API Surface

- Message building
  - `buildUserMessageContent(prompt, attachments)`
- Message shaping
  - `appendRenderableMessage(messages, incoming)`
  - `convertSDKMessages(sdkMessages)`
  - `coalesceReadMessages(messages)`
- Types
  - Content blocks: `TextContentBlock`, `ImageContentBlock`, `DocumentContentBlock`, `ToolUseContentBlock`, `ToolResultContentBlock`
  - Chat model: `ChatMessage`, `ChatMessagePart`
  - Attachments: `AttachmentPayload`

## Notes

- Images (jpeg/png/gif/webp) are inlined as base64 image blocks.
- Plain text attachments are decoded and added as document blocks.
- PDFs are passed through as base64 document blocks.

## See Also

- Top-level System Design section in the root `README.md` for architecture and flows.
- Real-world usage: `examples/claude-code-web` (message rendering), `examples/basic-example`.
