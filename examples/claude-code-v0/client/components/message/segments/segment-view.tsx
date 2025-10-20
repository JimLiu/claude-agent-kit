import React from "react";
import type { MessageSegment } from "../types";
import { DocumentSegmentView } from "./document-segment-view";
import { ToolSegmentView } from "./tool-segment-view";

interface SegmentViewProps {
  segment: MessageSegment;
}

export function SegmentView({ segment }: SegmentViewProps) {
  switch (segment.kind) {
    case "text":
      return (
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {segment.block.text}
        </p>
      );
    case "document":
      return <DocumentSegmentView block={segment.block} />;
    case "tool":
      return <ToolSegmentView segment={segment} />;
    default:
      return null;
  }
}
