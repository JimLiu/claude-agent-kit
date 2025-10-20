/**
 * Tool input definitions shared between the server session parser and the client UI.
 * Adapted from the extension reference implementation.
 */

export type ToolName =
  | "Read"
  | "ReadCoalesced"
  | "Edit"
  | "Write"
  | "Glob"
  | "Grep"
  | "Search"
  | "WebFetch"
  | "ExitPlanMode"
  | "NotebookEdit"
  | "SlashCommand"
  | "TodoRead"
  | "TodoWrite"
  | "Task"
  | "Bash"
  | "MultiEdit"
  | "LS"
  | "WebSearch"
  | "BashOutput"
  | "KillBash"
  | (string & {});

export interface FileReadInput {
  file_path: string;
  offset?: number;
  limit?: number;
}

export interface FileWriteInput {
  file_path: string;
  content: string | Record<string, unknown>;
}

export interface FileEditInput {
  file_path: string;
  old_string?: string;
  new_string?: string;
}

export interface GlobInput {
  pattern: string;
  path?: string;
}

export interface GrepInput {
  pattern: string;
  path?: string;
  glob?: string;
  output_mode?: "content" | "files_with_matches" | "count";
  "-A"?: number;
  "-B"?: number;
  "-C"?: number;
  "-n"?: boolean;
  "-i"?: boolean;
  type?: string;
  head_limit?: number;
  multiline?: boolean;
}

export interface SearchInput {
  pattern: string;
  path?: string;
}

export interface WebFetchInput {
  url: string;
  prompt?: string;
}

export interface ExitPlanModeInput {
  plan: string;
}

export interface NotebookEditInput {
  notebook_path: string;
  cell_id?: string;
  new_source: string;
}

export interface SlashCommandInput {
  command: string;
}

export interface TodoItem {
  content: string;
  status: "pending" | "in_progress" | "completed";
  activeForm?: string;
}

export interface TodoReadInput {
  todos: TodoItem[];
}

export interface TodoWriteInput {
  todos: TodoItem[];
}

export interface TaskInput {
  description?: string;
  prompt?: string;
  subagent_type?: string;
}

export interface ReadCoalescedInput {
  fileReads: FileReadInput[];
}

export type ToolInput =
  | FileReadInput
  | FileWriteInput
  | FileEditInput
  | GlobInput
  | GrepInput
  | SearchInput
  | WebFetchInput
  | ExitPlanModeInput
  | NotebookEditInput
  | SlashCommandInput
  | TodoReadInput
  | TodoWriteInput
  | TaskInput
  | ReadCoalescedInput
  | Record<string, unknown>;
