import { readFile, readdir } from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import path from 'node:path'

import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk'

import { parseSessionMessagesFromJsonl } from '@claude-agent-kit/server'

import { getProjectsRoot } from './projects'

export interface SessionSummary {
  id: string
  prompt: string
  firstMessageAt: number
  lastMessageAt: number
}

export interface SessionDetails {
  id: string
  messages: SDKMessage[]
}

export async function collectSessionSummaries(projectId: string): Promise<SessionSummary[] | null> {
  const projectsRoot = getProjectsRoot()
  if (!projectsRoot) {
    return []
  }

  const projectDir = path.join(projectsRoot, projectId)

  let entries: Dirent[]
  try {
    entries = await readdir(projectDir, { withFileTypes: true })
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return null
    }

    return []
  }

  const summaries: SessionSummary[] = []

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.jsonl')) {
      continue
    }

    const filePath = path.join(projectDir, entry.name)
    const summary = await buildSessionSummary(entry.name, filePath)
    if (!summary) {
      continue
    }

    summaries.push(summary)
  }

  summaries.sort((a, b) => b.lastMessageAt - a.lastMessageAt)
  return summaries
}

export async function readSessionDetails(
  projectId: string,
  sessionId: string,
): Promise<SessionDetails | null> {
  const projectsRoot = getProjectsRoot()
  if (!projectsRoot) {
    return { id: sessionId, messages: [] }
  }

  const normalizedId = normalizeSessionId(sessionId)
  const filePath = path.join(projectsRoot, projectId, `${normalizedId}.jsonl`)

  let fileContent: string
  try {
    fileContent = await readFile(filePath, 'utf8')
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return null
    }

    return { id: normalizedId, messages: [] }
  }

  const messages = parseSessionMessagesFromJsonl(fileContent)

  return { id: normalizedId, messages }
}

async function buildSessionSummary(fileName: string, filePath: string): Promise<SessionSummary | null> {
  let fileContent: string
  try {
    fileContent = await readFile(filePath, 'utf8')
  } catch {
    return null
  }

  const records = parseSessionMessagesFromJsonl(fileContent)
  if (records.length === 0) {
    return null
  }

  const firstRecord = records[0]
  const lastRecord = records[records.length - 1]

  const firstMessageAt =
    extractTimestamp((firstRecord as { firstMessageAt?: unknown }).firstMessageAt) ??
    extractTimestamp((firstRecord as { timestamp?: unknown }).timestamp)

  const lastMessageAt =
    extractTimestamp((lastRecord as { lastMessageAt?: unknown }).lastMessageAt) ??
    extractTimestamp((lastRecord as { timestamp?: unknown }).timestamp)

  if (firstMessageAt === null || lastMessageAt === null) {
    return null
  }

  const prompt =
    extractPrompt(firstRecord) ??
    extractPrompt((firstRecord as { message?: unknown }).message) ??
    ''

  return {
    id: normalizeSessionId(fileName),
    prompt,
    firstMessageAt,
    lastMessageAt,
  }
}

function extractTimestamp(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const numeric = Number(value)
    if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
      return numeric
    }

    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed)) {
      return parsed
    }
  }

  return null
}

function extractPrompt(source: unknown): string | null {
  if (!source || typeof source !== 'object') {
    return null
  }

  const record = source as Record<string, unknown>

  if (typeof record.prompt === 'string' && record.prompt.trim().length > 0) {
    return record.prompt.trim()
  }

  if (typeof record.text === 'string' && record.text.trim().length > 0) {
    return record.text.trim()
  }

  const message = record.message as Record<string, unknown> | undefined
  if (message) {
    const fromMessage = extractPrompt(message)
    if (fromMessage) {
      return fromMessage
    }
  }

  const content = record.content
  if (Array.isArray(content)) {
    for (const item of content) {
      if (!item || typeof item !== 'object') {
        continue
      }

      const entry = item as Record<string, unknown>
      if (entry.type === 'text' && typeof entry.text === 'string') {
        const text = entry.text.trim()
        if (text.length > 0) {
          return text
        }
      }
    }
  }

  return null
}

function normalizeSessionId(value: string): string {
  return value.toLowerCase().endsWith('.jsonl') ? value.slice(0, -6) : value
}

function isNotFoundError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'ENOENT',
  )
}
