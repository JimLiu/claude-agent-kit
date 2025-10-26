import { RefObject, useCallback, useEffect, useRef, useState } from "react";

import { UserMessage } from "../types/session";

export interface MessageHistoryOptions {
  messages: UserMessage[];
  currentInput: string;
  onInputChange: (value: string) => void;
  editableRef: RefObject<HTMLElement>;
}

export interface MessageHistoryController {
  cycleMessage: (direction: -1 | 1) => boolean;
  resetHistory: () => void;
}

function placeCaretAtStart(node: HTMLElement): void {
  const range = document.createRange();
  const selection = window.getSelection();

  if (node.firstChild) {
    range.setStart(node.firstChild, 0);
  } else {
    range.selectNodeContents(node);
    range.collapse(true);
  }

  selection?.removeAllRanges();
  selection?.addRange(range);
}

function placeCaretAtEnd(node: HTMLElement): void {
  const range = document.createRange();
  const selection = window.getSelection();
  const textNode = node.firstChild ?? node;
  const textContent = node.textContent ?? "";

  if (textNode && textContent.length > 0) {
    range.setStart(textNode, textContent.length);
    range.setEnd(textNode, textContent.length);
  } else {
    range.selectNodeContents(node);
    range.collapse(false);
  }

  selection?.removeAllRanges();
  selection?.addRange(range);
}

function extractUserMessageText(message: UserMessage): string | undefined {
  if (message.type !== "user") {
    return undefined;
  }

  const parts: string[] = [];
  message.content.forEach((item) => {
    const payload = item.content;
    if (payload?.type === "text" && payload.text) {
      parts.push(payload.text);
    }
  });

  const combined = parts.join("").trim();
  return combined.length > 0 ? combined : undefined;
}

export function useMessageHistory({
  messages,
  currentInput,
  onInputChange,
  editableRef,
}: MessageHistoryOptions): MessageHistoryController {
  const [historyIndex, setHistoryIndex] = useState(-1);
  const preservedInput = useRef("");

  const userMessages = useCallback(() => {
    const collected: string[] = [];
    messages
      .filter((message) => message.type === "user")
      .forEach((message) => {
        const text = extractUserMessageText(message);
        if (text) {
          collected.push(text);
        }
      });
    return collected.reverse();
  }, [messages]);

  useEffect(() => {
    if (currentInput === "") {
      setHistoryIndex(-1);
      preservedInput.current = "";
    }
  }, [currentInput]);

  const cycleMessage = useCallback(
    (direction: -1 | 1) => {
      const editable = editableRef.current;
      if (!editable) {
        return false;
      }

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        return false;
      }

      const range = selection.getRangeAt(0);
      const textContent = editable.textContent ?? "";
      const caretPosition =
        direction === -1 ? range.startOffset : range.endOffset;

      if (
        (direction === -1 &&
          (caretPosition !== 0 ||
            range.startContainer !== (editable.firstChild ?? editable))) ||
        (direction === 1 &&
          !(
            range.endContainer === (editable.firstChild ?? editable) &&
            caretPosition === textContent.length
          ))
      ) {
        return false;
      }

      const history = userMessages();
      if (history.length === 0) {
        return false;
      }

      let nextIndex: number;
      if (direction === -1) {
        if (historyIndex === -1) {
          preservedInput.current = currentInput;
          nextIndex = 0;
        } else if (historyIndex < history.length - 1) {
          nextIndex = historyIndex + 1;
        } else {
          return false;
        }
      } else {
        if (historyIndex === -1) {
          return false;
        }
        nextIndex = historyIndex > 0 ? historyIndex - 1 : -1;
      }

      setHistoryIndex(nextIndex);

      const nextValue =
        nextIndex === -1 ? preservedInput.current : history[nextIndex];
      onInputChange(nextValue);

      if (editable) {
        editable.textContent = nextValue;
        const element = editable;
        setTimeout(() => {
          if (direction === -1 && nextIndex !== -1) {
            placeCaretAtStart(element);
          } else {
            placeCaretAtEnd(element);
          }
        }, 0);
      }

      return true;
    },
    [currentInput, editableRef, historyIndex, onInputChange, userMessages],
  );

  const resetHistory = useCallback(() => {
    setHistoryIndex(-1);
    preservedInput.current = "";
  }, []);

  return { cycleMessage, resetHistory };
}
