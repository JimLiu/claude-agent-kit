import type { ReactNode } from 'react';
import type { ToolResultContentBlock } from '@claude-agent-kit/messages';
import type { ClaudeMessageContext } from '../../../types';
import { FileToolRenderer } from '../file-tool-renderer';
import { isNonEmptyRecord, type ToolInput } from '../utils';

export class ReadCoalescedRenderer extends FileToolRenderer {
  constructor(context: ClaudeMessageContext) {
    super('Read', context);
  }

  header(_context: ClaudeMessageContext, input: ToolInput): ReactNode {
    const fileReads = isNonEmptyRecord(input) ? ((input.fileReads as ToolInput[]) ?? []) : [];

    return (
      <>
        <span className="font-semibold">Read</span>{' '}
        {Array.isArray(fileReads) &&
          fileReads.map((read, index) => {
            const filePath = isNonEmptyRecord(read) ? String(read.file_path ?? '') : '';
            const offset = isNonEmptyRecord(read) ? Number(read.offset ?? 0) : 0;
            const limit =
              isNonEmptyRecord(read) && read.limit !== undefined ? Number(read.limit) : undefined;

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
              <span key={filePath || index}>
                {index > 0 && ', '}
                {this.renderFileLink(filePath, handleOpen)}
                {lineAnnotation && <span>{lineAnnotation}</span>}
              </span>
            );
          })}
      </>
    );
  }

  protected override getOutputLanguage(
    _result: ToolResultContentBlock | undefined,
  ): string {
    return 'plaintext';
  }
}
