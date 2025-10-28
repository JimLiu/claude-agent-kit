import { useCallback, useEffect, useMemo, useState } from 'react'

import { useRoute } from '@/hooks/use-route'
import { ScrollArea } from '@/components/ui/scroll-area'
import { buildProjectPath, buildSessionPath, navigateTo } from '@/lib/route'

import {
  LeftSidebarProps,
  Project,
  ProjectWithActivity,
  SessionSummary,
} from './types'
import { ProjectPicker } from './project-picker'
import { SessionList } from './session-list'
import { SidebarHeader } from './sidebar-header'
import { computeLatestActivity, isAbortError } from './utils'

const PROJECTS_ENDPOINT = '/api/projects'

export function LeftSidebar({
  onSessionSelect,
  onProjectChange,
  onNewSession,
}: LeftSidebarProps) {
  const { projectId: routeProjectId, sessionId: routeSessionId } = useRoute()

  const [projects, setProjects] = useState<ProjectWithActivity[]>([])
  const [projectSessions, setProjectSessions] = useState<
    Record<string, SessionSummary[]>
  >({})
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  )
  const [isProjectPickerOpen, setIsProjectPickerOpen] = useState(false)
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [isLoadingSessions, setIsLoadingSessions] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    let isMounted = true

    async function loadProjectsAndSessions() {
      setIsLoadingProjects(true)
      setIsLoadingSessions(true)
      setErrorMessage(null)

      try {
        const projectsResponse = await fetch(PROJECTS_ENDPOINT, {
          method: 'GET',
          signal: controller.signal,
        })

        if (!projectsResponse.ok) {
          throw new Error(
            `Failed to load projects (status ${projectsResponse.status})`,
          )
        }

        const body = (await projectsResponse.json()) as {
          projects?: Project[]
        }
        const fetchedProjects: Project[] = Array.isArray(body?.projects)
          ? body.projects
          : []

        if (!isMounted) {
          return
        }

        if (fetchedProjects.length === 0) {
          setProjects([])
          setProjectSessions({})
          setSelectedProjectId(null)
          setHasLoadedInitialData(true)
          return
        }

        const projectPayloads = await Promise.all(
          fetchedProjects.map(async (project) => {
            try {
              const sessions = await fetchProjectSessions(
                project.id,
                controller.signal,
              )
              return {
                project,
                sessions,
                latestActivity: computeLatestActivity(sessions),
              }
            } catch (error) {
              if (isAbortError(error)) {
                throw error
              }

              console.error(
                `Failed to load sessions for project '${project.id}':`,
                error,
              )
              return {
                project,
                sessions: [] as SessionSummary[],
                latestActivity: null,
              }
            }
          }),
        )

        projectPayloads.sort(
          (a, b) =>
            (b.latestActivity ?? Number.NEGATIVE_INFINITY) -
            (a.latestActivity ?? Number.NEGATIVE_INFINITY),
        )

        if (!isMounted) {
          return
        }

        const nextProjects: ProjectWithActivity[] = projectPayloads.map(
          ({ project, latestActivity }) => ({
            ...project,
            latestActivity,
          }),
        )

        const nextSessions = projectPayloads.reduce<
          Record<string, SessionSummary[]>
        >((acc, payload) => {
          acc[payload.project.id] = payload.sessions
          return acc
        }, {})

        setProjects(nextProjects)
        setProjectSessions(nextSessions)
        setHasLoadedInitialData(true)
      } catch (error) {
        if (isAbortError(error)) {
          return
        }

        console.error(error)
        if (isMounted) {
          setErrorMessage(
            error instanceof Error ? error.message : 'Failed to load projects.',
          )
          setProjects([])
          setProjectSessions({})
          setSelectedProjectId(null)
          setHasLoadedInitialData(true)
        }
      } finally {
        if (!controller.signal.aborted) {
          if (isMounted) {
            setIsLoadingProjects(false)
            setIsLoadingSessions(false)
          }
        }
      }
    }

    void loadProjectsAndSessions()

    return () => {
      isMounted = false
      controller.abort()
    }
  }, [])

  useEffect(() => {
    if (!hasLoadedInitialData) {
      return
    }

    if (projects.length === 0) {
      if (selectedProjectId !== null) {
        setSelectedProjectId(null)
      }
      return
    }

    const projectIds = new Set(projects.map((project) => project.id))

    if (routeProjectId && projectIds.has(routeProjectId)) {
      if (selectedProjectId !== routeProjectId) {
        setSelectedProjectId(routeProjectId)
      }
      return
    }

    const fallbackProjectId = projects[0]?.id ?? null
    if (!fallbackProjectId) {
      return
    }

    if (selectedProjectId !== fallbackProjectId) {
      setSelectedProjectId(fallbackProjectId)
    }

    if (routeProjectId !== fallbackProjectId) {
      navigateTo(buildProjectPath(fallbackProjectId), {
        replace: !routeProjectId,
      })
    }
  }, [hasLoadedInitialData, projects, routeProjectId, selectedProjectId])

  useEffect(() => {
    if (!hasLoadedInitialData) {
      return
    }

    onProjectChange?.(selectedProjectId)
  }, [selectedProjectId, onProjectChange, hasLoadedInitialData])

  useEffect(() => {
    const projectId = selectedProjectId
    if (!projectId) {
      return
    }

    if (projectSessions[projectId]) {
      return
    }

    const controller = new AbortController()
    let isMounted = true

    async function loadSessions(targetProjectId: string) {
      setIsLoadingSessions(true)
      setErrorMessage(null)

      try {
        const sessions = await fetchProjectSessions(
          targetProjectId,
          controller.signal,
        )

        if (!isMounted) {
          return
        }

        setProjectSessions((prev) => ({
          ...prev,
          [targetProjectId]: sessions,
        }))

        setProjects((prev) =>
          prev.map((project) =>
            project.id === targetProjectId
              ? {
                  ...project,
                  latestActivity: computeLatestActivity(sessions),
                }
              : project,
          ),
        )
      } catch (error) {
        if (isAbortError(error)) {
          return
        }

        console.error(error)
        if (isMounted) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Failed to load sessions.',
          )
        }
      } finally {
        if (isMounted) {
          setIsLoadingSessions(false)
        }
      }
    }

    void loadSessions(projectId)

    return () => {
      isMounted = false
      controller.abort()
    }
  }, [projectSessions, selectedProjectId])

  const currentProject = selectedProjectId
    ? projects.find((project) => project.id === selectedProjectId) ?? null
    : null

  const currentSessions = selectedProjectId
    ? projectSessions[selectedProjectId] ?? []
    : []

  const derivedSessionId = useMemo(() => {
    if (!currentSessions || currentSessions.length === 0) {
      return null
    }

    if (
      routeSessionId &&
      currentSessions.some((session) => session.id === routeSessionId)
    ) {
      return routeSessionId
    }

    return currentSessions[0]?.id ?? null
  }, [currentSessions, routeSessionId])

  useEffect(() => {
    if (!selectedProjectId) {
      return
    }

    if (!derivedSessionId) {
      return
    }

    const nextPath = buildSessionPath(selectedProjectId, derivedSessionId)

    if (!routeSessionId) {
      navigateTo(nextPath, { replace: true })
      onSessionSelect?.({
        sessionId: derivedSessionId,
        projectId: selectedProjectId,
      })
      return
    }

    if (routeSessionId !== derivedSessionId) {
      navigateTo(nextPath, { replace: true })
      onSessionSelect?.({
        sessionId: derivedSessionId,
        projectId: selectedProjectId,
      })
    }
  }, [
    selectedProjectId,
    routeSessionId,
    derivedSessionId,
    onSessionSelect,
  ])

  const handleProjectSelect = useCallback((projectId: string) => {
    setSelectedProjectId(projectId)
    setIsProjectPickerOpen(false)
    navigateTo(buildProjectPath(projectId))
  }, [])

  const handleSessionClick = useCallback(
    (sessionId: string) => {
      if (!selectedProjectId) {
        return
      }

      navigateTo(buildSessionPath(selectedProjectId, sessionId))
      onSessionSelect?.({ sessionId, projectId: selectedProjectId })
    },
    [onSessionSelect, selectedProjectId],
  )

  const effectiveSessionId = derivedSessionId

  return (
    <div className="flex h-full min-h-0 flex-col border-r bg-sidebar">
      <SidebarHeader
        onNewSession={onNewSession}
        disabled={!selectedProjectId}
        projectName={currentProject ? currentProject.name : null}
        latestActivity={currentProject ? currentProject.latestActivity : null}
      />
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="flex h-full flex-col px-2 py-3">
          <SessionList
            sessions={currentSessions}
            selectedSessionId={effectiveSessionId}
            onSelect={handleSessionClick}
            isLoading={isLoadingSessions}
            errorMessage={errorMessage}
          />
        </ScrollArea>
      </div>
      <div className="border-t px-3 py-3">
        <ProjectPicker
          projects={projects}
          selectedProjectId={selectedProjectId}
          isLoading={isLoadingProjects}
          isOpen={isProjectPickerOpen}
          onOpenChange={setIsProjectPickerOpen}
          onSelect={handleProjectSelect}
        />
      </div>
    </div>
  )
}

async function fetchProjectSessions(
  projectId: string,
  signal?: AbortSignal,
): Promise<SessionSummary[]> {
  const response = await fetch(
    `${PROJECTS_ENDPOINT}/${encodeURIComponent(projectId)}`,
    {
      method: 'GET',
      signal,
    },
  )

  if (!response.ok) {
    throw new Error(
      `Failed to load sessions for project '${projectId}' (status ${response.status})`,
    )
  }

  const body = (await response.json()) as { sessions?: SessionSummary[] }
  return Array.isArray(body?.sessions) ? body.sessions : []
}
