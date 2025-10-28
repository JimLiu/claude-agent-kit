import type { ChatMessage, ChatMessagePart } from '@claude-agent-kit/messages'

export interface FileOpenLocation {
  startLine?: number
  endLine?: number
}

export interface FileOpener {
  open(filePath: string, location?: FileOpenLocation): void
  openContent(content: string, title: string, preserveFocus?: boolean): Promise<void> | void
}

export interface ClaudeMessageContext {
  fileOpener: FileOpener
  platform?: 'macos' | 'windows' | 'linux'
  assetUris?: Record<string, { light?: string; dark?: string }>
  safeFocus?: (element: HTMLElement) => void
}

export interface MessageProps {
  message: ChatMessage
  context: ClaudeMessageContext
  isHighlighted?: boolean
}

export interface MessagePartProps {
  content: ChatMessagePart
  context: ClaudeMessageContext
  plainText?: boolean
}
