import type { MessageContentBlock } from "./types";

const SLASH_COMMAND_PATTERN = /<command-name>([\s\S]*?)<\/command-name>/;
const SLASH_ARGUMENT_PATTERN = /<command-args>([\s\S]*?)<\/command-args>/;

export interface DiagnosticEntry {
  filePath: string;
  message: string;
  severity: string;
  line: number;
  column: number;
  code?: string;
}

export type ParsedSlashCommandResult = {
  type: "slashCommandResult";
  result: string;
  isError: boolean;
};

export type ParsedTextContent = {
  type: "text";
  text: string;
  isSlashCommand: boolean;
};

export type ParsedInterruptContent = {
  type: "interrupt";
  friendlyMessage: string;
};

export type ParsedIdeSelectionContent = {
  type: "ideSelection";
  selection: {
    label: string;
    filePath: string;
    startLine?: number;
    endLine?: number;
  };
};

export type ParsedIdeOpenedFileContent = {
  type: "ideOpenedFile";
  file: {
    label: string;
    filePath: string;
  };
};

export type ParsedDiagnosticsContent = {
  type: "ideDiagnostics";
  diagnostics: DiagnosticEntry[];
};

export type ParsedMessageContent =
  | ParsedSlashCommandResult
  | ParsedTextContent
  | ParsedInterruptContent
  | ParsedIdeSelectionContent
  | ParsedIdeOpenedFileContent
  | ParsedDiagnosticsContent;

function extractSlashCommand(text: string): string | null {
  const commandMatch = text.match(SLASH_COMMAND_PATTERN);
  if (!commandMatch) {
    return null;
  }

  const commandName = commandMatch?.[1] ? commandMatch[1].trim() : "";
  const argsMatch = text.match(SLASH_ARGUMENT_PATTERN);
  const commandArgs = argsMatch?.[1] ? argsMatch[1].trim() : "";

  return `${commandName} ${commandArgs}`.trim();
}

function parseStructuredContent(text: string): ParsedMessageContent | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const type = typeof parsed.type === "string" ? parsed.type : null;
    if (!type) {
      return null;
    }

    switch (type) {
      case "interrupt": {
        const friendlyMessage =
          typeof parsed.friendlyMessage === "string" ? parsed.friendlyMessage : null;
        return friendlyMessage ? { type: "interrupt", friendlyMessage } : null;
      }
      case "ideSelection": {
        const selection = parsed.selection as Record<string, unknown> | undefined;
        const filePath = typeof selection?.filePath === "string" ? selection.filePath : null;
        const label = typeof selection?.label === "string" ? selection.label : filePath;
        if (!filePath || !label) {
          return null;
        }

        const startLine =
          typeof selection?.startLine === "number" ? selection.startLine : undefined;
        const endLine = typeof selection?.endLine === "number" ? selection.endLine : undefined;

        return {
          type: "ideSelection",
          selection: { label, filePath, startLine, endLine },
        };
      }
      case "ideOpenedFile": {
        const file = parsed.file as Record<string, unknown> | undefined;
        const filePath = typeof file?.filePath === "string" ? file.filePath : null;
        const label = typeof file?.label === "string" ? file.label : filePath;
        if (!filePath || !label) {
          return null;
        }
        return {
          type: "ideOpenedFile",
          file: { label, filePath },
        };
      }
      case "ideDiagnostics": {
        if (!Array.isArray(parsed.diagnostics)) {
          return null;
        }

        const diagnostics = parsed.diagnostics.reduce<DiagnosticEntry[]>((acc, entry) => {
          if (!entry || typeof entry !== "object") {
            return acc;
          }
          const diagnostic = entry as Record<string, unknown>;
          const filePath =
            typeof diagnostic.filePath === "string" ? diagnostic.filePath : null;
          const message = typeof diagnostic.message === "string" ? diagnostic.message : null;
          const severity =
            typeof diagnostic.severity === "string" ? diagnostic.severity : "info";
          const line = typeof diagnostic.line === "number" ? diagnostic.line : undefined;
          const column =
            typeof diagnostic.column === "number" ? diagnostic.column : undefined;
          if (!filePath || !message || line === undefined || column === undefined) {
            return acc;
          }

          const code =
            typeof diagnostic.code === "string" || typeof diagnostic.code === "number"
              ? String(diagnostic.code)
              : undefined;

          acc.push({ filePath, message, severity, line, column, code });
          return acc;
        }, []);

        if (diagnostics.length === 0) {
          return null;
        }

        return {
          type: "ideDiagnostics",
          diagnostics,
        };
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export function parseUserFacingContent(
  content: MessageContentBlock,
): ParsedMessageContent | null {
  if (content.type !== "text") {
    return null;
  }

  const text = content.text ?? "";

  const structured = parseStructuredContent(text);
  if (structured) {
    return structured;
  }

  const normalized = extractSlashCommand(text) ?? text;
  const isSlashCommand = normalized.startsWith("/");

  return {
    type: "text",
    text: normalized,
    isSlashCommand,
  };
}
