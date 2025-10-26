import { useCallback, useEffect, useState } from 'react'

import { ROUTE_CHANGE_EVENT, RouteState, parseRoute } from '@/lib/route'

function getInitialRoute(): RouteState {
  if (typeof window === 'undefined') {
    return {
      projectId: null,
      sessionId: null,
    }
  }

  return parseRoute(window.location.pathname)
}

export function useRoute(): RouteState {
  const [route, setRoute] = useState<RouteState>(() => getInitialRoute())

  const handleLocationChange = useCallback(() => {
    if (typeof window === 'undefined') {
      return
    }

    setRoute(parseRoute(window.location.pathname))
  }, [])

  useEffect(() => {
    window.addEventListener('popstate', handleLocationChange)
    window.addEventListener(ROUTE_CHANGE_EVENT, handleLocationChange)

    return () => {
      window.removeEventListener('popstate', handleLocationChange)
      window.removeEventListener(ROUTE_CHANGE_EVENT, handleLocationChange)
    }
  }, [handleLocationChange])

  return route
}
