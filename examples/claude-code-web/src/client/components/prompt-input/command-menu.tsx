import {
  KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

interface Command {
  id: string;
  label: string;
  description?: string;
  hasChevron?: boolean;
}

export interface CommandRegistry {
  getCommandsBySection: () => Record<string, Command[]>;
}

export interface CommandMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onCommandSelect: (command: Command, triggeredByTab: boolean) => void;
  commandRegistry: CommandRegistry;
  filterText?: string;
  suppressFilter?: boolean;
}

const MENU_POPUP_CLASS =
  "absolute left-0 right-0 bottom-full z-30 mb-2 flex max-h-[50vh] flex-col overflow-hidden rounded border border-border bg-popover animate-[bo_0.15s_ease-out]";
const FILTER_INPUT_CLASS =
  "m-1 w-full rounded border-0 bg-background px-3 py-2 text-[12px] text-muted-foreground outline-none placeholder:text-muted-foreground placeholder:opacity-50";
const FILTER_TEXT_CLASS =
  "m-1 rounded bg-background px-3 py-2 text-[12px] text-muted-foreground";
const COMMAND_LIST_CLASS =
  "flex max-h-[300px] flex-col gap-2 overflow-y-auto px-2 pb-2 pt-2";
const SECTION_CONTAINER_CLASS =
  "mt-1 flex flex-col gap-2 border-t border-border pt-1 first:mt-0 first:border-t-0 first:pt-0";
const SECTION_HEADER_CLASS =
  "px-3 py-1 text-[12px] text-muted-foreground opacity-50";
const COMMAND_ITEM_CLASS =
  "mx-1 flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-foreground";
const ACTIVE_COMMAND_ITEM_CLASS =
  "bg-accent text-accent-foreground";
const COMMAND_CONTENT_CLASS =
  "flex flex-1 items-center justify-between gap-2";
const COMMAND_LABEL_CLASS = "flex-1 text-foreground";
const CHEVRON_ICON_CLASS = "ml-auto h-4 w-4 opacity-50";
const EMPTY_STATE_CLASS =
  "px-2 pt-2 pb-1 text-center text-[12px] text-muted-foreground opacity-70";

const ChevronIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    aria-hidden="true"
    data-slot="icon"
    className={CHEVRON_ICON_CLASS}
  >
    <path
      fillRule="evenodd"
      d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
      clipRule="evenodd"
    />
  </svg>
);

export function CommandMenu({
  isOpen,
  onClose,
  onCommandSelect,
  commandRegistry,
  filterText,
  suppressFilter = false,
}: CommandMenuProps) {
  const [filter, setFilter] = useState("");
  const [activeCommandId, setActiveCommandId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeItemRef = useRef<HTMLDivElement | null>(null);

  const commandsBySection = useMemo(
    () => commandRegistry.getCommandsBySection(),
    [commandRegistry],
  );

  const effectiveFilter = suppressFilter ? filterText ?? "" : filter ?? "";

  const filteredCommands = useMemo(() => {
    return Object.entries(commandsBySection).reduce<Record<string, Command[]>>(
      (accumulator, [section, commands]) => {
        const matches = commands.filter((command) =>
          command.label.toLowerCase().includes(effectiveFilter.toLowerCase()),
        );
        if (matches.length > 0) {
          accumulator[section] = matches;
        }
        return accumulator;
      },
      {},
    );
  }, [commandsBySection, effectiveFilter]);

  const flatCommands = useMemo(
    () => Object.values(filteredCommands).flat(),
    [filteredCommands],
  );

  useEffect(() => {
    if (isOpen) {
      if (!suppressFilter && inputRef.current) {
        inputRef.current.focus();
      }
      setActiveCommandId(null);
      if (filterText === undefined) {
        setFilter("");
      }
    }
  }, [isOpen, suppressFilter, filterText]);

  useEffect(() => {
    if (
      effectiveFilter &&
      flatCommands.length > 0 &&
      !flatCommands.some((command) => command.id === activeCommandId)
    ) {
      setActiveCommandId(flatCommands[0].id);
    }
  }, [effectiveFilter, flatCommands, activeCommandId]);

  useEffect(() => {
    if (effectiveFilter === "") {
      setActiveCommandId(null);
    }
  }, [effectiveFilter]);

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({
      behavior: "instant",
      block: "nearest",
    });
  }, [activeCommandId]);

  const handleKeyNavigation = useCallback(
    (event: KeyboardEvent) => {
      if (!isOpen || suppressFilter) {
        return;
      }

      const keys = ["Escape", "ArrowDown", "ArrowUp", "Enter", "Tab"];
      if (!keys.includes(event.key)) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (flatCommands.length === 0) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        const currentIndex = flatCommands.findIndex(
          (command) => command.id === activeCommandId,
        );
        const nextIndex =
          currentIndex < flatCommands.length - 1 ? currentIndex + 1 : 0;
        setActiveCommandId(flatCommands[nextIndex]?.id ?? null);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        const currentIndex = flatCommands.findIndex(
          (command) => command.id === activeCommandId,
        );
        const nextIndex =
          currentIndex > 0 ? currentIndex - 1 : flatCommands.length - 1;
        setActiveCommandId(flatCommands[nextIndex]?.id ?? null);
        return;
      }

      if ((event.key === "Tab" || event.key === "Enter") && !event.shiftKey) {
        if ("isComposing" in event && (event as any).isComposing) {
          return;
        }
        event.preventDefault();
        if (activeCommandId) {
          const command = flatCommands.find(
            (item) => item.id === activeCommandId,
          );
          if (command) {
            setFilter("");
            onCommandSelect(command, event.key === "Tab");
          }
        }
      }
    },
    [
      activeCommandId,
      flatCommands,
      isOpen,
      onClose,
      onCommandSelect,
      suppressFilter,
    ],
  );

  useEffect(() => {
    if (isOpen && suppressFilter) {
      document.addEventListener("keydown", handleKeyNavigation);
      return () => {
        document.removeEventListener("keydown", handleKeyNavigation);
      };
    }
    return;
  }, [handleKeyNavigation, isOpen, suppressFilter]);

  if (!isOpen) {
    return null;
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    const keys = ["Escape", "ArrowDown", "ArrowUp", "Enter", "Tab"];
    if (keys.includes(event.key)) {
      handleKeyNavigation(event.nativeEvent);
    }
  };

  return (
    <div ref={containerRef} className={MENU_POPUP_CLASS}>
      {!suppressFilter && (
        <input
          ref={inputRef}
          type="text"
          value={effectiveFilter}
          onChange={(event) => setFilter(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Filter actions..."
          className={FILTER_INPUT_CLASS}
        />
      )}

      {suppressFilter && (
        <div className={FILTER_TEXT_CLASS}>{effectiveFilter}</div>
      )}

      <div className={COMMAND_LIST_CLASS}>
        {flatCommands.length === 0 && (
          <div className={EMPTY_STATE_CLASS}>No commands available</div>
        )}
        {Object.entries(filteredCommands).map(([section, commands]) => (
          <div key={section} className={SECTION_CONTAINER_CLASS}>
            <div className={SECTION_HEADER_CLASS}>{section}</div>
            {commands.map((command) => {
              const isActive = command.id === activeCommandId;
            return (
              <div
                key={command.id}
                ref={isActive ? activeItemRef : null}
                className={cn(
                  COMMAND_ITEM_CLASS,
                  isActive && ACTIVE_COMMAND_ITEM_CLASS,
                )}
                onMouseEnter={() => setActiveCommandId(command.id)}
                onClick={() => onCommandSelect(command, false)}
                role="button"
                tabIndex={0}
                title={command.description}
              >
                <div className={COMMAND_CONTENT_CLASS}>
                  <span
                    className={cn(
                      COMMAND_LABEL_CLASS,
                      isActive && "text-accent-foreground",
                    )}
                  >
                    {command.label}
                  </span>
                </div>
                {command.hasChevron && <ChevronIcon />}
              </div>
            );
          })}
          </div>
        ))}
      </div>
    </div>
  );
}
