# Repository Guidelines

## Project Structure & Module Organization
- `client/` houses the React UI; place components in `client/components`, context in `client/context`, hooks in `client/hooks`, and utilities in `client/utils`.
- `server/` is the Bun runtime: HTTP handlers, WebSocket flows, and any Bun-specific fixtures stay beside their modules.
- `ccsdk/` exposes Claude SDK adapters (`ai-client.ts`, `websocket-handler.ts`) shared by both the UI and server orchestration.
- `shared/` holds cross-runtime types and helpers; import with the `@/*` alias configured in `tsconfig.json`.
- `agent/CLAUDE.MD` captures prompt changes—keep it updated whenever workflows or capabilities shift.

## Build, Test, and Development Commands
- `bun install` pins the Bun runtime dependencies—run after pulling `package.json`.
- `bun run dev` starts the local agent server at `ws://localhost:3000`; hot reload covers client and server.
- `bun run build` emits production assets to `dist/`; inspect output before tagging a release.
- `bun run test`, `bun run test:watch`, and `bun run test:coverage` execute the Jest suite, watch mode, and coverage report respectively.

## Coding Style & Naming Conventions
- Write TypeScript with 2-space indentation, trailing commas where valid, and ESLint defaults from the repo.
- React files use lowercase dash filenames (e.g., `chat-interface.tsx`) while exporting PascalCase components.
- Favor named exports, colocate component-specific styles, and rely on Tailwind utility classes; run `bunx knip` to catch unused symbols.
- Keep shared helpers in `client/lib` or `shared/` and surface them through existing path aliases.

## Testing Guidelines
- Author Jest tests beside implementations (`*.test.ts`), covering session lifecycle, WebSocket reliability, and SDK fallbacks.
- Maintain ≥80% statement coverage; regenerate reports with `bun run test:coverage` before merging.
- Mock external services (Claude SDK, network calls) to guarantee deterministic results and document assumptions inline.

## Commit & Pull Request Guidelines
- Follow the existing history: short, imperative commit subjects (`add ws heartbeat`, `refine prompts`), with optional body context.
- Reference issues in PR descriptions, list validation commands, and attach UI screenshots for visible changes.
- Note breaking changes or migrations in both the PR body and `AGENTS.md`, and sync prompt updates with `agent/CLAUDE.MD`.
