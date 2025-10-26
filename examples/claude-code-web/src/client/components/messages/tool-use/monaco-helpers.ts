import type { MutableRefObject } from 'react';

export interface MonacoModel {
  setValue(value: string): void;
  getLanguageId?(): string;
  dispose(): void;
}

export interface MonacoDiffEditor {
  updateOptions(options: Record<string, unknown>): void;
  setModel(model: { original: MonacoModel; modified: MonacoModel }): void;
  dispose(): void;
}

export interface MonacoEditorApi {
  createDiffEditor(container: HTMLElement, options: Record<string, unknown>): MonacoDiffEditor;
  createModel(value: string, language?: string | null, uri?: unknown): MonacoModel;
  setModelLanguage(model: MonacoModel, language: string): void;
  ShowLightbulbIconMode?: {
    Off?: number;
  };
}

export interface MonacoApi {
  editor: MonacoEditorApi;
  Uri?: {
    file?(path: string): unknown;
  };
}

export interface DiffModels {
  original: MonacoModel | null;
  modified: MonacoModel | null;
}

interface MonacoWindow extends Window {
  monaco?: MonacoApi;
}

export function getMonaco(): MonacoApi | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const candidate = (window as MonacoWindow).monaco;
  if (!candidate || typeof candidate.editor?.createDiffEditor !== 'function') {
    return undefined;
  }

  return candidate;
}

export function resolveLanguage(
  monaco: MonacoApi,
  fallback: string | undefined,
  filePath: string | undefined,
): string {
  let language = fallback || 'plaintext';

  if (filePath && (!fallback || fallback === 'plaintext')) {
    try {
      const uri = monaco.Uri?.file?.(filePath);
      const tempModel = monaco.editor.createModel('', undefined, uri);
      const detected = tempModel.getLanguageId?.();
      tempModel.dispose();
      if (detected) {
        language = detected;
      }
    } catch {
      // Best-effort language detection; ignore failures.
    }
  }

  return language;
}

export function ensureDiffModels(
  monaco: MonacoApi,
  modelsRef: MutableRefObject<DiffModels>,
  original: string,
  modified: string,
  language: string,
): DiffModels {
  const models = modelsRef.current;

  if (models.original) {
    models.original.setValue(original);
    monaco.editor.setModelLanguage(models.original, language);
  } else {
    models.original = monaco.editor.createModel(original, language);
  }

  if (models.modified) {
    models.modified.setValue(modified);
    monaco.editor.setModelLanguage(models.modified, language);
  } else {
    models.modified = monaco.editor.createModel(modified, language);
  }

  return models;
}

export function disposeDiffModels(modelsRef: MutableRefObject<DiffModels>): void {
  const { original, modified } = modelsRef.current;
  if (original) {
    original.dispose();
  }
  if (modified) {
    modified.dispose();
  }
  modelsRef.current = { original: null, modified: null };
}
