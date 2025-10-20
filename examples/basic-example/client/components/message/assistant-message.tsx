import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AssistantMessage as AssistantMessageType,
  ToolUseBlock,
  TextBlock,
} from "./types";

interface AssistantMessageProps {
  message: AssistantMessageType;
}

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}

function ToolUseComponent({ toolUse }: { toolUse: ToolUseBlock }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Format tool parameters based on tool type
  const formatToolDisplay = () => {
    const input = toolUse.input;

    switch (toolUse.name) {
      case "Read":
        return (
          <div className="space-y-1">
            <div className="flex">
              <span className="text-xs text-gray-600 font-semibold mr-2">
                File:
              </span>
              <span className="text-xs text-gray-900 font-mono">
                {input.file_path}
              </span>
            </div>
            {input.offset && (
              <div className="flex">
                <span className="text-xs text-gray-600 font-semibold mr-2">
                  Offset:
                </span>
                <span className="text-xs text-gray-900 font-mono">
                  {input.offset}
                </span>
              </div>
            )}
            {input.limit && (
              <div className="flex">
                <span className="text-xs text-gray-600 font-semibold mr-2">
                  Limit:
                </span>
                <span className="text-xs text-gray-900 font-mono">
                  {input.limit} lines
                </span>
              </div>
            )}
          </div>
        );

      case "Write":
        return (
          <div className="space-y-1">
            <div className="flex">
              <span className="text-xs text-gray-600 font-semibold mr-2">
                File:
              </span>
              <span className="text-xs text-gray-900 font-mono">
                {input.file_path}
              </span>
            </div>
            <div>
              <span className="text-xs text-gray-600 font-semibold">
                Content:
              </span>
              <pre className="text-xs bg-white p-1 mt-1 border border-gray-200 overflow-x-auto font-mono max-h-32 overflow-y-auto">
                {input.content.length > 500
                  ? input.content.substring(0, 500) + "..."
                  : input.content}
              </pre>
            </div>
          </div>
        );

      case "Edit":
      case "MultiEdit":
        return (
          <div className="space-y-1">
            <div className="flex">
              <span className="text-xs text-gray-600 font-semibold mr-2">
                File:
              </span>
              <span className="text-xs text-gray-900 font-mono">
                {input.file_path}
              </span>
            </div>
            {toolUse.name === "Edit" ? (
              <>
                {input.replace_all && (
                  <div className="text-xs text-amber-600">
                    Replace all occurrences
                  </div>
                )}
                <div className="space-y-1">
                  <div className="text-xs text-gray-600 font-semibold">
                    Replace:
                  </div>
                  <pre className="text-xs bg-red-50 p-1 border border-red-200 overflow-x-auto font-mono max-h-24 overflow-y-auto">
                    {input.old_string}
                  </pre>
                  <div className="text-xs text-gray-600 font-semibold">
                    With:
                  </div>
                  <pre className="text-xs bg-green-50 p-1 border border-green-200 overflow-x-auto font-mono max-h-24 overflow-y-auto">
                    {input.new_string}
                  </pre>
                </div>
              </>
            ) : (
              <div className="space-y-1">
                <span className="text-xs text-gray-600 font-semibold">
                  {input.edits?.length || 0} edits
                </span>
                {input.edits?.slice(0, 3).map((edit: any, i: number) => (
                  <div key={i} className="pl-2 border-l-2 border-gray-300">
                    <div className="text-xs text-gray-500">Edit {i + 1}:</div>
                    {edit.replace_all && (
                      <div className="text-xs text-amber-600">Replace all</div>
                    )}
                    <div className="text-xs text-gray-600">
                      Old: {edit.old_string.substring(0, 50)}
                      {edit.old_string.length > 50 ? "..." : ""}
                    </div>
                    <div className="text-xs text-gray-600">
                      New: {edit.new_string.substring(0, 50)}
                      {edit.new_string.length > 50 ? "..." : ""}
                    </div>
                  </div>
                ))}
                {input.edits?.length > 3 && (
                  <div className="text-xs text-gray-500 pl-2">
                    ... and {input.edits.length - 3} more edits
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case "Bash":
        return (
          <div className="space-y-1">
            <div>
              <span className="text-xs text-gray-600 font-semibold">
                Command:
              </span>
              <pre className="text-xs bg-gray-900 text-green-400 p-1 mt-1 border border-gray-700 overflow-x-auto font-mono">
                {input.command}
              </pre>
            </div>
            {input.description && (
              <div className="text-xs text-gray-600">
                <span className="font-semibold">Description:</span>{" "}
                {input.description}
              </div>
            )}
            {input.run_in_background && (
              <div className="text-xs text-amber-600">
                Running in background
              </div>
            )}
            {input.timeout && (
              <div className="text-xs text-gray-600">
                <span className="font-semibold">Timeout:</span> {input.timeout}
                ms
              </div>
            )}
          </div>
        );

      case "Grep":
        return (
          <div className="space-y-1">
            <div className="flex">
              <span className="text-xs text-gray-600 font-semibold mr-2">
                Pattern:
              </span>
              <span className="text-xs text-gray-900 font-mono bg-yellow-50 px-1">
                {input.pattern}
              </span>
            </div>
            {input.path && (
              <div className="flex">
                <span className="text-xs text-gray-600 font-semibold mr-2">
                  Path:
                </span>
                <span className="text-xs text-gray-900 font-mono">
                  {input.path}
                </span>
              </div>
            )}
            {input.glob && (
              <div className="flex">
                <span className="text-xs text-gray-600 font-semibold mr-2">
                  Glob:
                </span>
                <span className="text-xs text-gray-900 font-mono">
                  {input.glob}
                </span>
              </div>
            )}
            {input.output_mode && (
              <div className="flex">
                <span className="text-xs text-gray-600 font-semibold mr-2">
                  Mode:
                </span>
                <span className="text-xs text-gray-900">
                  {input.output_mode}
                </span>
              </div>
            )}
            <div className="flex space-x-2 text-xs">
              {input["-i"] && (
                <span className="bg-gray-100 px-1">case-insensitive</span>
              )}
              {input["-n"] && (
                <span className="bg-gray-100 px-1">line-numbers</span>
              )}
              {input.multiline && (
                <span className="bg-gray-100 px-1">multiline</span>
              )}
            </div>
          </div>
        );

      case "Glob":
        return (
          <div className="space-y-1">
            <div className="flex">
              <span className="text-xs text-gray-600 font-semibold mr-2">
                Pattern:
              </span>
              <span className="text-xs text-gray-900 font-mono">
                {input.pattern}
              </span>
            </div>
            {input.path && (
              <div className="flex">
                <span className="text-xs text-gray-600 font-semibold mr-2">
                  Path:
                </span>
                <span className="text-xs text-gray-900 font-mono">
                  {input.path}
                </span>
              </div>
            )}
          </div>
        );

      case "WebSearch":
        return (
          <div className="space-y-1">
            <div className="flex">
              <span className="text-xs text-gray-600 font-semibold mr-2">
                Query:
              </span>
              <span className="text-xs text-gray-900">{input.query}</span>
            </div>
            {input.allowed_domains && input.allowed_domains.length > 0 && (
              <div className="flex">
                <span className="text-xs text-gray-600 font-semibold mr-2">
                  Domains:
                </span>
                <span className="text-xs text-gray-900">
                  {input.allowed_domains.join(", ")}
                </span>
              </div>
            )}
          </div>
        );

      case "WebFetch":
        return (
          <div className="space-y-1">
            <div className="flex">
              <span className="text-xs text-gray-600 font-semibold mr-2">
                URL:
              </span>
              <span className="text-xs text-gray-900 font-mono break-all">
                {input.url}
              </span>
            </div>
            <div>
              <span className="text-xs text-gray-600 font-semibold">
                Prompt:
              </span>
              <div className="text-xs text-gray-900 mt-1">{input.prompt}</div>
            </div>
          </div>
        );

      case "Task":
        return (
          <div className="space-y-1">
            <div className="flex">
              <span className="text-xs text-gray-600 font-semibold mr-2">
                Agent:
              </span>
              <span className="text-xs text-gray-900">
                {input.subagent_type}
              </span>
            </div>
            <div className="flex">
              <span className="text-xs text-gray-600 font-semibold mr-2">
                Description:
              </span>
              <span className="text-xs text-gray-900">{input.description}</span>
            </div>
            <div>
              <span className="text-xs text-gray-600 font-semibold">
                Prompt:
              </span>
              <div className="text-xs text-gray-900 mt-1 max-h-24 overflow-y-auto">
                {input.prompt}
              </div>
            </div>
          </div>
        );

      case "TodoWrite":
        return (
          <div className="space-y-1">
            <div className="text-xs text-gray-600 font-semibold">
              Todos: {input.todos?.length || 0} items
            </div>
            {input.todos?.map((todo: any, i: number) => (
              <div key={i} className="flex items-center text-xs">
                <span
                  className={`mr-2 ${
                    todo.status === "completed"
                      ? "text-green-600"
                      : todo.status === "in_progress"
                      ? "text-blue-600"
                      : "text-gray-500"
                  }`}
                >
                  {todo.status === "completed"
                    ? "✓"
                    : todo.status === "in_progress"
                    ? "→"
                    : "○"}
                </span>
                <span
                  className={
                    todo.status === "completed"
                      ? "line-through text-gray-500"
                      : ""
                  }
                >
                  {todo.status === "in_progress"
                    ? todo.activeForm
                    : todo.content}
                </span>
              </div>
            ))}
          </div>
        );

      case "NotebookEdit":
        return (
          <div className="space-y-1">
            <div className="flex">
              <span className="text-xs text-gray-600 font-semibold mr-2">
                Notebook:
              </span>
              <span className="text-xs text-gray-900 font-mono">
                {input.notebook_path}
              </span>
            </div>
            {input.cell_id && (
              <div className="flex">
                <span className="text-xs text-gray-600 font-semibold mr-2">
                  Cell ID:
                </span>
                <span className="text-xs text-gray-900 font-mono">
                  {input.cell_id}
                </span>
              </div>
            )}
            <div className="flex">
              <span className="text-xs text-gray-600 font-semibold mr-2">
                Type:
              </span>
              <span className="text-xs text-gray-900">
                {input.cell_type || "default"}
              </span>
            </div>
            <div className="flex">
              <span className="text-xs text-gray-600 font-semibold mr-2">
                Mode:
              </span>
              <span className="text-xs text-gray-900">
                {input.edit_mode || "replace"}
              </span>
            </div>
          </div>
        );

      case "ExitPlanMode":
        return (
          <div className="space-y-1">
            <div className="text-xs text-gray-600 font-semibold">Plan:</div>
            <div className="text-xs text-gray-900 bg-blue-50 p-2 border border-blue-200 max-h-32 overflow-y-auto">
              {input.plan}
            </div>
          </div>
        );

      default:
        // Fallback to raw JSON for unknown tools
        return (
          <pre className="text-xs bg-white p-2 border border-gray-200 overflow-x-auto whitespace-pre-wrap font-mono">
            {JSON.stringify(input, null, 2)}
          </pre>
        );
    }
  };

  return (
    <div className="mt-2 border border-gray-200 bg-gray-50">
      <div className="p-2 border-b border-gray-200 bg-white">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
              TOOL: {toolUse.name}
            </span>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-gray-600 hover:text-gray-900 font-mono"
          >
            {isExpanded ? "[-]" : "[+]"}
          </button>
        </div>
      </div>

      {isExpanded && <div className="p-2">{formatToolDisplay()}</div>}
    </div>
  );
}

function TextComponent({ text }: { text: TextBlock }) {
  return (
    <div className="text-sm text-gray-900">
      <div className="prose prose-sm max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // Customize link rendering
            a: ({ node, ...props }) => (
              <a
                {...props}
                className="text-gray-900 hover:text-gray-600 underline"
              />
            ),
            // Customize code rendering
            code: ({ node, inline, ...props }) =>
              inline ? (
                <code
                  className="bg-gray-100 px-1 py-0.5 text-xs font-mono"
                  {...props}
                />
              ) : (
                <code
                  className="block bg-gray-100 p-2 text-xs font-mono overflow-x-auto border border-gray-200"
                  {...props}
                />
              ),
            // Customize list rendering
            ul: ({ node, ...props }) => (
              <ul className="list-disc pl-5 space-y-1" {...props} />
            ),
            ol: ({ node, ...props }) => (
              <ol className="list-decimal pl-5 space-y-1" {...props} />
            ),
            // Customize paragraph spacing
            p: ({ node, ...props }) => <p className="mb-2" {...props} />,
          }}
        >
          {text.text}
        </ReactMarkdown>
      </div>
    </div>
  );
}

export function AssistantMessage({ message }: AssistantMessageProps) {
  const [showMetadata, setShowMetadata] = useState(false);

  return (
    <div className="mb-3 p-3 bg-gray-50 border border-gray-200">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
            ASSISTANT
          </span>
          {message.metadata?.model && (
            <span className="ml-2 px-1 py-0.5 text-xs bg-gray-200 text-gray-600 font-mono">
              {message.metadata.model}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">
          {formatTimestamp(message.timestamp)}
        </span>
      </div>

      <div className="space-y-2">
        {message.content.map((block, index) => {
          if (block.type === "text") {
            return <TextComponent key={index} text={block} />;
          } else if (block.type === "tool_use") {
            return <ToolUseComponent key={index} toolUse={block} />;
          }
          return null;
        })}
      </div>

      {message.metadata && (
        <div className="mt-3">
          <button
            onClick={() => setShowMetadata(!showMetadata)}
            className="text-xs text-gray-600 hover:text-gray-900 flex items-center font-mono"
          >
            {showMetadata ? "[-]" : "[+]"}
            <span className="ml-1">
              metadata
              {message.metadata.usage && (
                <span className="ml-1 text-gray-400">
                  ({message.metadata.usage.input_tokens}↓ /{" "}
                  {message.metadata.usage.output_tokens}↑)
                </span>
              )}
            </span>
          </button>

          {showMetadata && (
            <div className="mt-2 p-2 bg-white border border-gray-200 text-xs">
              <pre className="overflow-x-auto whitespace-pre-wrap font-mono">
                {JSON.stringify(message.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
