import type {
  DocumentContentBlock,
  TextContentBlock,
  ToolResultContentBlock,
} from '@claude-agent-kit/messages';

export type ToolInput = Record<string, unknown> | undefined;

export function isNonEmptyRecord(input: ToolInput): input is Record<string, unknown> {
  return !!input && Object.keys(input).length > 0;
}

export function toDisplayText(content: ToolResultContentBlock | undefined): string | undefined {
  if (!content) {
    return undefined;
  }

  if (typeof content.content === 'string') {
    return content.content;
  }

  if (Array.isArray(content.content)) {
    const blocks = content.content as Array<TextContentBlock | DocumentContentBlock>;
    const textBlocks: string[] = blocks
      .map((block) => {
        if (block.type === 'text') {
          return block.text;
        }
        if (block.type === 'document') {
          return `[Document: ${block.title ?? ''}]`;
        }
        return '';
      })
      .filter(Boolean);

    return textBlocks.length > 0 ? textBlocks.join('\n') : undefined;
  }

  return undefined;
}

export function stringifyInput(input: Record<string, unknown>): string {
  try {
    return JSON.stringify(input, null, 2);
  } catch (error) {
    return String(input);
  }
}

export function formatLineDelta(before: string, after: string): string {
  const beforeLines = before.split('\n').length;
  const afterLines = after.split('\n').length;
  const added = Math.max(0, afterLines - beforeLines);
  const removed = Math.max(0, beforeLines - afterLines);

  if (added > 0 && removed > 0) {
    return `Added ${added} line${added === 1 ? '' : 's'}, removed ${removed} line${removed === 1 ? '' : 's'}`;
  }

  if (added > 0) {
    return `Added ${added} line${added === 1 ? '' : 's'}`;
  }

  if (removed > 0) {
    return `Removed ${removed} line${removed === 1 ? '' : 's'}`;
  }

  return 'Modified';
}

export function summarizeWriteContent(content: unknown, isError: boolean | undefined): string {
  if (isError) {
    return 'Write failed';
  }

  if (typeof content !== 'string') {
    return 'Write succeeded';
  }

  const lineCount = content.split('\n').length;
  return `${lineCount} line${lineCount === 1 ? '' : 's'}`;
}

export function extractRejectionReason(result: ToolResultContentBlock | undefined): string | undefined {
  if (!result || result.is_error !== true || typeof result.content !== 'string') {
    return undefined;
  }

  const message = result.content;
  const GENERIC_REJECTION =
    "The user doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file). STOP what you are doing and wait for the user to tell you how to proceed.";

  const REASON_PREFIX =
    "The user doesn't want to proceed with this tool use. The tool use was rejected (eg. if it was a file edit, the new_string was NOT written to the file). The user provided the following reason for the rejection: ";

  if (message === GENERIC_REJECTION) {
    return undefined;
  }

  if (!message.startsWith(REASON_PREFIX)) {
    return undefined;
  }

  return message.slice(REASON_PREFIX.length);
}
