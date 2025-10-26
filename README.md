# Claude Agent Kit

Utilities, patterns, and examples built around `@anthropic-ai/claude-agent-sdk`. The toolkit streamlines session management, message parsing, and upcoming UI primitives so you can stand up Claude-powered agents quickly.

- **Session lifecycle helpers** for keeping local state in sync with Claude.
- **Message parsing utilities** that normalize Claude streaming payloads.
- **WebSocket orchestration** for multi-client real-time experiences.
- **Examples and UI groundwork** to accelerate new agent surfaces.

> ℹ️ The package currently targets `@anthropic-ai/claude-agent-sdk@^0.1.0`. Adjust the version in `package.json` to match the SDK release you are using.

## Getting Started

```bash
pnpm install
pnpm run build
```

Import the pieces you need from the top-level entry point:

```ts
import {
  SessionManager,
  WebSocketHandler,
  buildUserMessageContent,
} from "claude-agent-kit";
```

## Quick Usage Example

```ts
import { SessionManager, ClaudeAgentSDKClient } from "claude-agent-kit";

const sessionManager = new SessionManager(() => new ClaudeAgentSDKClient({
  cwd: process.cwd(),
}));

const session = sessionManager.createSession();
await session.send("List the open pull requests in this repo.", undefined);

for (const message of session.messages) {
  console.log(`[${message.type}]`, message.content.map((part) => part.content));
}
```

## Testing

```bash
pnpm test
```

The Vitest configuration only scans `src/**/*.{test,spec}.{ts,tsx}` so you can colocate tests with the implementation without affecting the published build artifacts. Use `pnpm run test:watch` for an interactive loop.

## Contributing

1. Fork the repository.
2. Install dependencies with `pnpm install`.
3. Run `pnpm run build` and open a pull request with your changes.

## License

This project is licensed under the MIT License. See `LICENSE` for details.
