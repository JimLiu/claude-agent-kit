import { useCallback, useEffect, useRef, useState } from 'react'

import type { SessionSDKOptions } from '@claude-agent-kit/server'

import { ROUTE_CHANGE_EVENT, parseRoute } from '@/lib/route'

type WebSocketPayload = Record<string, unknown>

interface UseWebSocketOptions {
  url: string | null
  onMessage?: (message: WebSocketPayload) => void
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Event) => void
  reconnectDelay?: number
  maxReconnectAttempts?: number
}

interface UseWebSocketResult {
  isConnected: boolean
  reconnectAttempts: number
  sendMessage: (message: WebSocketPayload) => void
  setSDKOptions: (
    options: Partial<SessionSDKOptions>,
    sessionId?: string | null,
  ) => void
  disconnect: () => void
  reconnect: () => void
}

export function useWebSocket({
  url,
  onMessage,
  onConnect,
  onDisconnect,
  onError,
  reconnectDelay = 3000,
  maxReconnectAttempts = 5,
}: UseWebSocketOptions): UseWebSocketResult {
  const [isConnected, setIsConnected] = useState(false)
  const [reconnectAttempts, setReconnectAttempts] = useState(0)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const messageQueueRef = useRef<string[]>([])
  const reconnectAttemptsRef = useRef(0)
  const shouldReconnectRef = useRef(true)
  const routeSessionIdRef = useRef<string | null>(null)
  const handlersRef = useRef({
    onMessage,
    onConnect,
    onDisconnect,
    onError,
  })

  useEffect(() => {
    handlersRef.current = { onMessage, onConnect, onDisconnect, onError }
  }, [onMessage, onConnect, onDisconnect, onError])

  const teardown = useCallback(() => {
    if (reconnectTimeoutRef.current !== null) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  const sendResumeMessage = useCallback((sessionId: string | null) => {
    if (!sessionId) {
      return
    }

    const socket = wsRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return
    }

    socket.send(
      JSON.stringify({
        type: 'resume',
        sessionId,
      }),
    )
  }, [])

  const connect = useCallback(() => {
    if (!url || typeof window === 'undefined') {
      return
    }

    shouldReconnectRef.current = false
    teardown()
    shouldReconnectRef.current = true

    try {
      const socket = new WebSocket(url)
      wsRef.current = socket

      socket.onopen = () => {
        setIsConnected(true)
        reconnectAttemptsRef.current = 0
        setReconnectAttempts(0)
        handlersRef.current.onConnect?.()

        const sessionId = getSessionIdFromLocation()
        routeSessionIdRef.current = sessionId
        sendResumeMessage(sessionId)

        while (messageQueueRef.current.length > 0) {
          const payload = messageQueueRef.current.shift()
          if (payload) {
            socket.send(payload)
          }
        }
      }

      socket.onmessage = (event: MessageEvent<string>) => {
        try {
          const parsed = JSON.parse(event.data) as WebSocketPayload
          handlersRef.current.onMessage?.(parsed)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      socket.onerror = (event) => {
        handlersRef.current.onError?.(event)
      }

      socket.onclose = () => {
        setIsConnected(false)
        handlersRef.current.onDisconnect?.()
        wsRef.current = null

        if (
          shouldReconnectRef.current &&
          reconnectAttemptsRef.current < maxReconnectAttempts
        ) {
          const nextAttempt = reconnectAttemptsRef.current + 1
          reconnectAttemptsRef.current = nextAttempt
          setReconnectAttempts(nextAttempt)

          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, reconnectDelay)
        }
      }
    } catch (error) {
      console.error('Failed to establish WebSocket connection:', error)
    }
  }, [url, teardown, reconnectDelay, maxReconnectAttempts, sendResumeMessage])

  const sendMessage = useCallback(
    (message: WebSocketPayload) => {
      const serialized = JSON.stringify(message)
      const socket = wsRef.current

      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(serialized)
        return
      }

      messageQueueRef.current.push(serialized)

      if (!isConnected && reconnectAttemptsRef.current >= maxReconnectAttempts) {
        reconnectAttemptsRef.current = 0
        setReconnectAttempts(0)
        connect()
      }
    },
    [isConnected, maxReconnectAttempts, connect],
  )

  const setSDKOptions = useCallback(
    (options: Partial<SessionSDKOptions>, sessionId?: string | null) => {
      const payload: WebSocketPayload = {
        type: 'setSDKOptions',
        options,
      }

      if (sessionId !== undefined) {
        payload.sessionId = sessionId
      }

      sendMessage(payload)
    },
    [sendMessage],
  )

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false
    teardown()
    setIsConnected(false)
    reconnectAttemptsRef.current = 0
    setReconnectAttempts(0)
  }, [teardown])

  const reconnectNow = useCallback(() => {
    shouldReconnectRef.current = true
    reconnectAttemptsRef.current = 0
    setReconnectAttempts(0)
    connect()
  }, [connect])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleRouteChange = () => {
      const nextSessionId = getSessionIdFromLocation()
      const previousSessionId = routeSessionIdRef.current
      routeSessionIdRef.current = nextSessionId

      if (nextSessionId && nextSessionId !== previousSessionId) {
        sendResumeMessage(nextSessionId)
      }
    }

    handleRouteChange()

    window.addEventListener('popstate', handleRouteChange)
    window.addEventListener(ROUTE_CHANGE_EVENT, handleRouteChange)

    return () => {
      window.removeEventListener('popstate', handleRouteChange)
      window.removeEventListener(ROUTE_CHANGE_EVENT, handleRouteChange)
    }
  }, [sendResumeMessage])

  useEffect(() => {
    connect()

    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return {
    isConnected,
    reconnectAttempts,
    sendMessage,
    setSDKOptions,
    disconnect,
    reconnect: reconnectNow,
  }
}

function getSessionIdFromLocation(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  const { sessionId } = parseRoute(window.location.pathname)
  return sessionId
}
