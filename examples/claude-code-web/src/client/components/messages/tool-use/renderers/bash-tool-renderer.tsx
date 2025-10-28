import type { ReactNode } from "react";

import type { ToolResultContentBlock } from "@claude-agent-kit/messages";
import type { ClaudeMessageContext } from "../../types";
import { CodeBlock } from "@/components/messages/code-block";
import {
  BaseToolRenderer,
  ToolOutput,
} from "./base-tool-renderer";
import {
  extractRejectionReason,
  isNonEmptyRecord,
  toDisplayText,
  type ToolInput,
} from "./utils";

export class BashToolRenderer extends BaseToolRenderer {
  constructor(private readonly context: ClaudeMessageContext) {
    super("Bash");
  }

  protected renderInput(
    _context: ClaudeMessageContext,
    _input: ToolInput,
  ): ReactNode | undefined {
    return undefined;
  }

  protected toolDescription(
    input: ToolInput,
    result: ToolResultContentBlock | undefined,
  ): ReactNode {
    const command = isNonEmptyRecord(input)
      ? String(input.command ?? "")
      : "";
    const reason = extractRejectionReason(result);

    if (!command && !reason) {
      return undefined;
    }

    return (
      <div className="flex flex-col gap-3 text-xs text-muted-foreground">
        {command ? (
          <CodeBlock
            code={command}
            language="bash"
            className="text-left text-xs"
          />
        ) : null}
        {reason ? (
          <div className="text-left font-medium text-destructive">
            {reason}
          </div>
        ) : null}
      </div>
    );
  }

  protected renderOutput(
    _context: ClaudeMessageContext,
    result: ToolResultContentBlock | undefined,
  ): ReactNode | undefined {
    const output = toDisplayText(result);
    if (!output) {
      return undefined;
    }

    const isError = result?.is_error === true;

    const handleOpen = () =>
      this.context.fileOpener.openContent(output, "Bash output", false);

    return (
      <ToolOutput
        key="output"
        output={isError ? undefined : output}
        errorText={isError ? output : undefined}
        language="bash"
        onOpen={handleOpen}
      />
    );
  }
}
