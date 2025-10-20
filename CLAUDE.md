# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Main Library
```bash
npm install              # Install dependencies
npm run build            # Build TypeScript library (output to dist/)
npm run clean            # Remove dist directory
npm run lint             # Run linter (currently a placeholder)
```

### Examples
Examples have their own `package.json` files with independent dependencies:
```bash
cd examples/basic-example
bun run dev              # Start basic example development server

cd examples/claude-code-v0
bun run dev              # Start claude-code-v0 example development server
```

## Architecture

This is a utilities library built around `@anthropic-ai/claude-agent-sdk` that provides session management, message parsing, and WebSocket orchestration for building Claude-powered agents.

### Core Components

**1. Session Management (src/session-manager.ts, src/session.ts)**
- `SessionManager`: Central registry for all active/inactive sessions
  - Creates sessions via factory pattern (accepts client constructor)
  - Tracks sessions by ID and last modified time
  - Handles automatic cleanup of empty sessions after 5-minute grace period
- `Session`: Individual conversation with Claude
  - Maintains message history, todos, tools list, and usage metrics
  - Uses subscriber pattern for real-time updates (WebSocket clients subscribe)
  - Processes streaming SDK messages and updates internal state
  - Handles both new conversations and resuming from session IDs

**2. Message Processing Pipeline (src/chat-message.ts, src/message-parsing.ts)**
- `ChatMessage`/`ChatMessagePart`: Renderable message structures for UI consumption
  - Links tool use blocks with their corresponding tool results
  - Each part can carry both content and an optional tool result
- `appendRenderableMessage()`: Converts raw SDK messages to ChatMessage objects
  - Automatically links tool_result blocks back to their tool_use origins
  - Returns added/updated messages and tool result updates for broadcasting
- `coalesceReadMessages()`: Merges consecutive Read tool invocations into a single "ReadCoalesced" message for cleaner UI
- `parseUserFacingContent()`: Extracts structured content (slash commands, IDE selections, diagnostics, interrupts) from text blocks

**3. WebSocket Handler (src/websocket-handler.ts)**
- `WebSocketHandler`: Multi-client WebSocket server orchestration
  - Routes chat messages to appropriate sessions (creates or resumes)
  - Handles subscribe/unsubscribe messages for session-specific updates
  - Implements client ID tracking and automatic cleanup on disconnect
  - Broadcasts session messages only to subscribed clients

**4. SDK Client Abstraction (src/cas-client.ts)**
- `ClaudeAgentSDKClient`: Wraps `@anthropic-ai/claude-agent-sdk` query function
  - `queryStream()`: Streaming message generator for conversations
  - `getSession()`: Reads session history from `~/.claude/projects/` directory
  - Session file discovery prioritizes current working directory, then scans all projects
  - Normalizes session log entries (handles sessionId vs session_id field naming)

### Key Patterns

**Session State Synchronization**
Sessions track multiple sources of state derived from streaming messages:
- `todos`: Extracted from TodoWrite tool invocations (src/session.ts:514-524)
- `tools`: Extracted from system init messages (src/session.ts:488-491)
- `usageData`: Aggregated from assistant message usage blocks and result messages
- `permissionMode`: Set during session initialization
- All state changes trigger subscriber broadcasts

**Broadcast Message Types**
Sessions emit typed broadcast messages to subscribers (src/session.ts:25-98):
- `session_info`: Metadata updates (message count, active status)
- `messages_loaded`: Full message history after loading from server
- `message_added/updated/removed`: Incremental message changes
- `todos_updated`: Todo list changes
- `tools_updated`: Available tools list changes
- `tool_result_updated`: Tool execution results
- `usage_updated`: Token/cost updates

**Message Diffing**
The session maintains previous and next message arrays and computes diffs to emit granular updates (src/session.ts:388-438). This ensures WebSocket clients receive only changed messages rather than full history on every update.

**Tool Use/Result Linking**
Tool invocations and results arrive in separate messages:
- tool_use blocks appear in assistant messages
- tool_result blocks appear in subsequent user messages
- `appendRenderableMessage()` searches backward through messages to find matching tool_use by ID and attaches the result (src/chat-message.ts:146-170)

## Important Context

**Session File Format**
- Sessions persist as JSONL files in `~/.claude/projects/<project-id>/<session-id>.jsonl`
- Each line is a JSON-serialized SDK message with timestamp
- Client handles field name normalization (sessionId → session_id)

**Peer Dependency**
This library requires `@anthropic-ai/claude-agent-sdk@>=0.1.0` as a peer dependency. The SDK is not bundled, allowing applications to control the exact SDK version.

**Streaming Flow**
1. User sends message → WebSocketHandler routes to Session
2. Session calls `client.queryStream()` → yields SDK messages
3. Session processes each message via `processIncomingMessage()`:
   - Updates internal state (todos, tools, usage)
   - Converts to ChatMessage via `appendRenderableMessage()`
   - Coalesces Read operations via `coalesceReadMessages()`
   - Computes message diffs
   - Broadcasts changes to subscribers
4. WebSocketHandler forwards broadcasts to subscribed clients

**Export Structure** (src/index.ts)
Main exports include:
- Classes: `SessionManager`, `Session`, `WebSocketHandler`, `ClaudeAgentSDKClient`, `ChatMessage`, `ChatMessagePart`
- Functions: `buildUserMessageContent`, `parseUserFacingContent`, `appendRenderableMessage`, `coalesceReadMessages`, `getToolUseStatus`
- Types: All SDK message types, content blocks, and parsed content types
