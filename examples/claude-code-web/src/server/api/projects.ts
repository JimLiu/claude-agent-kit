import { readFile, readdir, stat } from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export interface ProjectInfo {
  id: string
  name: string
  path: string
}

export async function collectProjects(): Promise<ProjectInfo[]> {
  const projectsRoot = getProjectsRoot()
  if (!projectsRoot) {
    return []
  }

  let rootEntries: Dirent[]
  try {
    rootEntries = await readdir(projectsRoot, { withFileTypes: true })
  } catch {
    return []
  }

  const projects: ProjectInfo[] = []

  for (const entry of rootEntries) {
    if (!entry.isDirectory()) {
      continue
    }

    const projectDir = path.join(projectsRoot, entry.name)

    let candidateFiles: Dirent[]
    try {
      candidateFiles = await readdir(projectDir, { withFileTypes: true })
    } catch {
      continue
    }

    const jsonlFiles = candidateFiles.filter(
      (file) => file.isFile() && file.name.toLowerCase().endsWith('.jsonl'),
    )

    if (jsonlFiles.length === 0) {
      continue
    }

    let latestFilePath: string | null = null
    let latestMtime = -Infinity

    for (const file of jsonlFiles) {
      const filePath = path.join(projectDir, file.name)

      let statsResult
      try {
        statsResult = await stat(filePath)
      } catch {
        continue
      }

      if (statsResult.mtimeMs > latestMtime) {
        latestMtime = statsResult.mtimeMs
        latestFilePath = filePath
      }
    }

    if (!latestFilePath) {
      continue
    }

    const firstLine = await readFirstJsonLine(latestFilePath)
    if (!firstLine) {
      continue
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(firstLine)
    } catch {
      continue
    }

    const cwd = (parsed as { cwd?: unknown } | undefined)?.cwd
    if (typeof cwd !== 'string' || cwd.trim().length === 0) {
      continue
    }

    const name = path.basename(cwd)
    projects.push({ id: entry.name, name, path: cwd })
  }

  return projects
}

export function getProjectsRoot(): string | null {
  const homeDir = os.homedir()
  if (!homeDir || homeDir.trim().length === 0) {
    return null
  }

  return path.join(homeDir, '.claude', 'projects')
}

async function readFirstJsonLine(filePath: string): Promise<string | null> {
  let fileContent: string

  try {
    fileContent = await readFile(filePath, 'utf8')
  } catch {
    return null
  }

  if (fileContent.length === 0) {
    return null
  }

  const newlineIndex = fileContent.indexOf('\n')
  const firstLine = newlineIndex === -1 ? fileContent : fileContent.slice(0, newlineIndex)

  const trimmed = firstLine.trim()
  if (trimmed.length === 0) {
    return null
  }

  return trimmed.replace(/^\uFEFF/, '')
}
