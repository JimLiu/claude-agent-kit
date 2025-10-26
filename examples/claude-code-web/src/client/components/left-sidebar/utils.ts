export function computeLatestActivity(
  sessions: Array<{ lastMessageAt: number; firstMessageAt: number }>,
): number | null {
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return null
  }

  const timestamps = sessions
    .map((session) => normalizeTimestamp(session.lastMessageAt ?? session.firstMessageAt))
    .filter((value): value is number => value !== null)

  if (timestamps.length === 0) {
    return null
  }

  return Math.max(...timestamps)
}

export function normalizeTimestamp(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }

  return value < 1e12 ? value * 1000 : value
}

export function formatRelativeTime(timestamp: number | null | undefined): string {
  if (typeof timestamp !== 'number' || Number.isNaN(timestamp)) {
    return 'No activity'
  }

  const now = Date.now()
  const normalized = normalizeTimestamp(timestamp) ?? timestamp
  const diffMs = now - normalized

  if (!Number.isFinite(diffMs) || diffMs < 0) {
    return 'Just now'
  }

  const diffSeconds = Math.floor(diffMs / 1000)
  if (diffSeconds < 60) {
    return 'Just now'
  }

  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) {
    return `${diffMinutes} min${diffMinutes === 1 ? '' : 's'} ago`
  }

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) {
    return `${diffHours} hr${diffHours === 1 ? '' : 's'} ago`
  }

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
  }

  const diffWeeks = Math.floor(diffDays / 7)
  if (diffWeeks < 4) {
    return `${diffWeeks} wk${diffWeeks === 1 ? '' : 's'} ago`
  }

  const date = new Date(normalized)
  return date.toLocaleDateString()
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
