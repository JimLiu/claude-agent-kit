import { useMemo, useState } from "react";

import type {
  ToolResultContentBlock,
  ToolUseContentBlock,
} from "@claude-agent-kit/messages";
import type { MessagePartProps } from "../types";
import { ToolSummary } from "./tool-summary";
import { getToolRenderer } from "./tool-renderer-factory";
import { getStatusBadge } from "./renderers/base-tool-renderer";

export function ToolUseMessage({ content, context }: MessagePartProps) {
  if (content.content.type !== "tool_use") {
    return null;
  }

  const toolContent = content.content as ToolUseContentBlock;
  const toolResult = content.toolResult as ToolResultContentBlock | undefined;

  const renderer = useMemo(
    () => getToolRenderer(toolContent.name, context),
    [toolContent.name, context],
  );

  const [isOpen, setIsOpen] = useState(false);

  const header = renderer.header(context, toolContent.input);
  const body = renderer.body(context, toolContent.input, toolResult);
  const hasBody = Boolean(body);
  const statusBadge = getStatusBadge(renderer.getState(toolResult));

  const handleToggle = () => {
    if (!hasBody) {
      return;
    }
    setIsOpen((prev) => !prev);
  };

  return (
    <div className="flex flex-col gap-2 leading-[1.5]">
      <ToolSummary
        isOpen={isOpen}
        onToggle={hasBody ? handleToggle : undefined}
        status={statusBadge}
      >
        {header}
      </ToolSummary>
      {hasBody ? (isOpen ? body : null) : body}
    </div>
  );
}
