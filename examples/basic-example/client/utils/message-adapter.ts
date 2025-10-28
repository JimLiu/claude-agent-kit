import type {
  SDKAssistantMessage,
  SDKMessage,
  SDKResultMessage,
  SDKSystemMessage,
  SDKUserMessage,
  SDKUserMessageReplay,
} from "@anthropic-ai/claude-agent-sdk";
import type {
  AssistantMessage as UIAssistantMessage,
  Message,
  SystemMessage as UISystemMessage,
  TextBlock,
  ToolResult,
  ToolUseBlock,
  UserMessage as UIUserMessage,
  UserToolResultMessage,
} from "../components/message/types";

type MaybeTimestamp = { timestamp?: unknown };

type ContentBlock = {
  type?: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  content?: unknown;
  tool_use_id?: string;
  is_error?: boolean;
  source?: {
    data?: string;
    media_type?: string;
  };
};

function extractTimestamp(rawValue: unknown): string {
  if (rawValue instanceof Date) {
    return rawValue.toISOString();
  }

  if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
    return new Date(rawValue).toISOString();
  }

  if (typeof rawValue === "string") {
    const numeric = Number(rawValue);
    if (Number.isFinite(numeric)) {
      return new Date(numeric).toISOString();
    }

    const parsed = Date.parse(rawValue);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }

  return new Date().toISOString();
}

function deriveId(message: SDKMessage, fallbackPrefix: string): string {
  if (message.uuid) {
    return String(message.uuid);
  }
  const timestamp = extractTimestamp((message as MaybeTimestamp).timestamp);
  return `${fallbackPrefix}-${message.session_id}-${timestamp}-${Math.random().toString(36).slice(2, 8)}`;
}

function ensureText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((chunk) => ensureText(chunk))
      .filter(Boolean)
      .join("\n");
  }

  if (value && typeof value === "object") {
    if ("text" in (value as { text?: unknown }) && typeof (value as { text?: unknown }).text === "string") {
      return String((value as { text?: unknown }).text);
    }
  }

  if (value === null || value === undefined) {
    return "";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function convertAssistantMessage(message: SDKAssistantMessage): UIAssistantMessage | null {
  const timestamp = extractTimestamp((message as MaybeTimestamp).timestamp);
  const baseId = deriveId(message, "assistant");
  const rawContent = (message.message as { content?: unknown }).content;

  if (!Array.isArray(rawContent)) {
    return null;
  }

  const contentBlocks: Array<TextBlock | ToolUseBlock> = [];

  for (const block of rawContent as ContentBlock[]) {
    if (!block || typeof block !== "object") {
      continue;
    }

    if (block.type === "text" || block.type === "input_text" || block.type === "output_text") {
      const text = ensureText(block.text);
      if (text) {
        contentBlocks.push({ type: "text", text });
      }
    } else if (block.type === "tool_use") {
      contentBlocks.push({
        type: "tool_use",
        id: block.id ?? deriveId(message, "tool"),
        name: block.name ?? "tool",
        input: block.input ?? {},
      });
    }
  }

  if (contentBlocks.length === 0) {
    contentBlocks.push({ type: "text", text: "" });
  }

  const assistantMessage: UIAssistantMessage = {
    id: baseId,
    type: "assistant",
    timestamp,
    content: contentBlocks,
  };

  const metadataSource = message.message as {
    id?: string;
    model?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
      service_tier?: string;
    };
  };

  if (metadataSource) {
    assistantMessage.metadata = {
      id: metadataSource.id ?? baseId,
      model: metadataSource.model ?? "unknown",
      usage: metadataSource.usage
        ? {
            input_tokens: metadataSource.usage.input_tokens ?? 0,
            output_tokens: metadataSource.usage.output_tokens ?? 0,
            cache_creation_input_tokens: metadataSource.usage.cache_creation_input_tokens,
            cache_read_input_tokens: metadataSource.usage.cache_read_input_tokens,
            service_tier: metadataSource.usage.service_tier ?? "standard",
          }
        : undefined,
    };
  }

  return assistantMessage;
}

function stringifyToolResultContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => ensureText(item))
      .filter(Boolean)
      .join("\n");
  }

  if (content && typeof content === "object") {
    if ("text" in (content as { text?: unknown }) && typeof (content as { text?: unknown }).text === "string") {
      return String((content as { text?: unknown }).text);
    }
  }

  return ensureText(content);
}

function convertUserMessage(message: SDKUserMessage | SDKUserMessageReplay): Message | null {
  if ("isReplay" in message && message.isReplay) {
    return null;
  }

  const timestamp = extractTimestamp((message as MaybeTimestamp).timestamp);
  const id = deriveId(message, "user");
  const rawContent = (message.message as { content?: unknown }).content;

  if (typeof rawContent === "string") {
    const userMessage: UIUserMessage = {
      id,
      type: "user",
      timestamp,
      content: rawContent,
    };
    return userMessage;
  }

  if (!Array.isArray(rawContent)) {
    const userMessage: UIUserMessage = {
      id,
      type: "user",
      timestamp,
      content: ensureText(rawContent),
    };
    return userMessage;
  }

  const blocks = rawContent as ContentBlock[];
  const toolResults = blocks.filter((block) => block?.type === "tool_result");

  if (toolResults.length > 0) {
    const results: ToolResult[] = toolResults.map((block) => ({
      type: "tool_result",
      tool_use_id: block.tool_use_id ?? deriveId(message, "tool-result"),
      content: stringifyToolResultContent(block.content),
    }));

    const toolResultMessage: UserToolResultMessage = {
      id,
      type: "user",
      timestamp,
      content: results,
      metadata: {
        role: "user",
        content: results,
      },
    };

    return toolResultMessage;
  }

  const textParts = blocks
    .map((block) => {
      if (!block || typeof block !== "object") {
        return "";
      }

      if (block.type === "text" || block.type === "input_text") {
        return ensureText(block.text);
      }

      if (block.type === "document" && block.source?.data) {
        return ensureText(block.source.data);
      }

      return "";
    })
    .filter(Boolean);

  const userMessage: UIUserMessage = {
    id,
    type: "user",
    timestamp,
    content: textParts.join("\n\n"),
  };

  return userMessage;
}

function convertResultMessage(message: SDKResultMessage): UISystemMessage {
  const timestamp = extractTimestamp((message as MaybeTimestamp).timestamp);
  const id = deriveId(message, "result");

  const success = message.subtype === "success";
  const summaryParts: string[] = [
    success ? "Run completed successfully." : `Run ended: ${message.subtype?.replace(/_/g, " ") ?? "error"}.`,
  ];

  if (success && "result" in message && typeof message.result === "string") {
    summaryParts.push(message.result);
  }

  if ("total_cost_usd" in message) {
    summaryParts.push(`Cost: $${(message.total_cost_usd ?? 0).toFixed(4)}`);
  }

  if ("duration_ms" in message) {
    summaryParts.push(`Duration: ${(message.duration_ms ?? 0) / 1000}s`);
  }

  const systemMessage: UISystemMessage = {
    id,
    type: "system",
    timestamp,
    content: summaryParts.join("\n"),
    metadata: {
      type: "result",
      subtype: message.subtype,
    },
  };

  return systemMessage;
}

function convertSystemMessage(message: SDKSystemMessage): UISystemMessage {
  const timestamp = extractTimestamp((message as MaybeTimestamp).timestamp);
  const id = deriveId(message, "system");

  const metadata = {
    type: "system",
    subtype: message.subtype,
    cwd: (message as { cwd?: string }).cwd,
    session_id: message.session_id,
    tools: (message as { tools?: string[] }).tools,
    model: (message as { model?: string }).model,
    mcp_servers: (message as { mcp_servers?: unknown }).mcp_servers,
    permissionMode: (message as { permissionMode?: string }).permissionMode,
    slash_commands: (message as { slash_commands?: string[] }).slash_commands,
  };

  const contentLines: string[] = [];

  if (message.subtype === "init") {
    const model = (message as { model?: string }).model ?? "unknown";
    contentLines.push(`Session initialized with model ${model}.`);

    const cwd = (message as { cwd?: string }).cwd;
    if (cwd) {
      contentLines.push(`Working directory: ${cwd}`);
    }

    const tools = (message as { tools?: string[] }).tools;
    if (tools?.length) {
      contentLines.push(`Tools enabled: ${tools.join(", ")}`);
    }
  } else {
    contentLines.push(`System message: ${message.subtype}`);
  }

  const systemMessage: UISystemMessage = {
    id,
    type: "system",
    timestamp,
    content: contentLines.join("\n"),
    metadata,
  };

  return systemMessage;
}

export function convertSDKMessage(message: SDKMessage): Message | null {
  switch (message.type) {
    case "assistant":
      return convertAssistantMessage(message);
    case "user":
      return convertUserMessage(message);
    case "result":
      return convertResultMessage(message);
    case "system":
      return convertSystemMessage(message);
    default:
      return null;
  }
}

export function convertSDKMessages(messages: SDKMessage[]): Message[] {
  const converted: Message[] = [];
  for (const message of messages) {
    const uiMessage = convertSDKMessage(message);
    if (uiMessage) {
      converted.push(uiMessage);
    }
  }
  return converted;
}
