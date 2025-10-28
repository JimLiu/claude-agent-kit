import { useMemo } from 'react'

import type { ChatMessagePart } from '@claude-agent-kit/messages'
import { parseUserFacingContent } from '../../lib/message-parsing'
import type { ClaudeMessageContext } from './types'
import { MessagePart } from './message-part'
import { FileReferenceChip } from './file-reference-chip'
import { DiagnosticsPreview } from './diagnostics-preview'
import { ExpandableContent } from './expandable-content'
import { cn } from '../../lib/utils'
import { MarkdownContent } from './tool-use/markdown-content'

type UserMessageProps = {
  parts: ChatMessagePart[]
  context: ClaudeMessageContext
  isHighlighted: boolean
}

export function UserMessage({ parts, context, isHighlighted }: UserMessageProps) {
  const reversedParts = useMemo(() => [...parts].reverse(), [parts])
  const parsedParts = useMemo(
    () => reversedParts.map((part) => parseUserFacingContent(part.content)),
    [reversedParts]
  )

  const hasDiagnostics = parsedParts.some((parsed) => parsed?.type === 'ideDiagnostics')

  const containerClassName = cn(
    'relative flex flex-col items-start gap-0',
    hasDiagnostics
      ? 'select-text pl-[30px] before:absolute before:left-2 before:top-1 before:z-[1] before:text-[10px] before:text-muted-foreground before:content-["•"] after:absolute after:bottom-0 after:left-3 after:top-0 after:w-px after:bg-primary/40 after:content-[""]'
      : 'ml-0 items-start text-left',
    hasDiagnostics && 'before:text-[#e1c08d]',
    isHighlighted && 'z-10 !opacity-100'
  )

  return (
    <div className={containerClassName}>
      {reversedParts.map((part, index) => {
        const parsed = parsedParts[index]

        if (part.content.type === 'image' || part.content.type === 'document') {
          return (
            <div key={`attachment-${index}`}>
              <MessagePart content={part} context={context} />
            </div>
          )
        }

        if (parsed) {
          switch (parsed.type) {
            case 'interrupt':
              return (
                <div className="w-full italic text-muted-foreground" key={`interrupt-${index}`}>
                  {parsed.friendlyMessage}
                </div>
              )
            case 'ideSelection':
              return (
                <FileReferenceChip
                  key={`selection-${index}`}
                  label={parsed.selection.label}
                  filePath={parsed.selection.filePath}
                  location={{
                    startLine: parsed.selection.startLine,
                    endLine: parsed.selection.endLine,
                  }}
                  context={context}
                />
              )
            case 'ideOpenedFile':
              return (
                <FileReferenceChip
                  key={`opened-${index}`}
                  label={parsed.file.label}
                  filePath={parsed.file.filePath}
                  context={context}
                />
              )
            case 'ideDiagnostics':
              return (
                <DiagnosticsPreview
                  key={`diagnostics-${index}`}
                  parsed={parsed}
                  context={context}
                />
              )
            case 'slashCommandResult':
              return (
                <div className="w-full select-text font-mono text-sm" key={`slash-${index}`}>
                  <MarkdownContent content={parsed.result} context={context} />
                </div>
              )
            case 'text':
              if (parsed.isSlashCommand) {
                return (
                  <div
                  className="inline-block max-w-fit select-text overflow-auto whitespace-pre-wrap rounded border border-border bg-card px-[6px] py-1 font-mono text-sm"
                    key={`command-${index}`}
                  >
                    {parsed.text}
                  </div>
                )
              }
              break
          }
        }

        return (
          <div
            className="inline-block max-w-fit select-text overflow-auto whitespace-pre-wrap rounded border border-border bg-card px-4 py-4"
            key={`content-${index}`}
          >
            <ExpandableContent part={part} context={context} />
          </div>
        )
      })}
    </div>
  )
}
