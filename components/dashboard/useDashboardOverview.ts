'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase.client'
import type { DashboardSidebar, DashboardSummary } from '@/lib/dashboard/types'
import { consumeDashboardOverviewStream, type DashboardOverviewStreamEvent } from '@/lib/dashboard/overview-stream'

type SourceError = { code: string; message: string; detail?: string }
type OverviewEvent = DashboardOverviewStreamEvent<DashboardSummary, DashboardSidebar>
type OverviewSource = OverviewEvent['source']
type OverviewListener = (event: OverviewEvent) => void

type ActiveOverviewRequest = {
  controller: AbortController
  listeners: Set<OverviewListener>
  events: Partial<Record<OverviewSource, OverviewEvent>>
  settled: boolean
  abortTimer?: ReturnType<typeof setTimeout>
}

// A request is shared only inside the same SWR cache, user, and period. The short
// deferred abort lets React Strict Mode's effect cleanup/remount rejoin one request.
const activeOverviewRequests = new WeakMap<object, Map<string, ActiveOverviewRequest>>()

function subscribeOverviewRequest(
  cache: object,
  requestKey: string,
  period: string,
  listener: OverviewListener,
) {
  let cacheRequests = activeOverviewRequests.get(cache)
  if (!cacheRequests) {
    cacheRequests = new Map()
    activeOverviewRequests.set(cache, cacheRequests)
  }

  let request = cacheRequests.get(requestKey)
  const startRequest = !request || request.settled || request.controller.signal.aborted
  if (startRequest) {
    request = {
      controller: new AbortController(),
      listeners: new Set(),
      events: {},
      settled: false,
    }
    cacheRequests.set(requestKey, request)
  }
  const activeRequest = request!

  if (activeRequest.abortTimer) clearTimeout(activeRequest.abortTimer)
  activeRequest.listeners.add(listener)
  for (const source of ['summary', 'sidebar'] as const) {
    const event = activeRequest.events[source]
    if (event) listener(event)
  }

  if (startRequest) {
    const publish = (event: OverviewEvent) => {
      activeRequest.events[event.source] = event
      activeRequest.listeners.forEach(subscriber => subscriber(event))
    }

    void fetch(`/api/dashboard/overview?period=${encodeURIComponent(period)}`, {
      credentials: 'same-origin',
      cache: 'no-store',
      signal: activeRequest.controller.signal,
    }).then(response => consumeDashboardOverviewStream<DashboardSummary, DashboardSidebar>(response, publish)).catch(error => {
      if (activeRequest.controller.signal.aborted) return
      const failure = error instanceof Error ? error : new Error('No se pudo cargar Inicio.')
      const sourceError = { code: 'OVERVIEW_LOAD_FAILED', message: failure.message }
      publish({ source: 'summary', data: null, error: sourceError })
      publish({ source: 'sidebar', data: null, error: sourceError })
    }).finally(() => {
      activeRequest.settled = true
      if (cacheRequests?.get(requestKey) === activeRequest) cacheRequests.delete(requestKey)
    })
  }

  return () => {
    activeRequest.listeners.delete(listener)
    if (activeRequest.settled || activeRequest.listeners.size > 0 || activeRequest.abortTimer) return
    activeRequest.abortTimer = setTimeout(() => {
      activeRequest.abortTimer = undefined
      if (activeRequest.settled || activeRequest.listeners.size > 0) return
      activeRequest.controller.abort()
      if (cacheRequests?.get(requestKey) === activeRequest) cacheRequests.delete(requestKey)
    }, 0)
  }
}

function useDashboardSession() {
  const [session, setSession] = useState<{ ready: boolean; userId: string | null }>({ ready: false, userId: null })

  useEffect(() => {
    const supabase = createClient()
    let observedAuthEvent = false
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      observedAuthEvent = true
      const userId = nextSession?.user?.id ?? null
      setSession(previous => previous.ready && previous.userId === userId
        ? previous
        : { ready: true, userId })
    })

    void supabase.auth.getSession().then(({ data, error }) => {
      if (observedAuthEvent) return
      const userId = error ? null : data.session?.user?.id ?? null
      setSession(previous => previous.ready && previous.userId === userId
        ? previous
        : { ready: true, userId })
    }).catch(() => {
      if (!observedAuthEvent) setSession({ ready: true, userId: null })
    })

    return () => subscription.unsubscribe()
  }, [])

  return session
}

export function useDashboardOverview(period: string) {
  const pathname = usePathname()
  const isDashboardActive = pathname === '/dashboard'
  const session = useDashboardSession()
  const [retryCount, setRetryCount] = useState(0)
  const scopedKey = session.userId
    ? `/api/dashboard/overview?period=${encodeURIComponent(period)}:user=${encodeURIComponent(session.userId)}`
    : null
  const summaryKey = scopedKey ? `${scopedKey}:summary` : null
  const sidebarKey = scopedKey ? `${scopedKey}:sidebar` : null
  const summaryCache = useSWR<DashboardSummary>(summaryKey, null, { revalidateOnFocus: false, dedupingInterval: 30_000 })
  const sidebarCache = useSWR<DashboardSidebar>(sidebarKey, null, { revalidateOnFocus: false, dedupingInterval: 30_000 })
  const { mutate: mutateCache, cache } = useSWRConfig()
  const cachedSourcesRef = useRef({ summary: summaryCache.data, sidebar: sidebarCache.data })
  cachedSourcesRef.current = { summary: summaryCache.data, sidebar: sidebarCache.data }
  const [summaryError, setSummaryError] = useState<SourceError | Error | undefined>()
  const [sidebarError, setSidebarError] = useState<SourceError | Error | undefined>()
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [sidebarLoading, setSidebarLoading] = useState(true)

  useEffect(() => {
    const cached = cachedSourcesRef.current
    setSummaryError(undefined)
    setSidebarError(undefined)

    if (!session.ready || !session.userId || !isDashboardActive || !summaryKey || !sidebarKey) {
      setSummaryLoading(!session.ready)
      setSidebarLoading(!session.ready)
      return
    }

    // Keep verified cached values visible during revalidation, but never skip the
    // request on a Dashboard visit: data may have changed in another module.
    setSummaryLoading(!cached.summary)
    setSidebarLoading(!cached.sidebar)
    let subscribed = true
    const unsubscribe = subscribeOverviewRequest(
      cache as object,
      `${session.userId}:${period}:retry=${retryCount}`,
      period,
      event => {
        if (!subscribed) return
        if (event.source === 'summary') {
          if (event.data) void mutateCache(summaryKey, event.data, { revalidate: false })
          setSummaryError(event.error ?? undefined)
          setSummaryLoading(false)
        } else {
          if (event.data) void mutateCache(sidebarKey, event.data, { revalidate: false })
          setSidebarError(event.error ?? undefined)
          setSidebarLoading(false)
        }
      },
    )

    return () => {
      subscribed = false
      unsubscribe()
    }
  }, [cache, isDashboardActive, mutateCache, period, retryCount, session.ready, session.userId, sidebarKey, summaryKey])

  const mutate = useCallback(async () => {
    setRetryCount(value => value + 1)
  }, [])

  return {
    summary: { data: summaryCache.data, error: summaryError, isLoading: summaryLoading && !summaryCache.data, mutate },
    sidebar: { data: sidebarCache.data, error: sidebarError, isLoading: sidebarLoading && !sidebarCache.data, mutate },
    mutate,
  }
}
