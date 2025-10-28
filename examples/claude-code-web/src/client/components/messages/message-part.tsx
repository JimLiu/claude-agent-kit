import { ChatMessagePart as ChatMessagePartModel } from '@claude-agent-kit/messages'
import type { AttachmentChipType } from '../chat/attachment-chip'
import type { MessagePartProps } from './types'
import { AttachmentChip } from '../chat/attachment-chip'
import { DiffModalProvider } from './tool-use/diff-modal-context'
import { ToolUseMessage } from './tool-use/tool-use-message'
import { ThinkingDetails } from './thinking-details'
import { MarkdownContent } from './tool-use/markdown-content'

export function MessagePart({ content, context, plainText }: MessagePartProps) {
  const block = content.content

  if (block.type === 'text') {
    const text = block.text ?? ''
    if (plainText) {
      return <span>{text}</span>
    }
    return <MarkdownContent content={text} context={context} />
  }

  if (block.type === 'image') {
    const { source } = block
    if (source?.type === 'base64') {
      const dataUrl = `data:${source.media_type};base64,${source.data}`
      const extension = source.media_type.split('/')[1] || 'image'
      const label = `image.${extension}`
      return (
        <AttachmentChip
          label={label}
          type={attachmentTypeForBlock(block.type)}
          onClick={() => downloadDataUrl(dataUrl, label)}
        />
      )
    }
    return null
  }

  if (block.type === 'document') {
    const { source, title } = block
    if (source?.type === 'base64') {
      const label = title ?? 'Document'
      const dataUrl = `data:${source.media_type};base64,${source.data}`
      return (
        <AttachmentChip
          label={label}
          type={attachmentTypeForBlock(block.type)}
          onClick={() => downloadDataUrl(dataUrl, label)}
        />
      )
    }

    if (source?.type === 'text') {
      const label = title ?? 'Document'
      const base64 = encodeToBase64(source.data)
      if (!base64) {
        return null
      }
      const dataUrl = `data:${source.media_type};base64,${base64}`
      return (
        <AttachmentChip
          label={label}
          type={attachmentTypeForBlock(block.type)}
          onClick={() => downloadDataUrl(dataUrl, label)}
        />
      )
    }

    return null
  }

  if (block.type === 'tool_use') {
    return (
      <DiffModalProvider>
        <div className="w-full">
          <ToolUseMessage content={content} context={context} />
        </div>
      </DiffModalProvider>
    )
  }

  if (block.type === 'tool_result') {
    return (
      <div className="box-border w-full min-w-0 max-w-full overflow-x-auto whitespace-pre bg-muted">
        {typeof block.content === 'string' ? (
          <pre className="my-2 max-w-full overflow-x-auto whitespace-pre rounded border border-border bg-card p-2">
            {block.content || ' '}
          </pre>
        ) : Array.isArray(block.content) ? (
          block.content.map((nested, index) => (
            <MessagePart
              key={`tool-result-${index}`}
              content={{
                content: nested,
              } as ChatMessagePartModel}
              context={context}
              plainText={plainText}
            />
          ))
        ) : null}
      </div>
    )
  }

  if (block.type === 'thinking' && typeof block.thinking === 'string') {
    return <ThinkingDetails thinking={block.thinking} context={context} />
  }

  if (block.type === 'redacted_thinking') {
    return <ThinkingDetails thinking="(thinking redacted)" context={context} />
  }

  return (
    <div className="text-muted-foreground">
      Unsupported content type:{' '}
      <code className="font-mono text-sm">{block.type}</code>
    </div>
  )
}

function attachmentTypeForBlock(type: 'image' | 'document'): AttachmentChipType {
  return type === 'image' ? 'image' : 'document'
}

function downloadDataUrl(url: string, filename: string) {
  if (typeof document === 'undefined') {
    return
  }
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
}

function encodeToBase64(value: string): string {
  if (typeof btoa === 'function') {
    try {
      return btoa(value)
    } catch {
      if (typeof TextEncoder !== 'undefined') {
        const encoder = new TextEncoder()
        const bytes = encoder.encode(value)
        let binary = ''
        bytes.forEach((byte) => {
          binary += String.fromCharCode(byte)
        })
        return btoa(binary)
      }
    }
  }

  const g = typeof globalThis !== 'undefined' ? (globalThis as any) : undefined
  if (g?.Buffer?.from) {
    return g.Buffer.from(value, 'utf8').toString('base64')
  }

  return ''
}
