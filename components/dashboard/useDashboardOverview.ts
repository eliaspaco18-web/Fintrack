'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import type { DashboardSidebar, DashboardSummary } from '@/lib/dashboard/types'
import { consumeDashboardOverviewStream } from '@/lib/dashboard/overview-stream'

type SourceError = { code: string; message: string; detail?: string }

export function useDashboardOverview(period: string) {
  const [retryCount, setRetryCount] = useState(0)
  const summaryKey = `/api/dashboard/overview?period=${encodeURIComponent(period)}:summary`
  const sidebarKey = `/api/dashboard/overview?period=${encodeURIComponent(period)}:sidebar`
  const summaryCache = useSWR<DashboardSummary>(summaryKey, null, { revalidateOnFocus: false, dedupingInterval: 30_000 })
  const sidebarCache = useSWR<DashboardSidebar>(sidebarKey, null, { revalidateOnFocus: false, dedupingInterval: 30_000 })
  const { mutate: mutateCache } = useSWRConfig()
  const cachedSourcesRef = useRef({ summary: summaryCache.data, sidebar: sidebarCache.data })
  cachedSourcesRef.current = { summary: summaryCache.data, sidebar: sidebarCache.data }
  const [summaryError, setSummaryError] = useState<SourceError | Error | undefined>()
  const [sidebarError, setSidebarError] = useState<SourceError | Error | undefined>()
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [sidebarLoading, setSidebarLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    const cached = cachedSourcesRef.current
    setSummaryError(undefined)
    setSidebarError(undefined)
    const hasBothCached = Boolean(cached.summary && cached.sidebar)
    if (hasBothCached && retryCount === 0) {
      setSummaryLoading(false)
      setSidebarLoading(false)
      return () => controller.abort()
    }
    setSummaryLoading(!cached.summary)
    setSidebarLoading(!cached.sidebar)

    void fetch(`/api/dashboard/overview?period=${encodeURIComponent(period)}`, {
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
    }).then(response => consumeDashboardOverviewStream<DashboardSummary, DashboardSidebar>(response, event => {
      if (controller.signal.aborted) return
      if (event.source === 'summary') {
        if (event.data) void mutateCache(summaryKey, event.data, { revalidate: false })
        setSummaryError(event.error ?? undefined)
        setSummaryLoading(false)
      } else {
        if (event.data) void mutateCache(sidebarKey, event.data, { revalidate: false })
        setSidebarError(event.error ?? undefined)
        setSidebarLoading(false)
      }
    })).catch(error => {
      if (controller.signal.aborted) return
      const failure = error instanceof Error ? error : new Error('No se pudo cargar Inicio.')
      setSummaryError(failure)
      setSidebarError(failure)
      setSummaryLoading(false)
      setSidebarLoading(false)
    })

    return () => controller.abort()
  }, [mutateCache, period, retryCount, sidebarKey, summaryKey])

  const mutate = useCallback(async () => {
    setRetryCount(value => value + 1)
  }, [])

  return {
    summary: { data: summaryCache.data, error: summaryError, isLoading: summaryLoading && !summaryCache.data, mutate },
    sidebar: { data: sidebarCache.data, error: sidebarError, isLoading: sidebarLoading && !sidebarCache.data, mutate },
    mutate,
  }
}
