import { useEffect, useMemo, useState } from "react";

import {
  findRangeMatch,
  getSelectionOffset,
  TextRangeMatch,
} from "@/lib/mention-utils";

export interface MentionSlashMatches {
  atMention?: TextRangeMatch;
  slashCommand?: TextRangeMatch;
}

export function useMentionAndSlash(
  currentInput: string,
  editable: HTMLElement | null,
): MentionSlashMatches {
  const [, forceRerender] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!editable) {
      return;
    }

    const handleSelectionChange = () => {
      forceRerender((value) => value + 1);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDismissed(true);
      }
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    editable.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      editable.removeEventListener("keydown", handleKeyDown);
    };
  }, [editable]);

  const matches = useMemo(() => {
    if (typeof window === "undefined") {
      return { atMention: undefined, slashCommand: undefined };
    }

    const selectionOffset = getSelectionOffset(window.getSelection(), editable);
    return {
      atMention: findRangeMatch(
        currentInput,
        selectionOffset,
        /(?:^|\s)@[^\s]*/gm,
        "@",
      ),
      slashCommand: findRangeMatch(
        currentInput,
        selectionOffset,
        /(?:^|\s)\/[^\s/]*/gm,
        "/",
      ),
    };
  }, [currentInput, editable]);

  useEffect(() => {
    if (dismissed && !matches.atMention && !matches.slashCommand) {
      setDismissed(false);
    }
  }, [dismissed, matches.atMention, matches.slashCommand]);

  if (dismissed) {
    return { atMention: undefined, slashCommand: undefined };
  }

  return matches;
}
