import React from "react";
import type { ToolInvocationSegment } from "../types";

interface ToolSegmentViewProps {
  segment: ToolInvocationSegment;
}

export function ToolSegmentView({ segment }: ToolSegmentViewProps) {
  return (
    <div className="space-y-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
      <div className="font-semibold">
        Tool <span className="text-indigo-700">{segment.block.name}</span>
      </div>
      <pre className="whitespace-pre-wrap text-indigo-800">
        {JSON.stringify(segment.block.input, null, 2)}
      </pre>
      {segment.result && (
        <div className="rounded border border-indigo-200 bg-white px-2 py-2 text-indigo-900">
          {typeof segment.result.content === "string" ? (
            <pre className="whitespace-pre-wrap">
              {segment.result.content}
            </pre>
          ) : (
            <pre className="whitespace-pre-wrap">
              {JSON.stringify(segment.result.content, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
