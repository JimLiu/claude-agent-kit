import React, { useState } from "react";
import type { ThinkingBlock } from "../types";

interface ThinkingViewProps {
  block: ThinkingBlock;
}

export function ThinkingView({ block }: ThinkingViewProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="text-xs font-semibold text-amber-600 hover:text-amber-500"
      >
        {expanded ? "Hide" : "Show"} thinking
      </button>
      {expanded && (
        <pre className="whitespace-pre-wrap rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
          {block.thinking}
        </pre>
      )}
    </div>
  );
}
