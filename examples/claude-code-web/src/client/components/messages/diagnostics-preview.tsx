import type { ParsedDiagnosticsContent, DiagnosticEntry } from '../../lib/message-parsing'
import type { ClaudeMessageContext } from './types'
import { UserMessageSecondaryLine } from './user-message-secondary-line'

type DiagnosticsPreviewProps = {
  parsed: ParsedDiagnosticsContent
  context: ClaudeMessageContext
}

export function DiagnosticsPreview({ parsed, context }: DiagnosticsPreviewProps) {
  const handleClick = () => {
    const formatted = formatDiagnostics(parsed.diagnostics)
    context.fileOpener.openContent(formatted, 'Diagnostics: VSCode Problems', false)
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-baseline gap-2">
        <span className="font-bold">Diagnostics</span>
        <span className="flex-1 min-w-0 break-all pt-[1px] font-mono text-xs">
          VSCode Problems
        </span>
      </div>
      <UserMessageSecondaryLine onClick={handleClick}>
        Found {parsed.diagnostics.length} new problem
        {parsed.diagnostics.length !== 1 ? 's' : ''}
      </UserMessageSecondaryLine>
    </div>
  )
}

function formatDiagnostics(diagnostics: DiagnosticEntry[]): string {
  const byFile = new Map<string, DiagnosticEntry[]>()
  diagnostics.forEach((entry) => {
    const list = byFile.get(entry.filePath) ?? []
    list.push(entry)
    byFile.set(entry.filePath, list)
  })

  const lines: string[] = []

  byFile.forEach((entries, filePath) => {
    lines.push(`${filePath}:`)
    entries.forEach((entry) => {
      const severitySymbol = diagnosticsSeveritySymbols[entry.severity.toLowerCase()] ?? '•'
      const code = entry.code ? ` [${entry.code}]` : ''
      lines.push(
        `  ${severitySymbol} [Line ${entry.line}:${entry.column}] ${entry.message}${code} (${entry.severity})`
      )
    })
    lines.push('')
  })

  return lines.join('\n')
}

const diagnosticsSeveritySymbols: Record<string, string> = {
  error: '✖',
  warning: '⚠',
  info: 'ℹ',
  hint: '•',
}
