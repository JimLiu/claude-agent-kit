import type { ReactNode } from 'react';
import type { ClaudeMessageContext } from '../../../types';
import type { ToolResultContentBlock } from '@claude-agent-kit/messages';
import { ToolBody } from '../../tool-body';
import { SecondaryLine } from '../../secondary-line';
import { DiffPreview } from '../../diff-preview';
import { FileToolRenderer } from '../file-tool-renderer';
import {
  extractRejectionReason,
  formatLineDelta,
  isNonEmptyRecord,
  type ToolInput,
} from '../utils';

export class EditRenderer extends FileToolRenderer {
  constructor(context: ClaudeMessageContext) {
    super('Edit', context);
  }

  body(
    _context: ClaudeMessageContext,
    input: ToolInput,
    result: ToolResultContentBlock | undefined,
  ): ReactNode {
    const isRecord = isNonEmptyRecord(input);
    const oldString = isRecord ? String(input.old_string ?? '') : '';
    const newString = isRecord ? String(input.new_string ?? '') : '';
    const filePath = isRecord ? String(input.file_path ?? '') : '';
    const summary = formatLineDelta(oldString, newString);
    const reason = extractRejectionReason(result);

    return (
      <>
        <SecondaryLine>{summary}</SecondaryLine>
        {reason && (
          <SecondaryLine>
            <strong>Reason:</strong> {reason}
          </SecondaryLine>
        )}
        <div className="max-[500px]:hidden">
          <ToolBody>
            <DiffPreview
              original={oldString}
              modified={newString}
              filePath={filePath || undefined}
            />
          </ToolBody>
        </div>
      </>
    );
  }

  header(_context: ClaudeMessageContext, input: ToolInput): ReactNode {
    const filePath = isNonEmptyRecord(input) ? String(input.file_path ?? '') : '';
    const handleOpen = () => this.openFile(filePath);
    return (
      <>
        <span className="font-semibold">Edit</span>{' '}
        {this.renderFileLink(filePath, handleOpen)}
      </>
    );
  }
}
