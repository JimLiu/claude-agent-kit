import { CircleIcon, DotIcon } from "lucide-react";
import { useMemo } from "react";

import type { ChatMessagePart } from "@claude-agent-kit/messages";
import type { ClaudeMessageContext } from "./types";
import { MessagePart } from "./message-part";
import { cn } from "../../lib/utils";

type AssistantStatus = "success" | "failure" | "progress" | null;

type AssistantMessageProps = {
  parts: ChatMessagePart[];
  context: ClaudeMessageContext;
  isHighlighted: boolean;
};

export function AssistantMessage({
  parts,
  context,
  isHighlighted,
}: AssistantMessageProps) {
  const status = useMemo<AssistantStatus>(() => {
    for (const part of parts) {
      if (part.content.type !== "tool_use") {
        continue;
      }

      const result = part.toolResult;
      if (!result) {
        return "progress";
      }

      return result.is_error ? "failure" : "success";
    }

    return null;
  }, [parts]);

  return (
    <div
      className={cn(
        "relative flex gap-2 select-text text-sm",
        isHighlighted && "z-10 !opacity-100"
      )}
    >
      <div className="relative w-[30px]">
        <div className="pointer-events-none absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-px bg-border" />
        <div className="flex justify-center absolute left-0 top-3.5 w-full">
          <CircleIcon
            className={cn(
              "size-3 bg-muted text-muted-foreground rounded-full",
              status === "success" && "bg-[#74c991]",
              status === "failure" && "bg-[#c74e39]",
              status === "progress" && "animate-pulse"
            )}
          />
        </div>
      </div>
      <div className="flex-1 py-2 overflow-hidden">
        {parts.map((part, index) => (
          <MessagePart
            key={`assistant-part-${index}`}
            content={part}
            context={context}
          />
        ))}
      </div>
    </div>
  );
}
