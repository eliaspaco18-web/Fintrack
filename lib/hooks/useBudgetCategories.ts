'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchWithTimeout } from '@/lib/client/fetch-with-timeout'
import { getApiErrorMessage } from '@/lib/api/error-message'

export type BudgetCategoryOption = {
  id: string
  name: string
  scope: 'INCOME' | 'EXPENSE'
  is_system: boolean
}

export function useBudgetCategories(enabled: boolean) {
  const [categories, setCategories] = useState<BudgetCategoryOption[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadedRef = useRef(false)
  const requestRef = useRef<Promise<void> | null>(null)

  const load = useCallback((): Promise<void> => {
    if (loadedRef.current) return Promise.resolve()
    if (requestRef.current) return requestRef.current

    setIsLoading(true)
    setError(null)

    const request = (async () => {
      try {
        const response = await fetchWithTimeout('/api/categories?include_system=true', { cache: 'no-store' })
        const json = await response.json().catch(() => null)
        if (!response.ok || !json?.ok || !Array.isArray(json.data)) {
          throw new Error(getApiErrorMessage(json, 'No se pudieron cargar las categorías'))
        }

        setCategories((json.data as BudgetCategoryOption[])
          .filter(category => category.scope === 'EXPENSE'))
        loadedRef.current = true
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'No se pudieron cargar las categorías')
      } finally {
        setIsLoading(false)
        requestRef.current = null
      }
    })()

    requestRef.current = request
    return request
  }, [])

  useEffect(() => {
    if (enabled) void load()
  }, [enabled, load])

  return { categories, isLoading, error, load }
}
