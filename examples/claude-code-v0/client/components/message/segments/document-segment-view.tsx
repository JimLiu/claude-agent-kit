import React from "react";
import type {
  DocumentBlock,
  ImageBlock,
  SearchResultBlock,
  ThinkingBlock,
  ThinkingRedactedBlock,
  ToolUseBlock,
} from "../types";
import { ImagePreview } from "./image-preview";
import { SearchResultsView } from "./search-results-view";
import { ThinkingView } from "./thinking-view";

type DocumentLikeBlock =
  | DocumentBlock
  | ImageBlock
  | SearchResultBlock
  | ThinkingBlock
  | ThinkingRedactedBlock
  | ToolUseBlock;

interface DocumentSegmentViewProps {
  block: DocumentLikeBlock;
}

export function DocumentSegmentView({ block }: DocumentSegmentViewProps) {
  switch (block.type) {
    case "document":
      return (
        <pre className="whitespace-pre-wrap rounded-lg bg-gray-950/70 p-3 text-xs text-gray-100">
          {block.source.type === "text" ? block.source.data : block.title ?? "Document"}
        </pre>
      );
    case "image":
      return <ImagePreview block={block} />;
    case "search_result":
      return <SearchResultsView block={block} />;
    case "thinking":
      return <ThinkingView block={block} />;
    case "redacted_thinking":
      return (
        <div className="rounded-lg border border-amber-500/50 bg-amber-900/30 px-3 py-2 text-xs text-amber-100">
          Thinking hidden {block.hint ? `(${block.hint})` : ""}
        </div>
      );
    case "tool_use":
      return (
        <div className="rounded-lg border border-indigo-300/60 bg-indigo-900/20 px-3 py-2 text-xs text-indigo-100">
          Requested tool <span className="font-semibold text-indigo-200">{block.name}</span>
        </div>
      );
    default:
      return (
        <pre className="whitespace-pre-wrap rounded-lg bg-gray-100 p-3 text-xs text-gray-800">
          {JSON.stringify(block, null, 2)}
        </pre>
      );
  }
}
