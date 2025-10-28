import type { ReactNode } from 'react';
import type { ClaudeMessageContext } from '../../types';
import type { ToolResultContentBlock } from '@claude-agent-kit/messages';
import { SecondaryLine } from '../secondary-line';
import { BaseToolRenderer } from './base-tool-renderer';
import { toDisplayText, isNonEmptyRecord, type ToolInput } from './utils';

export class GlobRenderer extends BaseToolRenderer {
  constructor(private readonly context: ClaudeMessageContext) {
    super('Glob');
  }

  header(_context: ClaudeMessageContext, input: ToolInput): ReactNode {
    const pattern = isNonEmptyRecord(input) ? String(input.pattern ?? '') : '';
    return (
      <>
        <span className="font-semibold">Glob</span>{' '}
        <span className="text-muted-foreground">pattern: "{pattern}"</span>
      </>
    );
  }

  protected toolDescription(
    _input: ToolInput,
    result: ToolResultContentBlock | undefined,
  ): ReactNode {
    const output = toDisplayText(result);
    const lines = output
      ? output
          .trim()
          .split('\n')
          .filter((line) => line.length > 0).length
      : 0;

    const label =
      lines === 0 ? 'No files found' : lines === 1 ? 'Found 1 file' : `Found ${lines} files`;

    return (
      <SecondaryLine
        onClick={
          output
            ? () => this.context.fileOpener.openContent(output, 'Glob output', false)
            : undefined
        }
      >
        {label}
      </SecondaryLine>
    );
  }
}

export class GrepRenderer extends BaseToolRenderer {
  constructor(private readonly context: ClaudeMessageContext) {
    super('Grep');
  }

  header(_context: ClaudeMessageContext, input: ToolInput): ReactNode {
    const pattern = isNonEmptyRecord(input) ? String(input.pattern ?? '') : '';
    const meta: string[] = [];
    if (isNonEmptyRecord(input)) {
      if (input.path) meta.push(`in ${input.path}`);
      if (input.glob) meta.push(`glob: ${input.glob}`);
      if (input.type) meta.push(`type: ${input.type}`);
    }

    return (
      <>
        <span className="font-semibold">Grep</span>{' '}
        <span className="text-muted-foreground">
          "{pattern}" {meta.length > 0 ? `(${meta.join(', ')})` : ''}
        </span>
      </>
    );
  }

  protected toolDescription(
    _input: ToolInput,
    result: ToolResultContentBlock | undefined,
  ): ReactNode {
    const output = toDisplayText(result);
    const lines = output
      ? output
          .trim()
          .split('\n')
          .filter((line) => line.length > 0).length
      : 0;

    const label =
      lines === 0
        ? 'No matches found'
        : lines === 1
        ? '1 line of output'
        : `${lines} lines of output`;

    return (
      <SecondaryLine
        onClick={
          output
            ? () => this.context.fileOpener.openContent(output, 'Grep output', false)
            : undefined
        }
      >
        {label}
      </SecondaryLine>
    );
  }
}

export class SearchRenderer extends BaseToolRenderer {
  constructor() {
    super('Search');
  }

  header(_context: ClaudeMessageContext, input: ToolInput): ReactNode {
    const pattern = isNonEmptyRecord(input) ? String(input.pattern ?? '') : '';
    return (
      <>
        <span className="font-semibold">Search</span>{' '}
        <span className="text-muted-foreground">pattern: "{pattern}"</span>
      </>
    );
  }
}
