import type { ReactNode } from 'react';
import type { ClaudeMessageContext } from '../../../types';
import type { ToolResultContentBlock } from '@claude-agent-kit/messages';
import { ToolBody } from '../../tool-body';
import { SecondaryLine } from '../../secondary-line';
import { FileToolRenderer } from '../file-tool-renderer';
import {
  extractRejectionReason,
  isNonEmptyRecord,
  stringifyInput,
  summarizeWriteContent,
  type ToolInput,
} from '../utils';
import { getMonaco, resolveLanguage } from '../../monaco-helpers';
import { CodeBlock } from '@/components/messages/code-block';

export class WriteRenderer extends FileToolRenderer {
  constructor(context: ClaudeMessageContext) {
    super('Write', context);
  }

  body(
    _context: ClaudeMessageContext,
    input: ToolInput,
    result: ToolResultContentBlock | undefined,
  ): ReactNode {
    const isRecord = isNonEmptyRecord(input);
    const content = isNonEmptyRecord(input) ? input.content : undefined;
    const summary = summarizeWriteContent(content, result?.is_error);
    const reason = extractRejectionReason(result);
    const filePath = isRecord ? String(input.file_path ?? '') : '';

    const sections: ReactNode[] = [<SecondaryLine key="summary">{summary}</SecondaryLine>];

    if (reason) {
      sections.push(
        <SecondaryLine key="reason">
          <strong>Reason:</strong> {reason}
        </SecondaryLine>,
      );
    }

    if (typeof content === 'string') {
      const monaco = getMonaco();
      const language = monaco ? resolveLanguage(monaco, 'plaintext', filePath) : 'plaintext';
      sections.push(
        // <ToolSection key="content" label="CONTENT" disableClipping>
        //   <pre>{content}</pre>
        // </ToolSection>,
        <CodeBlock key="content-code" code={content} language={language} className="text-left text-xs" />,
      );
    } else if (content) {
      const json = stringifyInput({ content });
      sections.push(
        // <ToolSection key="content-json" label="CONTENT">
        //   <pre>{json}</pre>
        // </ToolSection>,
        <CodeBlock key="content-code" code={json} language="json" className="text-left text-xs" />,
      );
    }

    return <ToolBody>{sections}</ToolBody>;
  }

  header(_context: ClaudeMessageContext, input: ToolInput): ReactNode {
    const filePath = isNonEmptyRecord(input) ? String(input.file_path ?? '') : '';
    const handleOpen = () => {
      this.openFile(filePath);
    };

    return (
      <>
        <span className="font-semibold">Write</span>{' '}
        {this.renderFileLink(filePath, handleOpen)}
      </>
    );
  }
}
