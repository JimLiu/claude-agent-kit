import React from "react";
import type { ImageBlock } from "../types";

interface ImagePreviewProps {
  block: ImageBlock;
}

export function ImagePreview({ block }: ImagePreviewProps) {
  if (block.source.type !== "base64") {
    return (
      <div className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-500">
        Unsupported image source
      </div>
    );
  }

  const dataUrl = `data:${block.source.media_type};base64,${block.source.data}`;
  return (
    <img
      src={dataUrl}
      alt={block.title ?? "Attachment"}
      className="max-h-64 rounded-lg border border-gray-300 object-contain"
    />
  );
}
