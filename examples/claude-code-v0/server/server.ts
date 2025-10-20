import "dotenv/config";
import { WebSocketHandler } from "../ccsdk/websocket-handler";
import type { WSClient } from "../ccsdk/types";
import {
  handlePingEndpoint,
  handleWorkspaceSyncEndpoint,
} from "./endpoints";

const wsHandler = new WebSocketHandler();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const server = Bun.serve({
  port: 3000,
  idleTimeout: 120,

  websocket: {
    open(ws: WSClient) {
      wsHandler.onOpen(ws);
    },

    message(ws: WSClient, message: string) {
      wsHandler.onMessage(ws, message);
    },

    close(ws: WSClient) {
      wsHandler.onClose(ws);
    }
  },

  async fetch(req: Request, server: any) {
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === '/ws') {
      const sessionId = url.searchParams.get('sessionId') ?? '';
      const upgraded = server.upgrade(req, {
        data: { sessionId },
      });
      if (!upgraded) {
        return new Response('WebSocket upgrade failed', { status: 400 });
      }
      return;
    }

    if (url.pathname === '/' || /^\/s\/[^/]+$/.test(url.pathname)) {
      const file = Bun.file('./client/index.html');
      return new Response(file, {
        headers: {
          'Content-Type': 'text/html',
        },
      });
    }

    if (url.pathname.startsWith('/client/') && url.pathname.endsWith('.css')) {
      const filePath = `.${url.pathname}`;
      const file = Bun.file(filePath);

      if (await file.exists()) {
        try {
          const cssContent = await file.text();

          const postcss = require('postcss');
          const tailwindcss = require('@tailwindcss/postcss');
          const autoprefixer = require('autoprefixer');

          const result = await postcss([
            tailwindcss(),
            autoprefixer,
          ]).process(cssContent, {
            from: filePath,
            to: undefined
          });

          return new Response(result.css, {
            headers: {
              'Content-Type': 'text/css',
            },
          });
        } catch (error) {
          console.error('CSS processing error:', error);
          return new Response('CSS processing failed', { status: 500 });
        }
      }
    }

    if (url.pathname.startsWith('/client/') && (url.pathname.endsWith('.tsx') || url.pathname.endsWith('.ts'))) {
      const filePath = `.${url.pathname}`;
      const file = Bun.file(filePath);

      if (await file.exists()) {
        try {
          const transpiled = await Bun.build({
            entrypoints: [filePath],
            target: 'browser',
            format: 'esm',
          });

          if (transpiled.success) {
            const jsCode = await transpiled.outputs[0].text();
            return new Response(jsCode, {
              headers: {
                'Content-Type': 'application/javascript',
              },
            });
          }
        } catch (error) {
          console.error('Transpilation error:', error);
          return new Response('Transpilation failed', { status: 500 });
        }
      }
    }

    if (url.pathname === '/api/ping' && req.method === 'GET') {
      return handlePingEndpoint(req);
    }

    if (url.pathname === '/api/workspace/sync' && req.method === 'GET') {
      return handleWorkspaceSyncEndpoint(req);
    }

    if (url.pathname === '/api/chat' && req.method === 'POST') {
      return new Response(JSON.stringify({
        error: 'Please use WebSocket connection at /ws for chat'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
});

console.log(`Server running at http://localhost:${server.port}`);
console.log('WebSocket endpoint available at ws://localhost:3000/ws');
console.log('Visit http://localhost:3000 to view the  chat interface');
