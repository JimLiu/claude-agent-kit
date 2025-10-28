import type { MouseEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import type { ClaudeMessageContext } from '../types'
import { cn } from '@/lib/utils'

type MarkdownContentProps = {
  content: string
  context: ClaudeMessageContext
}

type FileLocation = {
  filePath: string
  startLine?: number
  endLine?: number
}

const FILE_REFERENCE_PATTERN = /^([^:#]+?)(?:[:#]L?(\d+)(?:-L?(\d+))?)?$/

function parseFileReference(target: string): FileLocation | null {
  const match = target.match(FILE_REFERENCE_PATTERN)
  if (!match) {
    return null
  }

  const [, path, start, end] = match
  const isLikelyPath =
    path.startsWith('/') ||
    path.startsWith('./') ||
    path.startsWith('../') ||
    path.endsWith('/') ||
    path.includes('/')

  const hasKnownExtension = /\.(ts|tsx|js|jsx|py|java|cpp|c|h|hpp|cs|go|rs|rb|php|swift|kt|scala|md|json|xml|yaml|yml|toml|ini|cfg|conf|txt|log|sh|bash|zsh|fish|ps1|bat|cmd)$/i.test(
    path
  )

  if (!isLikelyPath && !hasKnownExtension) {
    return null
  }

  return {
    filePath: path,
    startLine: start ? parseInt(start, 10) : undefined,
    endLine: end ? parseInt(end, 10) : undefined,
  }
}

export function MarkdownContent({ content, context }: MarkdownContentProps) {
  const handleAnchorClick = (event: MouseEvent<HTMLAnchorElement>, href: string | undefined) => {
    if (!href) {
      return
    }

    const reference = parseFileReference(href)
    if (!reference) {
      return
    }

    event.preventDefault()
    context.fileOpener.open(reference.filePath, {
      startLine: reference.startLine,
      endLine: reference.endLine,
    })
  }

  return (
    <div
      className={cn(
      'w-full overflow-x-hidden [text-wrap:auto]',
      '[&>*:first-child]:mt-0',
      '[&_h1:first-child]:mt-0 [&_h2:first-child]:mt-0 [&_h3:first-child]:mt-0 [&_h4:first-child]:mt-0 [&_h5:first-child]:mt-0 [&_h6:first-child]:mt-0',
      '[&_pre]:my-2 [&_pre]:box-border [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:whitespace-pre [&_pre]:rounded [&_pre]:p-2',
      '[&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:break-words',
      '[&_ol]:pl-6',
      '[&_ul]:pl-6',
      '[&_h1]:my-4 [&_h1]:text-2xl [&_h1]:font-bold',
      '[&_h2]:my-4 [&_h2]:text-xl [&_h2]:font-bold',
      '[&_h3]:my-3 [&_h3]:text-lg [&_h3]:font-bold',
      '[&_h4]:my-3 [&_h4]:text-md [&_h4]:font-bold',
      '[&_h5]:my-2 [&_h5]:text-sm [&_h5]:font-bold',
      '[&_h6]:my-2 [&_h6]:text-xs [&_h6]:font-bold'
      )}
    >
      <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a({ href, children, ...props }) {
        return (
          <a
          {...props}
          href={href}
          onClick={(event) => handleAnchorClick(event, href)}
          target="_blank"
          rel="noopener noreferrer"
          >
          {children}
          </a>
        )
        },
      }}
      >
      {content}
      </ReactMarkdown>
    </div>
  )
}
