import type { PropsWithChildren, ReactNode } from "react";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "../../../lib/utils";

type ToolSummaryProps = PropsWithChildren<{
  isOpen: boolean;
  onToggle?: () => void;
  status?: ReactNode;
}>;

export function ToolSummary({
  children,
  isOpen,
  onToggle,
  status,
}: ToolSummaryProps) {
  return (
    <div className="flex items-center justify-between gap-2 font-semibold">
      <span className="inline-flex items-center gap-2 text-sm font-semibold">
        {children}
        {status}
      </span>
      {onToggle ? (
        <button
          type="button"
          aria-label={isOpen ? "Collapse tool details" : "Expand tool details"}
          aria-expanded={isOpen}
          onClick={onToggle}
          className="inline-flex size-6 items-center justify-center rounded transition-colors hover:bg-muted"
        >
          <ChevronDownIcon
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              isOpen ? "rotate-180" : "rotate-0",
            )}
          />
        </button>
      ) : null}
    </div>
  );
}
