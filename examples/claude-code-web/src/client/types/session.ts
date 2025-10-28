export type PermissionMode = "default" | "acceptEdits" | "plan";

export type ThinkingLevel = "off" | "default_on";

export interface ReactiveValue<T> {
  value: T;
}

export interface SelectionInfo {
  filePath: string;
  startLine: number;
  endLine: number;
  selectedText?: string;
}

export interface ClaudeModelOption {
  value: string;
  displayName: string;
  description?: string;
}

export interface UsageData {
  totalTokens: number;
  totalCost: number;
  contextWindow: number;
}

export interface UserMessageContentItem {
  content?: {
    type: string;
    text?: string;
  };
}

export interface UserMessage {
  type: string;
  content: UserMessageContentItem[];
}

export interface ClaudeConfig {
  models?: ClaudeModelOption[];
}

export interface SessionConfig {
  modelSetting?: string | null;
}

export interface Session {
  messages: ReactiveValue<UserMessage[]>;
  permissionMode: ReactiveValue<PermissionMode>;
  setPermissionMode: (mode: PermissionMode, broadcast?: boolean) => void;
  busy: ReactiveValue<boolean>;
  selection: ReactiveValue<SelectionInfo | null>;
  usageData: ReactiveValue<UsageData>;
  claudeConfig: ReactiveValue<ClaudeConfig | null>;
  modelSelection: ReactiveValue<string | null>;
  config: ReactiveValue<SessionConfig | null>;
  thinkingLevel: ReactiveValue<ThinkingLevel>;
  setThinkingLevel: (level: ThinkingLevel) => void;
  interrupt: () => void;
}
