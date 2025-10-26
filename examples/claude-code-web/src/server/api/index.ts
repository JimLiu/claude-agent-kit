import type { Express } from 'express'

import { collectProjects } from './projects'
import { collectSessionSummaries, readSessionDetails } from './project-sessions'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export function registerApiRoutes(app: Express) {
  app.use('/api', (req, res, next) => {
    res.set(corsHeaders)

    if (req.method === 'OPTIONS') {
      res.sendStatus(204)
      return
    }

    next()
  })

  app.get('/api/projects', async (_req, res) => {
    try {
      const projects = await collectProjects()
      res.json({ projects })
    } catch (error) {
      res
        .status(500)
        .json({ error: 'Failed to list projects', details: formatErrorMessage(error) })
    }
  })

  app.get('/api/projects/:projectId', async (req, res) => {
    const { projectId } = req.params

    try {
      const sessions = await collectSessionSummaries(projectId)

      if (sessions === null) {
        res.status(404).json({ error: `Project '${projectId}' not found` })
        return
      }

      res.json({ sessions })
    } catch (error) {
      res
        .status(500)
        .json({ error: 'Failed to list project sessions', details: formatErrorMessage(error) })
    }
  })

  app.get('/api/projects/:projectId/sessions/:sessionId', async (req, res) => {
    const { projectId, sessionId } = req.params

    try {
      const session = await readSessionDetails(projectId, sessionId)

      if (session === null) {
        res
          .status(404)
          .json({ error: `Session '${sessionId}' not found` })
        return
      }

      res.json(session)
    } catch (error) {
      res
        .status(500)
        .json({ error: 'Failed to read session details', details: formatErrorMessage(error) })
    }
  })
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return 'Unknown error'
}
