import type { ReactNode } from 'react';
import type { ClaudeMessageContext } from '../../types';
import type { ToolResultContentBlock } from '@claude-agent-kit/messages';
import { ToolBody } from '../tool-body';
import { SecondaryLine } from '../secondary-line';
import { MarkdownContent } from '../markdown-content';
import { BaseToolRenderer } from './base-tool-renderer';
import { isNonEmptyRecord, type ToolInput } from './utils';

export class PlanExitRenderer extends BaseToolRenderer {
  constructor() {
    super("Claude's Plan");
  }

  header(_context: ClaudeMessageContext, input: ToolInput): ReactNode {
    const hasPlan = isNonEmptyRecord(input) && typeof input.plan === 'string';
    return (
      <span className="font-semibold">
        {hasPlan ? "Claude's Plan" : 'Plan Mode'}
      </span>
    );
  }

  body(
    context: ClaudeMessageContext,
    input: ToolInput,
    result: ToolResultContentBlock | undefined,
  ): ReactNode {
    const plan = isNonEmptyRecord(input) ? String(input.plan ?? '') : '';
    const approval = result && !result.is_error ? 'User approved the plan' : 'Stayed in plan mode';

    return (
      <ToolBody>
        {plan && (
          <div>
            <MarkdownContent content={plan} context={context} />
          </div>
        )}
        {result && (
          <SecondaryLine hideBracket>{approval}</SecondaryLine>
        )}
      </ToolBody>
    );
  }
}
