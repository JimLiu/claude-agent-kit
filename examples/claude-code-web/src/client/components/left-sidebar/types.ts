export type Project = {
  id: string
  name: string
  path: string
}

export type ProjectWithActivity = Project & {
  latestActivity: number | null
}

export type SessionSummary = {
  id: string
  prompt: string
  firstMessageAt: number
  lastMessageAt: number
}

export type SessionSelectPayload = {
  sessionId: string
  projectId: string
}

export type LeftSidebarProps = {
  selectedSessionId?: string | null
  onSessionSelect?: (payload: SessionSelectPayload) => void
  onProjectChange?: (projectId: string | null) => void
  onNewSession?: () => void
}
