type ChatHeaderProps = {
  sessionId: string | null
  isConnected: boolean
  connectionMessage: string | null
}

export function ChatHeader({
  sessionId,
  isConnected,
  connectionMessage,
}: ChatHeaderProps) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            Claude Code Chat
          </h1>
          <p className="text-sm text-slate-500">
            {sessionId ? `Session • ${sessionId}` : 'New session'}
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${
              isConnected
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-200 text-slate-600'
            }`}
          >
            <span className="inline-block h-2 w-2 rounded-full bg-current" />
            {isConnected ? 'Online' : 'Offline'}
          </span>
          {connectionMessage ? (
            <span className="text-xs text-slate-400">{connectionMessage}</span>
          ) : null}
        </div>
      </div>
    </header>
  )
}
