import type { ReactNode } from 'react';
import type { ClaudeMessageContext } from '../../types';
import { BaseToolRenderer } from './base-tool-renderer';
import { isNonEmptyRecord, type ToolInput } from './utils';

export class SlashCommandRenderer extends BaseToolRenderer {
  constructor() {
    super('SlashCommand');
  }

  header(_context: ClaudeMessageContext, input: ToolInput): ReactNode {
    const command = isNonEmptyRecord(input)
      ? String(input.command ?? '').split(' ')[0] ?? ''
      : '';

    return (
      <>
        <span className="font-semibold">{command}</span>{' '}
        <span className="text-muted-foreground">slash command</span>
      </>
    );
  }

  body(): ReactNode {
    return null;
  }
}
