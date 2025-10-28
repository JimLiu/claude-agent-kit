import type { ClaudeMessageContext } from './types'

type EmptyStateProps = {
  context: ClaudeMessageContext
}

export function EmptyState(_: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-10 text-center text-muted-foreground">
      <div className="text-4xl">💡</div>
      <div className="max-w-md space-y-2">
        <h2 className="text-lg font-semibold">Welcome to Claude Code</h2>
        <p className="text-sm leading-6">
          Ask about the current project or let Claude help you build new features. You can also paste code snippets or
          upload attachments, and Claude will show the full conversation here.
        </p>
      </div>
    </div>
  )
}
