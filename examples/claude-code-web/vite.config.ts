import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import monacoEditorPluginImport from 'vite-plugin-monaco-editor'
import { defineConfig } from 'vite'

const monacoEditorPlugin =
  ((monacoEditorPluginImport as unknown as {
    default?: typeof monacoEditorPluginImport
  }).default ?? monacoEditorPluginImport) as typeof monacoEditorPluginImport

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    monacoEditorPlugin({
      languageWorkers: ['editorWorkerService', 'typescript', 'json', 'css', 'html'],
      globalAPI: true,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/client'),
    },
  },
})
