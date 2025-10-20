import React from "react";
import type { MessageSegment } from "../types";
import { SegmentView } from "./segment-view";

interface SegmentListProps {
  segments: MessageSegment[];
}

export function SegmentList({ segments }: SegmentListProps) {
  return (
    <div className="flex flex-col gap-3">
      {segments.map((segment, index) => (
        <SegmentView
          key={index}
          segment={segment}
        />
      ))}
    </div>
  );
}
