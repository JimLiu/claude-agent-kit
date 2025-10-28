import type { MessageContentBlock } from '@claude-agent-kit/messages'

export type ParsedInterruptContent = {
  type: 'interrupt'
  message: string
  friendlyMessage: string
}

export type SelectionSummary = {
  filePath: string
  label: string
  startLine?: number
  endLine?: number
}

export type ParsedSelectionContent = {
  type: 'ideSelection'
  selection: SelectionSummary
  originalText: string
}

export type ParsedOpenedFileContent = {
  type: 'ideOpenedFile'
  file: {
    filePath: string
    label: string
  }
  originalText: string
}

export type ParsedDiagnosticsContent = {
  type: 'ideDiagnostics'
  diagnostics: DiagnosticEntry[]
  originalText: string
}

export type DiagnosticEntry = {
  filePath: string
  line: number
  column: number
  message: string
  code: string
  severity: string
}

export type ParsedSlashCommandResult = {
  type: 'slashCommandResult'
  result: string
  isError: boolean
}

export type ParsedTextContent = {
  type: 'text'
  text: string
  isSlashCommand: boolean
}

export type ParsedMessageContent =
  | ParsedInterruptContent
  | ParsedSelectionContent
  | ParsedOpenedFileContent
  | ParsedDiagnosticsContent
  | ParsedSlashCommandResult
  | ParsedTextContent

const INTERRUPT_MESSAGES: Record<string, string> = {
  '[Request interrupted by user]': 'Interrupted',
  '[Request interrupted by user for tool use]': 'Tool interrupted',
}

const SLASH_COMMAND_PATTERN = /<command-name>([\s\S]*?)<\/command-name>/
const SLASH_ARGUMENT_PATTERN = /<command-args>([\s\S]*?)<\/command-args>/
const DIAGNOSTICS_WRAPPER_PATTERN = /<post-tool-use-hook>([\s\S]*?)<\/post-tool-use-hook>/
const DIAGNOSTICS_PAYLOAD_PATTERN = /<ide_diagnostics>([\s\S]*?)<\/ide_diagnostics>/

export function parseUserFacingContent(content: MessageContentBlock): ParsedMessageContent | null {
  if (content.type !== 'text') {
    return null
  }

  const text = content.text

  if (INTERRUPT_MESSAGES[text]) {
    return {
      type: 'interrupt',
      message: text,
      friendlyMessage: INTERRUPT_MESSAGES[text],
    }
  }

  if (text.includes('<ide_selection>')) {
    const selection = extractSelection(text)
    if (selection) {
      return {
        type: 'ideSelection',
        selection,
        originalText: text,
      }
    }
  }

  if (text.includes('<ide_opened_file>')) {
    const file = extractOpenedFile(text)
    if (file) {
      return {
        type: 'ideOpenedFile',
        file,
        originalText: text,
      }
    }
  }

  if (text.includes('<local-command-stdout>') || text.includes('<local-command-stderr>')) {
    const commandResult = extractCommandResult(text)
    if (commandResult) {
      return commandResult
    }
  }

  if (text.includes('<post-tool-use-hook>')) {
    const diagnostics = extractDiagnostics(text)
    if (diagnostics.length > 0) {
      return {
        type: 'ideDiagnostics',
        diagnostics,
        originalText: text,
      }
    }
  }

  const normalized = extractSlashCommand(text) ?? text
  const isSlashCommand = normalized.startsWith('/')

  return {
    type: 'text',
    text: normalized,
    isSlashCommand,
  }
}

function extractSelection(text: string): SelectionSummary | null {
  const match = text.match(/from ([^:]+):/)
  if (!match) {
    return null
  }

  const filePath = match[1]
  const fileName = filePath.split('/').pop() ?? filePath
  let label = fileName
  let startLine: number | undefined
  let endLine: number | undefined

  const lineMatch = text.match(/lines (\d+) to (\d+)/)
  if (lineMatch) {
    startLine = parseInt(lineMatch[1], 10)
    endLine = parseInt(lineMatch[2], 10)
    label = `${fileName}#${startLine}-${endLine}`
  }

  return {
    filePath,
    label,
    startLine,
    endLine,
  }
}

function extractOpenedFile(text: string): { filePath: string; label: string } | null {
  const match = text.match(/(?:opened the file|opened file) (.+?) in (?:the )?(?:IDE|editor)/)
  if (!match) {
    return null
  }

  const filePath = match[1]
  const fileName = filePath.split('/').pop() ?? filePath

  return {
    filePath,
    label: fileName,
  }
}

function extractSlashCommand(text: string): string | null {
  const commandMatch = text.match(SLASH_COMMAND_PATTERN)
  if (!commandMatch) {
    return null
  }

  const commandName = commandMatch[1].trim()
  const argsMatch = text.match(SLASH_ARGUMENT_PATTERN)
  const commandArgs = argsMatch ? argsMatch[1].trim() : ''

  return `${commandName} ${commandArgs}`.trim()
}

function extractCommandResult(text: string): ParsedSlashCommandResult | null {
  const stderr = text.match(/<local-command-stderr>([\s\S]*?)<\/local-command-stderr>/)
  if (stderr) {
    return {
      type: 'slashCommandResult',
      result: stderr[1].trim() || '',
      isError: true,
    }
  }

  const stdout = text.match(/<local-command-stdout>([\s\S]*?)<\/local-command-stdout>/)
  if (stdout) {
    return {
      type: 'slashCommandResult',
      result: stdout[1].trim() || '',
      isError: false,
    }
  }

  return null
}

function extractDiagnostics(text: string): DiagnosticEntry[] {
  const wrapperMatch = text.match(DIAGNOSTICS_WRAPPER_PATTERN)
  if (!wrapperMatch) {
    return []
  }

  const payloadMatch = wrapperMatch[1].match(DIAGNOSTICS_PAYLOAD_PATTERN)
  if (!payloadMatch) {
    return []
  }

  try {
    const parsed = JSON.parse(payloadMatch[1])
    if (Array.isArray(parsed)) {
      return parsed.map((entry) => ({
        filePath: entry.filePath ?? '',
        line: entry.line ?? 0,
        column: entry.column ?? 0,
        message: entry.message ?? '',
        code: entry.code ?? '',
        severity: entry.severity ?? '',
      }))
    }
  } catch {
    return []
  }

  return []
}
