import { getMonaco } from './monaco-helpers';

let loadPromise: Promise<void> | undefined;

export function ensureMonaco(): Promise<void> | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  if (getMonaco()) {
    return Promise.resolve();
  }

  if (!loadPromise) {
    const globalObject = typeof self !== 'undefined' ? (self as unknown as Record<string, unknown>) : (window as unknown as Record<string, unknown>);
    const existing = (globalObject.MonacoEnvironment ?? {}) as Record<string, unknown>;
    globalObject.MonacoEnvironment = { ...existing, globalAPI: true };

    loadPromise = (async () => {
      await import('monaco-editor/esm/vs/editor/editor.api');
      await import('monaco-editor/esm/vs/editor/editor.all');
      await import('monaco-editor/esm/vs/basic-languages/monaco.contribution');
    })();
  }

  return loadPromise;
}
