import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { ClaudeModelOption } from "@/types/session";

export interface ModelPickerProps {
  isOpen: boolean;
  onClose: () => void;
  availableModels?: ClaudeModelOption[];
  currentModel?: string | null;
  onModelSelected: (model: ClaudeModelOption) => void;
}

const MENU_POPUP_CLASS =
  "absolute left-0 right-0 bottom-full z-30 mb-2 flex max-h-[50vh] flex-col overflow-hidden rounded-lg border border-border bg-popover animate-[bo_0.15s_ease-out]";
const MODEL_LIST_CLASS =
  "flex max-h-[300px] flex-col gap-2 overflow-y-auto px-2 pb-2 pt-2";
const SECTION_HEADER_CLASS =
  "px-3 py-1 text-[12px] text-muted-foreground opacity-50";
const MODEL_ITEM_CLASS =
  "mx-1 flex cursor-pointer flex-row items-center gap-3 rounded-md px-3 py-2 text-foreground";
const ACTIVE_MODEL_ITEM_CLASS =
  "bg-accent text-accent-foreground";
const MODEL_CONTENT_CLASS =
  "flex flex-1 flex-col leading-[1.2]";
const MODEL_LABEL_CLASS = "text-foreground";
const MODEL_DESCRIPTION_CLASS =
  "text-[0.85em] opacity-50";
const CHECK_ICON_CLASS = "flex w-6 items-center justify-center";
const EMPTY_STATE_CLASS =
  "px-2 pt-2 text-center text-[12px] text-muted-foreground opacity-70";

const CheckIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    aria-hidden="true"
    data-slot="icon"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m4.5 12.75 6 6 9-13.5"
    />
  </svg>
);

export function ModelPicker({
  isOpen,
  onClose,
  availableModels,
  currentModel,
  onModelSelected,
}: ModelPickerProps) {
  const [activeValue, setActiveValue] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeItemRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const selected = availableModels?.find(
      (model) => model.value === currentModel,
    );
    setActiveValue(selected?.value ?? null);
  }, [isOpen, availableModels, currentModel]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isOpen || !availableModels) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (availableModels.length === 0) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        const index = availableModels.findIndex(
          (model) => model.value === activeValue,
        );
        const nextIndex =
          index < availableModels.length - 1 ? index + 1 : 0;
        setActiveValue(availableModels[nextIndex]?.value ?? null);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        const index = availableModels.findIndex(
          (model) => model.value === activeValue,
        );
        const nextIndex =
          index > 0 ? index - 1 : availableModels.length - 1;
        setActiveValue(availableModels[nextIndex]?.value ?? null);
        return;
      }

      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        const selected = availableModels.find(
          (model) => model.value === activeValue,
        );
        if (selected) {
          onModelSelected(selected);
          onClose();
        }
      }
    },
    [activeValue, availableModels, isOpen, onClose, onModelSelected],
  );

  useEffect(() => {
    if (!isOpen) {
      document.removeEventListener("keydown", handleKeyDown);
      return;
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown, isOpen]);

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({
      behavior: "instant",
      block: "nearest",
    });
  }, [activeValue]);

  if (!isOpen) {
    return null;
  }

  return (
    <div ref={containerRef} className={MENU_POPUP_CLASS}>
      <div className={MODEL_LIST_CLASS}>
        {availableModels === undefined && (
          <div className={EMPTY_STATE_CLASS}>Loading models…</div>
        )}
        {availableModels !== undefined && availableModels.length === 0 && (
          <div className={EMPTY_STATE_CLASS}>No models available</div>
        )}
        {availableModels !== undefined && availableModels.length > 0 && (
          <>
            <div className={SECTION_HEADER_CLASS}>Select a model</div>
            {availableModels.map((model) => {
              const isActive = model.value === activeValue;
              return (
                <div
                  key={model.value}
                  ref={isActive ? activeItemRef : null}
                  className={cn(
                    MODEL_ITEM_CLASS,
                    isActive && ACTIVE_MODEL_ITEM_CLASS,
                  )}
                  onMouseEnter={() => setActiveValue(model.value)}
                  onClick={() => {
                    onModelSelected(model);
                    onClose();
                  }}
                >
                  <div className={MODEL_CONTENT_CLASS}>
                    <span
                      className={cn(
                        MODEL_LABEL_CLASS,
                        isActive && "text-accent-foreground",
                      )}
                    >
                      {model.displayName}
                    </span>
                    {model.description && (
                      <span className={MODEL_DESCRIPTION_CLASS}>
                        {model.description}
                      </span>
                    )}
                  </div>
                  <div className={CHECK_ICON_CLASS}>
                    {currentModel === model.value && <CheckIcon />}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
