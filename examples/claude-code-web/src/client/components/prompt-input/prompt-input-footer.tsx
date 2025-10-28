import { ContextUsageIndicator } from "./context-usage-indicator";
import { PermissionModeButton } from "./permission-mode-button";
import {
  PermissionMode,
  SelectionInfo,
  ThinkingLevel,
  UsageData,
} from "@/types/session";
import { cn } from "@/lib/utils";

const FOOTER_CLASS =
  "z-[1] flex items-center gap-1.5 min-w-0 border-t border-border p-1.5 text-muted-foreground";
const SPACER_CLASS = "flex-1";
const FOOTER_BUTTON_CLASS =
  "inline-flex min-w-0 shrink items-center gap-1 rounded-sm border-0 bg-transparent px-1 py-[2px] text-[0.85em] text-muted-foreground outline-none hover:bg-muted";
const FOOTER_BUTTON_DISABLED_CLASS = "opacity-40";
const MENU_BUTTON_CLASS =
  "flex h-[26px] w-[26px] items-center justify-center rounded border-0 bg-transparent text-muted-foreground hover:bg-muted";
const MENU_BUTTON_OFF_CLASS = "opacity-40";
const SEND_BUTTON_CLASS =
  "flex h-[26px] w-[26px] items-center justify-center rounded border-0 bg-primary text-primary-foreground transition-colors data-[permission-mode=acceptEdits]:bg-foreground data-[permission-mode=acceptEdits]:text-background data-[permission-mode=plan]:bg-secondary data-[permission-mode=plan]:text-secondary-foreground hover:brightness-110 active:brightness-90 disabled:cursor-not-allowed disabled:opacity-40";
const SEND_ICON_CLASS = "h-[22px] w-[22px]";
const STOP_ICON_CLASS = "h-4 w-4";
const MENU_ICON_CLASS = "block h-[22px] w-[22px]";

const StopIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    aria-hidden="true"
    data-slot="icon"
    className={STOP_ICON_CLASS}
  >
    <path d="M5.25 3A2.25 2.25 0 0 0 3 5.25v9.5A2.25 2.25 0 0 0 5.25 17h9.5A2.25 2.25 0 0 0 17 14.75v-9.5A2.25 2.25 0 0 0 14.75 3h-9.5Z" />
  </svg>
);

const SendIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    aria-hidden="true"
    data-slot="icon"
    className={SEND_ICON_CLASS}
  >
    <path
      fillRule="evenodd"
      d="M10 17a.75.75 0 0 1-.75-.75V5.612L5.29 9.77a.75.75 0 0 1-1.08-1.04l5.25-5.5a.75.75 0 0 1 1.08 0l5.25 5.5a.75.75 0 1 1-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0 1 10 17Z"
      clipRule="evenodd"
    />
  </svg>
);

const IncludeSelectionIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
    data-slot="icon"
  >
    <path
      fillRule="evenodd"
      d="M4.78 4.97a.75.75 0 0 1 0 1.06L2.81 8l1.97 1.97a.75.75 0 1 1-1.06 1.06l-2.5-2.5a.75.75 0 0 1 0-1.06l2.5-2.5a.75.75 0 0 1 1.06 0ZM11.22 4.97a.75.75 0 0 0 0 1.06L13.19 8l-1.97 1.97a.75.75 0 1 0 1.06 1.06l2.5-2.5a.75.75 0 0 0 0-1.06l-2.5-2.5a.75.75 0 0 0-1.06 0ZM8.856 2.008a.75.75 0 0 1 .636.848l-1.5 10.5a.75.75 0 0 1-1.484-.212l1.5-10.5a.75.75 0 0 1 .848-.636Z"
      clipRule="evenodd"
    />
  </svg>
);

const ExcludeSelectionIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    aria-hidden="true"
    data-slot="icon"
  >
    <path
      fillRule="evenodd"
      d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06l-1.745-1.745a10.029 10.029 0 0 0 3.3-4.38 1.651 1.651 0 0 0 0-1.185A10.004 10.004 0 0 0 9.999 3a9.956 9.956 0 0 0-4.744 1.194L3.28 2.22ZM7.752 6.69l1.092 1.092a2.5 2.5 0 0 1 3.374 3.373l1.091 1.092a4 4 0 0 0-5.557-5.557Z"
      clipRule="evenodd"
    />
    <path d="m10.748 13.93 2.523 2.523a9.987 9.987 0 0 1-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 0 1 0-1.186A10.007 10.007 0 0 1 2.839 6.02L6.07 9.252a4 4 0 0 0 4.678 4.678Z" />
  </svg>
);

const ThinkingIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
    data-slot="icon"
    className={MENU_ICON_CLASS}
  >
    <path
      d="M8.00293 1.11523L8.35059 1.12402H8.35352C11.9915 1.30834 14.8848 4.31624 14.8848 8C14.8848 11.8025 11.8025 14.8848 8 14.8848C4.19752 14.8848 1.11523 11.8025 1.11523 8C1.11523 7.67691 1.37711 7.41504 1.7002 7.41504C2.02319 7.41514 2.28516 7.67698 2.28516 8C2.28516 11.1563 4.84369 13.7148 8 13.7148C11.1563 13.7148 13.7148 11.1563 13.7148 8C13.7148 4.94263 11.3141 2.4464 8.29492 2.29297V2.29199L7.99609 2.28516H7.9873V2.28418L7.89648 2.27539L7.88281 2.27441V2.27344C7.61596 2.21897 7.41513 1.98293 7.41504 1.7002C7.41504 1.37711 7.67691 1.11523 8 1.11523H8.00293ZM8 3.81543C8.32309 3.81543 8.58496 4.0773 8.58496 4.40039V7.6377L10.9619 8.82715C11.2505 8.97169 11.3678 9.32256 11.2236 9.61133C11.0972 9.86425 10.8117 9.98544 10.5488 9.91504L10.5352 9.91211V9.91016L10.4502 9.87891L10.4385 9.87402V9.87305L7.73828 8.52344C7.54007 8.42433 7.41504 8.22155 7.41504 8V4.40039C7.41504 4.0773 7.67691 3.81543 8 3.81543ZM2.44336 5.12695C2.77573 5.19517 3.02597 5.48929 3.02637 5.8418C3.02637 6.19456 2.7761 6.49022 2.44336 6.55859L2.2959 6.57324C1.89241 6.57324 1.56543 6.24529 1.56543 5.8418C1.56588 5.43853 1.89284 5.1123 2.2959 5.1123L2.44336 5.12695ZM3.46094 2.72949C3.86418 2.72984 4.19017 3.05712 4.19043 3.45996V3.46094C4.19009 3.86393 3.86392 4.19008 3.46094 4.19043H3.45996C3.05712 4.19017 2.72983 3.86419 2.72949 3.46094V3.45996C2.72976 3.05686 3.05686 2.72976 3.45996 2.72949H3.46094ZM5.98926 1.58008C6.32235 1.64818 6.57324 1.94276 6.57324 2.2959L6.55859 2.44336C6.49022 2.7761 6.19456 3.02637 5.8418 3.02637C5.43884 3.02591 5.11251 2.69895 5.1123 2.2959L5.12695 2.14844C5.19504 1.81591 5.48906 1.56583 5.8418 1.56543L5.98926 1.58008Z"
      fill="#CCCCCC"
      stroke="#CCCCCC"
      strokeWidth="0.27"
    />
  </svg>
);

const CommandMenuIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    aria-hidden="true"
    data-slot="icon"
    className={MENU_ICON_CLASS}
  >
    <path
      fillRule="evenodd"
      d="M12.528 3.047a.75.75 0 0 1 .449.961L8.433 16.504a.75.75 0 1 1-1.41-.512l4.544-12.496a.75.75 0 0 1 .961-.449Z"
      clipRule="evenodd"
    />
  </svg>
);

function getSelectionLabel(selection: SelectionInfo): string {
  if (selection.selectedText) {
    const numberOfLines = selection.endLine - selection.startLine + 1;
    return `${numberOfLines} ${numberOfLines === 1 ? "line" : "lines"} selected`;
  }

  const parts = selection.filePath.split(/[/\\]/);
  return parts[parts.length - 1];
}

export interface PromptInputFooterProps {
  mode: PermissionMode;
  onCycleMode: () => void;
  currentSelection: SelectionInfo | null;
  canSendMessage: boolean;
  toggleCommandMenu: () => void;
  includeSelection: boolean;
  onToggleIncludeSelection: () => void;
  onCompact: () => void;
  isBusy: boolean;
  usageData: UsageData;
  thinkingLevel: ThinkingLevel;
  onToggleThinking: () => void;
  onInterrupt: () => void;
}

export function PromptInputFooter({
  mode,
  onCycleMode,
  currentSelection,
  canSendMessage,
  toggleCommandMenu,
  includeSelection,
  onToggleIncludeSelection,
  onCompact,
  isBusy,
  usageData,
  thinkingLevel,
  onToggleThinking,
  onInterrupt,
}: PromptInputFooterProps) {
  const sendIcon = isBusy && !canSendMessage ? <StopIcon /> : <SendIcon />;
  const thinkingEnabled = thinkingLevel !== "off";

  return (
    <div className={FOOTER_CLASS}>
      <PermissionModeButton
        mode={mode}
        onTap={onCycleMode}
        className={FOOTER_BUTTON_CLASS}
      />

      {currentSelection && (
        <button
          type="button"
          className={cn(
            FOOTER_BUTTON_CLASS,
            !includeSelection && FOOTER_BUTTON_DISABLED_CLASS,
          )}
          title={
            includeSelection
              ? "The current selection will be sent to Claude (click to exclude)"
              : "The current selection will not be sent to Claude (click to include)"
          }
          onClick={onToggleIncludeSelection}
        >
          {includeSelection ? <IncludeSelectionIcon /> : <ExcludeSelectionIcon />}
          <span className="max-w-[200px] truncate">
            {getSelectionLabel(currentSelection)}
          </span>
        </button>
      )}

      <ContextUsageIndicator
        usedTokens={usageData.totalTokens}
        contextWindow={usageData.contextWindow}
        onCompact={onCompact}
      />

      <div className={SPACER_CLASS} />

      <button
        type="button"
        className={cn(
          MENU_BUTTON_CLASS,
          !thinkingEnabled && MENU_BUTTON_OFF_CLASS,
        )}
        title={thinkingEnabled ? "Thinking on" : "Thinking off"}
        onClick={onToggleThinking}
      >
        <ThinkingIcon />
      </button>

      <button
        type="button"
        className={MENU_BUTTON_CLASS}
        title="Command menu"
        onClick={toggleCommandMenu}
      >
        <CommandMenuIcon />
      </button>

      <button
        type="submit"
        disabled={!isBusy && !canSendMessage}
        className={SEND_BUTTON_CLASS}
        data-permission-mode={mode}
        onClick={(event) => {
          if (isBusy && !canSendMessage) {
            event.preventDefault();
            onInterrupt();
          }
        }}
      >
        {sendIcon}
      </button>
    </div>
  );
}
