import type { ReactNode } from 'react';
import type { ClaudeMessageContext } from '../../../types';
import type { ToolResultContentBlock } from '@claude-agent-kit/messages';
import { ToolBody } from '../../tool-body';
import { ToolSection } from '../../tool-section';
import { SecondaryLine } from '../../secondary-line';
import { FileToolRenderer } from '../file-tool-renderer';
import { isNonEmptyRecord, type ToolInput } from '../utils';

export class NotebookEditRenderer extends FileToolRenderer {
  constructor(context: ClaudeMessageContext) {
    super('NotebookEdit', context);
  }

  header(_context: ClaudeMessageContext, input: ToolInput): ReactNode {
    const filePath = isNonEmptyRecord(input) ? String(input.notebook_path ?? '') : '';
    const cellId = isNonEmptyRecord(input) ? String(input.cell_id ?? '') : '';
    const handleOpen = () => this.openFile(filePath);
    const suffix = cellId ? `:${cellId}` : '';

    return (
      <>
        <span className="font-semibold">Edit Notebook Cell</span>{' '}
        {this.renderFileLink(filePath, handleOpen)}
        {suffix && <span className="text-muted-foreground">{suffix}</span>}
      </>
    );
  }

  body(
    _context: ClaudeMessageContext,
    input: ToolInput,
    result: ToolResultContentBlock | undefined,
  ): ReactNode {
    const status = result ? (result.is_error ? 'Failed' : 'Success') : 'Pending';
    const newSource = isNonEmptyRecord(input)
      ? String(input.new_source ?? '[No content]')
      : '[No content]';

    return (
      <ToolBody>
        <SecondaryLine>{status}</SecondaryLine>
        <ToolSection label="CELL" disableClipping>
          <pre>{newSource}</pre>
        </ToolSection>
      </ToolBody>
    );
  }
}
