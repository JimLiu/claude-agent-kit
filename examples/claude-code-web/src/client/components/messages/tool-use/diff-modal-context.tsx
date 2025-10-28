import type {
  MouseEvent as ReactMouseEvent,
  PropsWithChildren,
  RefObject,
} from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { XIcon } from 'lucide-react';

import {
  disposeDiffModels,
  ensureDiffModels,
  getMonaco,
  resolveLanguage,
  type DiffModels,
} from './monaco-helpers';
import { useMonacoReady } from './use-monaco-ready';

interface DiffModalState {
  isOpen: boolean;
  original: string;
  modified: string;
  language?: string;
  filePath?: string;
}

interface DiffModalContextValue {
  modalState: DiffModalState;
  openModal: (args: DiffModalOpenArgs) => void;
  closeModal: () => void;
}

export interface DiffModalOpenArgs {
  original: string;
  modified: string;
  language?: string;
  filePath?: string;
}

const DiffModalContext = createContext<DiffModalContextValue | undefined>(undefined);

const initialState: DiffModalState = {
  isOpen: false,
  original: '',
  modified: '',
  language: undefined,
  filePath: undefined,
};

export function DiffModalProvider({ children }: PropsWithChildren): JSX.Element {
  const [modalState, setModalState] = useState<DiffModalState>(initialState);

  const openModal = useCallback((args: DiffModalOpenArgs) => {
    setModalState({
      isOpen: true,
      original: args.original,
      modified: args.modified,
      language: args.language,
      filePath: args.filePath,
    });
  }, []);

  const closeModal = useCallback(() => {
    setModalState((current) => ({
      ...current,
      isOpen: false,
    }));
  }, []);

  const value = useMemo<DiffModalContextValue>(
    () => ({
      modalState,
      openModal,
      closeModal,
    }),
    [modalState, openModal, closeModal],
  );

  return (
    <DiffModalContext.Provider value={value}>
      {children}
      <DiffModal />
    </DiffModalContext.Provider>
  );
}

export function useDiffModal(): DiffModalContextValue {
  const context = useContext(DiffModalContext);
  if (!context) {
    throw new Error('useDiffModal must be used within a DiffModalProvider');
  }
  return context;
}

function DiffModal(): JSX.Element | null {
  const { modalState, closeModal } = useDiffModal();
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ReturnType<typeof ensureEditor>['editor']>(null);
  const modelsRef = useRef<DiffModels>({ original: null, modified: null });
  const monacoReady = useMonacoReady();

  useEffect(() => {
    if (!modalState.isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeModal();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [modalState.isOpen, closeModal]);

  useEffect(() => {
    if (!modalState.isOpen || !monacoReady) {
      return;
    }

    const { editor, monaco } = ensureEditor(containerRef);
    if (!editor || !monaco) {
      return;
    }

    editorRef.current = editor;

    return () => {
      editor.dispose();
      editorRef.current = null;
      disposeDiffModels(modelsRef);
    };
  }, [modalState.isOpen, monacoReady]);

  useEffect(() => {
    if (!modalState.isOpen || !monacoReady) {
      return;
    }

    const monaco = getMonaco();
    const editor = editorRef.current;
    if (!monaco || !editor) {
      return;
    }

    const language = resolveLanguage(monaco, modalState.language, modalState.filePath);
    const models = ensureDiffModels(monaco, modelsRef, modalState.original, modalState.modified, language);
    if (!models.original || !models.modified) {
      return;
    }

    editor.setModel({
      original: models.original,
      modified: models.modified,
    });
  }, [modalState, monacoReady]);

  const handleBackdropClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        closeModal();
      }
    },
    [closeModal],
  );

  if (!modalState.isOpen || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-background/95 p-4"
      onClick={handleBackdropClick}
    >
      <div className="flex h-[calc(100vh-40px)] w-[calc(100vw-40px)] max-h-[900px] max-w-[1400px] flex-col overflow-hidden rounded border border-border bg-background shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-3 border-b border-border bg-secondary px-3 py-2">
          <div className="min-w-0 flex-1 truncate font-semibold">
            {modalState.filePath ?? 'Diff View'}
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="flex items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0"
            aria-label="Close"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        <div ref={containerRef} className="h-full w-full flex-1">
          {!monacoReady && (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Unable to load diff viewer.
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ensureEditor(containerRef: RefObject<HTMLDivElement>) {
  const monaco = getMonaco();
  if (!monaco || !containerRef.current) {
    return { editor: null, monaco };
  }

  const lightbulbMode = monaco.editor.ShowLightbulbIconMode?.Off ?? 0;
  const editor = monaco.editor.createDiffEditor(containerRef.current, {
    readOnly: true,
    renderSideBySide: true,
    renderOverviewRuler: true,
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
      vertical: 'auto',
      horizontal: 'auto',
    },
  } as Record<string, unknown>);

  return { editor, monaco };
}
