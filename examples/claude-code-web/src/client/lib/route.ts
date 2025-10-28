export const ROUTE_CHANGE_EVENT = 'claude-route-change'

export type RouteState = {
  projectId: string | null
  sessionId: string | null
}

export type NavigateOptions = {
  replace?: boolean
}

export function parseRoute(pathname: string): RouteState {
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length < 2 || segments[0] !== 'projects') {
    return {
      projectId: null,
      sessionId: null,
    }
  }

  const projectSegment = segments[1] ?? ''
  const projectId = projectSegment ? decodeURIComponent(projectSegment) : null

  if (!projectId) {
    return {
      projectId: null,
      sessionId: null,
    }
  }

  if (segments.length >= 4 && segments[2] === 'sessions') {
    const sessionSegment = segments[3] ?? ''
    const sessionId = sessionSegment ? decodeURIComponent(sessionSegment) : null

    return {
      projectId,
      sessionId,
    }
  }

  return {
    projectId,
    sessionId: null,
  }
}

export function buildProjectPath(projectId: string): string {
  return `/projects/${encodeURIComponent(projectId)}`
}

export function buildSessionPath(projectId: string, sessionId: string): string {
  return `/projects/${encodeURIComponent(projectId)}/sessions/${encodeURIComponent(sessionId)}`
}

export function navigateTo(path: string, options: NavigateOptions = {}): void {
  if (typeof window === 'undefined' || typeof window.history === 'undefined') {
    return
  }

  const method: 'pushState' | 'replaceState' = options.replace
    ? 'replaceState'
    : 'pushState'

  if (window.location.pathname === path && !options.replace) {
    window.dispatchEvent(new Event(ROUTE_CHANGE_EVENT))
    return
  }

  window.history[method]({}, '', path)
  window.dispatchEvent(new Event(ROUTE_CHANGE_EVENT))
}
