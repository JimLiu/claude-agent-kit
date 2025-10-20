import React from "react";
import type { Message } from "./types";
import { SegmentList } from "./segments/segment-list";

interface MessageRowProps {
  message: Message;
}

export function MessageRow({ message }: MessageRowProps) {
  const isUser = message.type === "user";
  const isSystem = message.type === "system";
  const alignmentClass = isUser ? "items-end text-right" : "items-start text-left";
  const bubbleClass = isUser
    ? "max-w-3xl rounded-2xl bg-black px-4 py-3 text-white shadow"
    : isSystem
      ? "max-w-3xl rounded-2xl bg-gray-900/80 px-4 py-3 text-gray-100 shadow"
      : "max-w-3xl rounded-2xl bg-white px-4 py-3 text-gray-900 shadow";

  return (
    <div className={`flex flex-col gap-1 ${alignmentClass}`}>
      <div className={bubbleClass}>
        <SegmentList segments={message.segments} />
      </div>
      <span className="text-[10px] uppercase tracking-wide text-gray-400">
        {new Date(message.timestamp).toLocaleTimeString()}
      </span>
    </div>
  );
}
