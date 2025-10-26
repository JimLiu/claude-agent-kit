export interface TextRangeMatch {
  query: string;
  start: number;
  end: number;
}

export function replaceRangeWithValue(
  source: string,
  range: TextRangeMatch,
  value: string,
  includeTrigger: boolean = false,
): string {
  const before = source.substring(0, range.start);
  const after = source.substring(range.end);
  const trigger = includeTrigger ? source[range.start] : "";
  const needsSpace = after.startsWith(" ") ? "" : " ";
  return `${before}${trigger}${value}${needsSpace}${after}`;
}

export function removeRange(source: string, range: TextRangeMatch): string {
  const before = source.substring(0, range.start);
  const after = source.substring(range.end);
  return `${before}${after}`;
}

export function getSelectionOffset(selection: Selection | null, root: Node | null): number | undefined {
  if (typeof document === "undefined") {
    return undefined;
  }

  if (!selection || selection.rangeCount === 0 || !root) {
    return undefined;
  }

  const range = selection.getRangeAt(0);
  const startRange = document.createRange();
  startRange.setStart(root, 0);
  startRange.setEnd(range.startContainer, range.startOffset);
  return startRange.toString().length;
}

export function findRangeMatch(
  source: string,
  offset: number | undefined,
  pattern: RegExp,
  trigger: string,
): TextRangeMatch | undefined {
  if (offset === undefined) {
    return undefined;
  }

  const matches = Array.from(source.matchAll(pattern));
  for (const match of matches) {
    const index = match.index;
    if (index === undefined) {
      continue;
    }

    const triggerIndex = source.indexOf(trigger, index);
    const endIndex = index + match[0].length;

    if (offset >= triggerIndex && offset <= endIndex) {
      return {
        query: source.substring(triggerIndex + 1, endIndex),
        start: triggerIndex,
        end: endIndex,
      };
    }
  }

  return undefined;
}
