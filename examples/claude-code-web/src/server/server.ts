import { createServer as createHttpServer } from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import express from 'express'
import type { ViteDevServer } from 'vite'
import { WebSocketServer } from 'ws'

import { SimpleClaudeAgentSDKClient } from '@claude-agent-kit/server'
import { WebSocketHandler } from '@claude-agent-kit/websocket'
import { registerApiRoutes } from './api'
import { registerRoutes } from './routes'

export interface CreateServerOptions {
  root?: string
}

export async function createServer(options: CreateServerOptions = {}) {
  const root = options.root ?? process.cwd()
  const isProduction = process.env.NODE_ENV === 'production'
  const base = process.env.BASE ?? '/'

  const app = express()
  const httpServer = createHttpServer(app)
  const webSocketServer = new WebSocketServer({ server: httpServer })
  const sdkClient = new SimpleClaudeAgentSDKClient()
  const webSocketHandler = new WebSocketHandler(sdkClient, {
    thinkingLevel: 'default_on',
  })

  webSocketServer.on('connection', (ws) => {
    void webSocketHandler.onOpen(ws)

    ws.on('message', (data) => {
      const text = typeof data === 'string' ? data : data.toString()
      webSocketHandler.onMessage(ws, text).catch((error) => {
        console.error('Failed to handle WebSocket message', error)
      })
    })

    ws.on('close', () => {
      webSocketHandler.onClose(ws)
    })

    ws.on('error', (error) => {
      console.error('WebSocket client error', error)
    })
  })

  let templateHtml = ''
  let vite: ViteDevServer | undefined

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite')
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
      base,
    })
    app.use(vite.middlewares)
  } else {
    templateHtml = await fs.readFile(path.resolve(root, 'dist/client/index.html'), 'utf-8')
    const compression = (await import('compression')).default
    const sirv = (await import('sirv')).default
    app.use(compression())
    app.use(base, sirv(path.resolve(root, 'dist/client'), { extensions: [] }))
  }

  registerApiRoutes(app)

  registerRoutes(app, {
    base,
    isProduction,
    root,
    templateHtml,
    vite,
  })

  return { app, vite, httpServer, webSocketServer }
}
