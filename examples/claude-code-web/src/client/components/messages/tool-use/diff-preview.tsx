import type { RefObject } from 'react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useDiffModal } from './diff-modal-context';
import { useMonacoReady } from './use-monaco-ready';
import {
  disposeDiffModels,
  ensureDiffModels,
  getMonaco,
  resolveLanguage,
  type DiffModels,
  type MonacoApi,
} from './monaco-helpers';

interface DiffPreviewProps {
  original: string;
  modified: string;
  language?: string;
  filePath?: string;
}

const MAX_HEIGHT = 200;
const LINE_HEIGHT = 19;
const SIDE_BY_SIDE_PADDING = 20;
const STACKED_PADDING = 60;

export const DiffPreview: React.FC<DiffPreviewProps> = ({ original, modified, language, filePath }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ReturnType<typeof createEditor>['editor']>(null);
  const modelsRef = useRef<DiffModels>({ original: null, modified: null });
  const languageRef = useRef<string>(language ?? 'plaintext');

  const [isStacked, setIsStacked] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const monacoReady = useMonacoReady();
  const { openModal } = useDiffModal();

  const calculateHeight = useCallback(() => {
    const originalLines = original.split('\n').length;
    const modifiedLines = modified.split('\n').length;
    const visibleLines = isStacked ? originalLines + modifiedLines : Math.max(originalLines, modifiedLines);
    const padding = isStacked ? STACKED_PADDING : SIDE_BY_SIDE_PADDING;
    const fullHeight = visibleLines * LINE_HEIGHT + padding;
    const clamped = Math.min(MAX_HEIGHT, Math.max(0, fullHeight));
    setIsTruncated(fullHeight > MAX_HEIGHT);
    return clamped;
  }, [original, modified, isStacked]);

  const updateHeight = useCallback(() => {
    if (!containerRef.current) {
      return;
    }
    const height = calculateHeight();
    containerRef.current.style.height = `${height}px`;
  }, [calculateHeight]);

  useEffect(() => {
    if (!monacoReady) {
      return;
    }

    const { editor, monaco } = createEditor(containerRef);
    editorRef.current = editor;

    if (!editor || !monaco) {
      return () => {};
    }

    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver((entries) => {
            for (const entry of entries) {
              const isWide = entry.contentRect.width > 700;
              setIsStacked(!isWide);
              editor.updateOptions({ renderSideBySide: isWide } as Record<string, unknown>);
            }
          })
        : null;

    if (wrapperRef.current) {
      const width = wrapperRef.current.getBoundingClientRect().width;
      const isWide = width > 700;
      setIsStacked(!isWide);
      editor.updateOptions({ renderSideBySide: isWide } as Record<string, unknown>);
    }

    if (observer && wrapperRef.current) {
      observer.observe(wrapperRef.current);
    }

    return () => {
      observer?.disconnect();
      editor.dispose();
      editorRef.current = null;
      disposeDiffModels(modelsRef);
    };
  }, [monacoReady]);

  useEffect(() => {
    updateHeight();
  }, [updateHeight, isStacked]);

  useEffect(() => {
    updateHeight();
  }, [original, modified, updateHeight]);

  useEffect(() => {
    if (!monacoReady) {
      return;
    }

    const monaco = getMonaco();
    const editor = editorRef.current;
    if (!monaco || !editor) {
      return;
    }

    const resolvedLanguage = resolveLanguage(monaco, language, filePath);
    languageRef.current = resolvedLanguage;

    const models = ensureDiffModels(monaco, modelsRef, original, modified, resolvedLanguage);
    if (!models.original || !models.modified) {
      return;
    }

    editor.setModel({
      original: models.original,
      modified: models.modified,
    });
  }, [original, modified, language, filePath, monacoReady]);

  const handleExpand = useCallback(() => {
    openModal({
      original,
      modified,
      language: languageRef.current,
      filePath,
    });
  }, [openModal, original, modified, filePath]);

  return (
    <div
      ref={wrapperRef}
      className="relative col-span-full w-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        ref={containerRef}
        className="w-full max-h-[200px] overflow-hidden rounded border border-primary/40 bg-background transition-[height] duration-200 ease-in-out"
      >
        {!monacoReady && (
          <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
            Diff preview unavailable.
          </div>
        )}
      </div>
      {isTruncated && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[30px] rounded-b bg-gradient-to-b from-transparent to-[#1E1E1E]" />
      )}
      <button
        type="button"
        onClick={handleExpand}
        className="group absolute inset-0 flex cursor-pointer items-end justify-end rounded border border-transparent bg-transparent transition-colors duration-200 focus:outline-none focus-visible:border-primary/40 focus-visible:ring-0 hover:bg-black/5"
        aria-label="Expand diff"
      >
        {isHovered && (
          <span className="m-2 flex items-center rounded bg-popover px-2 py-1 text-[11px] text-popover-foreground shadow-sm transition-transform duration-200 group-hover:scale-105 group-hover:shadow-lg">
            Click to expand
          </span>
        )}
      </button>
    </div>
  );
}

function createEditor(containerRef: RefObject<HTMLDivElement | null>) {
  const monaco = getMonaco();
  if (!monaco || !containerRef.current) {
    return {
      editor: null as ReturnType<MonacoApi['editor']['createDiffEditor']> | null,
      monaco,
    };
  }

  const lightbulbMode = monaco.editor.ShowLightbulbIconMode?.Off ?? 0;
  const editor = monaco.editor.createDiffEditor(containerRef.current, {
    readOnly: true,
    renderSideBySide: true,
    renderOverviewRuler: false,
    scrollBeyondLastLine: false,
    minimap: { enabled: false },
    automaticLayout: true,
    theme: 'vs-dark',
    fontSize: 12,
    lineNumbers: 'off',
    wordWrap: 'on',
    wrappingIndent: 'same',
    lightbulb: { enabled: lightbulbMode },
    scrollbar: {
      vertical: 'hidden',
      horizontal: 'hidden',
      verticalScrollbarSize: 0,
      handleMouseWheel: false,
    },
  } as Record<string, unknown>);

  return { editor, monaco };
}
