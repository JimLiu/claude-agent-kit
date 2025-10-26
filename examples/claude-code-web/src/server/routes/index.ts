import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Express } from 'express'
import type { ViteDevServer } from 'vite'

interface RenderResult {
  head?: string
  html?: string
}

type RenderFunction = (url: string) => Promise<RenderResult> | RenderResult

interface RegisterRoutesOptions {
  base: string
  isProduction: boolean
  root: string
  templateHtml: string
  vite?: ViteDevServer
}

export function registerRoutes(app: Express, options: RegisterRoutesOptions) {
  app.use('*all', async (req, res) => {
    const url = req.originalUrl.replace(options.base, '')

    try {
      let template: string
      let render: RenderFunction

      if (!options.isProduction) {
        if (!options.vite) {
          throw new Error('Vite dev server has not been initialised')
        }

        template = await fs.readFile(path.resolve(options.root, 'index.html'), 'utf-8')
        template = await options.vite.transformIndexHtml(url, template)

        const ssrModule = await options.vite.ssrLoadModule('/src/client/entry-server.tsx')
        render = ssrModule.render as RenderFunction
      } else {
        template = options.templateHtml

        const serverEntry = pathToFileURL(path.resolve(options.root, 'dist/server/entry-server.js')).href
        const ssrModule = await import(serverEntry)
        render = ssrModule.render as RenderFunction
      }

      const rendered = await render(url)
      const html = template
        .replace(`<!--app-head-->`, rendered.head ?? '')
        .replace(`<!--app-html-->`, rendered.html ?? '')

      res.status(200).set({ 'Content-Type': 'text/html' }).send(html)
    } catch (error) {
      options.vite?.ssrFixStacktrace(error as Error)
      console.error((error as Error).stack)
      res.status(500).end((error as Error).stack)
    }
  })
}
