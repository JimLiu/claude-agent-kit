import type { ReactNode } from 'react';
import type { ClaudeMessageContext } from '../../types';
import { BaseToolRenderer } from './base-tool-renderer';
import { isNonEmptyRecord, type ToolInput } from './utils';

export class TaskRenderer extends BaseToolRenderer {
  constructor() {
    super('Task');
  }

  header(_context: ClaudeMessageContext, input: ToolInput): ReactNode {
    const description = isNonEmptyRecord(input) ? String(input.description ?? '') : '';
    return (
      <>
        <span className="font-semibold">Task:</span>{' '}
        {description && <span className="text-muted-foreground">{description}</span>}
      </>
    );
  }
}
