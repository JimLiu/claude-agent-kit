import React from "react";
import type { Message } from "./types";
import { MessageRow } from "./message-row";

interface MessageRendererProps {
  messages: Message[];
}

export function MessageRenderer({ messages }: MessageRendererProps) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      {messages.map((message) => (
        <MessageRow
          key={`${message.id}-${message.timestamp}`}
          message={message}
        />
      ))}
    </div>
  );
}
