import type { ReactNode } from 'react';
import type { ClaudeMessageContext } from '../../types';
import type { ToolResultContentBlock } from '@claude-agent-kit/messages';
import { ToolBody } from '../tool-body';
import { BaseToolRenderer } from './base-tool-renderer';
import { isNonEmptyRecord, type ToolInput } from './utils';

export class WebFetchRenderer extends BaseToolRenderer {
  constructor(private readonly context: ClaudeMessageContext) {
    super('Web Fetch');
  }

  header(_context: ClaudeMessageContext, input: ToolInput): ReactNode {
    const url = isNonEmptyRecord(input) ? String(input.url ?? '') : '';
    return (
      <>
        <span className="font-semibold">Web Fetch</span>{' '}
        <span className="text-muted-foreground">{url}</span>
      </>
    );
  }

  body(
    _context: ClaudeMessageContext,
    input: ToolInput,
    result: ToolResultContentBlock | undefined,
  ): ReactNode {
    if (!result || typeof result.content !== 'string') {
      return super.body(_context, input, result);
    }

    if (result.is_error) {
      const message = result.content || 'Unknown error';

      return (
        <ToolBody>
          <div
            className="whitespace-pre-wrap break-words rounded border border-primary/40 bg-background p-2 font-mono text-sm"
            role="button"
            onClick={() => this.context.fileOpener.openContent(message, 'Fetch output', false)}
            onKeyDown={() => this.context.fileOpener.openContent(message, 'Fetch output', false)}
            tabIndex={0}
          >
            {message}
          </div>
        </ToolBody>
      );
    }

    const url = isNonEmptyRecord(input) ? String(input.url ?? '') : '';
    return (
      <ToolBody>
        <div className="whitespace-pre-wrap break-words rounded border border-primary/40 bg-background p-2 font-mono text-sm">Fetched from {url}</div>
      </ToolBody>
    );
  }
}
