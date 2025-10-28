import type { ReactNode } from 'react';
import type { ClaudeMessageContext } from '../../types';
import { BaseToolRenderer } from './base-tool-renderer';

export abstract class FileToolRenderer extends BaseToolRenderer {
  constructor(name: string, private readonly context: ClaudeMessageContext) {
    super(name);
  }

  protected renderFileLink(
    filePath: string | undefined,
    onClick: () => void,
  ): ReactNode | undefined {
    if (!filePath) {
      return undefined;
    }

    const parts = filePath.split('/');
    const filename = parts.pop() ?? filePath;

    return (
      <span className="text-muted-foreground">
        <a
          href="#"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onClick();
          }}
        >
          {filename}
        </a>
      </span>
    );
  }

  protected openFile(filePath: string, location?: { startLine?: number; endLine?: number }) {
    this.context.fileOpener.open(filePath, location);
  }
}
