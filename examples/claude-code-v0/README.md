# Claude Agent SDK Web Preview

This example project demonstrates a minimal, end-to-end integration of `@anthropic-ai/claude-agent-sdk` that behaves like a lightweight version of v0.dev: you can chat with Claude, let it generate a React + Tailwind UI, and watch the resulting page update in real time.

## Demo


[Demo](screenshots/claude-code-v0.mp4)
<img width="1947" height="1259" alt="image" src="https://github.com/user-attachments/assets/046db1ec-b16a-4b5c-b09c-15076e16d1d4" />


## Key Features
- **Chat-driven UI generation**: A single-page React client streams conversation events over WebSocket and renders Claude's partial responses as they arrive.
- **Live workspace preview**: Each agent session operates inside its own sandbox, and the client mirrors those files into an embedded Sandpack playground for instant feedback.
- **Claude agent orchestration**: The Bun server wraps the Claude Agent SDK, forwards user prompts, and streams tool output back to the browser.
- **Prompt and workspace controls**: The default system prompt lives in `ccsdk/agent-prompt.ts`, while `.agent` stores session workspaces cloned from the `./agent` template directory.

## Project Layout
- `client/`: React interface with chat, message rendering, and the Sandpack-based preview panel.
- `server/`: Bun runtime exposing the WebSocket endpoint (`/ws`) plus REST helpers for workspace sync.
- `ccsdk/`: Claude SDK glue code, including the `AIClient`, `Session` lifecycle manager, and WebSocket handler.
- `shared/`: Cross-runtime TypeScript types for chat messages, attachments, and session state.
- `agent/`: Seed files copied into every new session workspace.
- `.agent/`: Auto-generated at runtime; holds per-session working directories that the agent edits.

## How It Works
1. The browser connects to `ws://localhost:3000/ws`, displays existing session state, and posts user prompts.
2. `server/server.ts` wires the WebSocket to `ccsdk/websocket-handler.ts`, which creates or resumes a `Session`.
3. Each `Session` delegates to `ccsdk/ai-client.ts`, forwarding the user prompt (along with the system prompt from `ccsdk/agent-prompt.ts`) to `@anthropic-ai/claude-agent-sdk`.
4. Streaming responses are broadcast to all subscribers, while filesystem edits are written into `.agent/<sessionId>`.
5. A file watcher reports workspace changes through `workspace_update` messages; the client consumes them and feeds the files into Sandpack for live preview or inspection.

## Getting Started
1. Install Bun (>=1.1) and ensure your `ANTHROPIC_API_KEY` is available in the environment (or an `.env` file that `dotenv` can load).
2. Install dependencies:
   ```bash
   bun install
   ```
3. Start the development server:
   ```bash
   bun run dev
   ```
   The UI is available at `http://localhost:3000`, and the WebSocket endpoint lives at `ws://localhost:3000/ws`.

### Additional Commands
- Run the production build: `bun run build`
- Execute tests: `bun run test`
- Watch tests: `bun run test:watch`
- Coverage report: `bun run test:coverage`

## Customizing the Agent
- **System prompt**: Edit `ccsdk/agent-prompt.ts` to update the instructions Claude receives before each session.
- **Session template**: Populate `agent/` with any starter files (assets, React components, etc.). They are copied into the `.agent/<sessionId>` workspace whenever a new session is created.
- **Workspace rules**: Review `ccsdk/utils/session-workspace.ts` and related utilities if you want to change which files are synchronized or how the sandbox behaves.

## Notes
- The server uses Bun's native `Bun.serve` and PostCSS pipeline to deliver compiled CSS and TypeScript directly during development.
- The preview leverages `@codesandbox/sandpack-react`, so Tailwind classes render immediately via the CDN-loaded runtime.
- `.agent/` contents are disposable and regenerated per session; add it to your git ignore list if you plan to track changes in version control.
