import type { ReactNode } from 'react';
import type { ToolResultContentBlock } from '@claude-agent-kit/messages';
import type { ClaudeMessageContext } from '../../../types';
import { FileToolRenderer } from '../file-tool-renderer';
import { isNonEmptyRecord, type ToolInput } from '../utils';

export class ReadRenderer extends FileToolRenderer {
  constructor(context: ClaudeMessageContext) {
    super('Read', context);
  }

  header(_context: ClaudeMessageContext, input: ToolInput): ReactNode {
    const filePath = isNonEmptyRecord(input) ? String(input.file_path ?? '') : '';
    const offset = isNonEmptyRecord(input) ? Number(input.offset ?? 0) : 0;
    const limit =
      isNonEmptyRecord(input) && input.limit !== undefined ? Number(input.limit) : undefined;

    const lineAnnotation =
      limit !== undefined
        ? ` (lines ${offset + 1}-${offset + limit})`
        : offset
        ? ` (from line ${offset + 1})`
        : '';

    const handleOpen = () => {
      this.openFile(filePath, { startLine: offset + 1 });
    };

    return (
      <>
        <span className="font-semibold">Read</span>{' '}
        {this.renderFileLink(filePath, handleOpen)}
        {lineAnnotation && <span>{lineAnnotation}</span>}
      </>
    );
  }

  protected override getOutputLanguage(
    _result: ToolResultContentBlock | undefined,
  ): string {
    return 'plaintext';
  }
}
