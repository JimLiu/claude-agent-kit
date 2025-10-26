import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

export interface FileSuggestion {
  type: "file" | "directory";
  path: string;
  name: string;
}

export interface MentionFileListProps {
  searchQuery: string;
  onClose: () => void;
  onFileSelect: (file: FileSuggestion, triggeredByTab: boolean) => void;
  onListFiles: (query: string) => Promise<FileSuggestion[]>;
}

const MENU_POPUP_CLASS =
  "absolute left-0 right-0 bottom-full z-30 mb-2 flex max-h-[50vh] flex-col overflow-hidden rounded border border-border bg-popover animate-[bo_0.15s_ease-out]";
const FILE_LIST_CLASS = "max-h-[300px] overflow-y-auto p-[2px]";
const EMPTY_STATE_CLASS =
  "px-2 py-2 text-center text-muted-foreground";
const FILE_ITEM_CLASS =
  "flex cursor-pointer items-center gap-0 rounded-md px-3 py-2 text-foreground";
const ACTIVE_FILE_ITEM_CLASS =
  "bg-accent text-accent-foreground";
const FILE_CONTENT_CLASS =
  "flex flex-1 min-w-0 items-center gap-0";
const FILE_ICON_CLASS =
  "mr-[6px] flex h-5 w-5 flex-shrink-0 items-center justify-center text-foreground opacity-60";
const FILE_NAME_CLASS =
  "mr-4 flex-shrink-0 whitespace-nowrap font-normal";
const FILE_DIRECTORY_CLASS =
  "flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-right opacity-40 [direction:rtl]";
const DIRECTION_RESET_CLASS =
  "[direction:ltr] [unicode-bidi:plaintext]";

const FileIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M11.5859 2C11.9837 2.00004 12.3652 2.15818 12.6465 2.43945L15.5605 5.35352C15.8418 5.63478 16 6.01629 16 6.41406V16.5C16 17.3284 15.3284 18 14.5 18H5.5C4.72334 18 4.08461 17.4097 4.00781 16.6533L4 16.5V3.5C4 2.67157 4.67157 2 5.5 2H11.5859ZM5.5 3C5.22386 3 5 3.22386 5 3.5V16.5C5 16.7761 5.22386 17 5.5 17H14.5C14.7761 17 15 16.7761 15 16.5V7H12.5C11.6716 7 11 6.32843 11 5.5V3H5.5ZM12.54 13.3037C12.6486 13.05 12.9425 12.9317 13.1963 13.04C13.45 13.1486 13.5683 13.4425 13.46 13.6963C13.1651 14.3853 12.589 15 11.7998 15C11.3132 14.9999 10.908 14.7663 10.5996 14.4258C10.2913 14.7661 9.88667 14.9999 9.40039 15C8.91365 15 8.50769 14.7665 8.19922 14.4258C7.89083 14.7661 7.48636 15 7 15C6.72386 15 6.5 14.7761 6.5 14.5C6.5 14.2239 6.72386 14 7 14C7.21245 14 7.51918 13.8199 7.74023 13.3037L7.77441 13.2373C7.86451 13.0913 8.02513 13 8.2002 13C8.40022 13.0001 8.58145 13.1198 8.66016 13.3037C8.88121 13.8198 9.18796 14 9.40039 14C9.61284 13.9998 9.9197 13.8197 10.1406 13.3037L10.1748 13.2373C10.2649 13.0915 10.4248 13.0001 10.5996 13C10.7997 13 10.9808 13.1198 11.0596 13.3037C11.2806 13.8198 11.5874 13.9999 11.7998 14C12.0122 14 12.319 13.8198 12.54 13.3037ZM12.54 9.30371C12.6486 9.05001 12.9425 8.93174 13.1963 9.04004C13.45 9.14863 13.5683 9.44253 13.46 9.69629C13.1651 10.3853 12.589 11 11.7998 11C11.3132 10.9999 10.908 10.7663 10.5996 10.4258C10.2913 10.7661 9.88667 10.9999 9.40039 11C8.91365 11 8.50769 10.7665 8.19922 10.4258C7.89083 10.7661 7.48636 11 7 11C6.72386 11 6.5 10.7761 6.5 10.5C6.5 10.2239 6.72386 10 7 10C7.21245 10 7.51918 9.8199 7.74023 9.30371L7.77441 9.2373C7.86451 9.09126 8.02513 9 8.2002 9C8.40022 9.00008 8.58145 9.11981 8.66016 9.30371C8.88121 9.8198 9.18796 10 9.40039 10C9.61284 9.99978 9.9197 9.81969 10.1406 9.30371L10.1748 9.2373C10.2649 9.09147 10.4248 9.00014 10.5996 9C10.7997 9 10.9808 9.11975 11.0596 9.30371C11.2806 9.8198 11.5874 9.99989 11.7998 10C12.0122 10 12.319 9.81985 12.54 9.30371ZM12 5.5C12 5.77614 12.2239 6 12.5 6H14.793L12 3.20703V5.5Z" />
  </svg>
);

const DirectoryIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M16.5 3C17.3284 3 18 3.67157 18 4.5V15.5C18 16.3284 17.3284 17 16.5 17H3.5C2.67157 17 2 16.3284 2 15.5V6.5C2 5.67157 2.67157 5 3.5 5H10.793L12.3535 3.43945L12.4639 3.33984C12.7307 3.12123 13.0661 3.00003 13.4141 3H16.5ZM13.4141 4C13.3146 4.00003 13.2182 4.02961 13.1367 4.08398L13.0605 4.14648L11.3535 5.85352C11.2597 5.94728 11.1326 6 11 6H3.5C3.22386 6 3 6.22386 3 6.5V15.5C3 15.7761 3.22386 16 3.5 16H16.5C16.7761 16 17 15.7761 17 15.5V4.5C17 4.22386 16.7761 4 16.5 4H13.4141Z" />
  </svg>
);

export function MentionFileList({
  searchQuery,
  onClose,
  onFileSelect,
  onListFiles,
}: MentionFileListProps) {
  const [results, setResults] = useState<FileSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeItemRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      onListFiles(searchQuery)
        .then((files) => {
          setResults(files);
          setActiveIndex(0);
        })
        .catch(() => {
          setResults([]);
        });
    }, 200);
    return () => window.clearTimeout(timeout);
  }, [onListFiles, searchQuery]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowDown":
          if (results.length > 1) {
            event.preventDefault();
            setActiveIndex((index) =>
              index < results.length - 1 ? index + 1 : 0,
            );
          }
          break;
        case "ArrowUp":
          if (results.length > 1) {
            event.preventDefault();
            setActiveIndex((index) =>
              index > 0 ? index - 1 : results.length - 1,
            );
          }
          break;
        case "Tab":
        case "Enter":
          if (!event.shiftKey) {
            event.preventDefault();
            const entry = results[activeIndex];
            if (entry) {
              onFileSelect(entry, event.key === "Tab");
            }
          }
          break;
        case "Escape":
          event.preventDefault();
          onClose();
          break;
      }
    },
    [activeIndex, onClose, onFileSelect, results],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({
      behavior: "instant",
      block: "nearest",
    });
  }, [activeIndex]);

  return (
    <div ref={containerRef} className={MENU_POPUP_CLASS}>
      <div className={FILE_LIST_CLASS}>
        {results.length === 0 ? (
          <div className={EMPTY_STATE_CLASS}>No files found</div>
        ) : (
          results.map((file, index) => {
            const isActive = index === activeIndex;
            return (
              <div
                key={file.path}
                ref={isActive ? activeItemRef : null}
                className={cn(
                  FILE_ITEM_CLASS,
                  isActive && ACTIVE_FILE_ITEM_CLASS,
                )}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => onFileSelect(file, false)}
              >
                <div className={FILE_CONTENT_CLASS}>
                  {file.type === "file" ? (
                    <>
                      <div className={FILE_ICON_CLASS}>
                        <FileIcon />
                      </div>
                      <div className={FILE_NAME_CLASS}>{file.name}</div>
                      {file.path.length > file.name.length && (
                        <div className={FILE_DIRECTORY_CLASS}>
                          <span className={DIRECTION_RESET_CLASS}>
                            {file.path.substring(
                              0,
                              file.path.length - file.name.length,
                            )}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className={FILE_ICON_CLASS}>
                        <DirectoryIcon />
                      </div>
                      <div className={FILE_DIRECTORY_CLASS}>
                        <span className={DIRECTION_RESET_CLASS}>
                          {file.path}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
