// =============================================================================
// lib/hooks/useTransactions.ts
// SWR hook for transactions list + mutations via Server Actions.
// =============================================================================

'use client'

import useSWR, { mutate as globalMutate } from 'swr'
import { useState, useCallback }          from 'react'
import { CacheTTL }                       from '@/lib/cache/cache.config'
import type { FormError, ActionState,
  TransactionListParams,
  PaginatedResponse, TransactionListItem,
}                                         from '@/lib/contracts/ui.contracts'
import type { CreateTransactionResult }   from '@/modules/transactions/transaction.service.types'
import type { Transaction }               from '@/types/database.types'
import {
  createTransactionAction,
  updateTransactionAction,
  deleteTransactionAction,
}                                         from '@/app/actions/transaction.actions'

// ─── FETCHER ─────────────────────────────────────────────────────────────────

const fetcher = (url: string) =>
  fetch(url).then(async res => {
    const json = await res.json()
    if (!res.ok || !json.ok) throw json.error
    return json.data
  })

function buildUrl(p: TransactionListParams): string {
  const base   = '/api/transactions'
  const params = new URLSearchParams()
  Object.entries(p).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v))
  })
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

const DEFAULT_PARAMS: TransactionListParams = {
  page: 1, per_page: 20, sort_by: 'transaction_date', sort_dir: 'desc',
}

// ─── HOOK ─────────────────────────────────────────────────────────────────────

export interface UseTransactionsReturn {
  transactions:  TransactionListItem[]
  pagination:    (PaginatedResponse<TransactionListItem>['pagination'] & { total_pages: number }) | null
  isLoading:     boolean
  isValidating:  boolean
  isEmpty:       boolean
  error:         FormError | null
  params:        TransactionListParams
  setParams:     (p: Partial<TransactionListParams>) => void
  setPage:       (page: number) => void
  resetFilters:  () => void
  createState:   ActionState<CreateTransactionResult>
  updateState:   ActionState<Transaction>
  deleteState:   ActionState<{ deleted: true }>
  create:        (input: unknown) => Promise<boolean>
  update:        (id: string, input: unknown) => Promise<boolean>
  remove:        (id: string, force?: boolean) => Promise<boolean>
}

type LegacyPaginatedTransactions<T> = {
  data:     T[]
  total:    number
  page:     number
  per_page: number
  has_more: boolean
}

type TransactionListPayload =
  | PaginatedResponse<TransactionListItem>
  | LegacyPaginatedTransactions<TransactionListItem>

function extractPagination(
  payload: TransactionListPayload | undefined
): PaginatedResponse<TransactionListItem>['pagination'] | null {
  if (!payload) return null

  if ('pagination' in payload && payload.pagination) {
    return payload.pagination
  }

  if (
    'total' in payload &&
    'page' in payload &&
    'per_page' in payload &&
    'has_more' in payload
  ) {
    return {
      total:    payload.total,
      page:     payload.page,
      per_page: payload.per_page,
      has_more: payload.has_more,
    }
  }

  return null
}

export function useTransactions(
  initial: Partial<TransactionListParams> = {}
): UseTransactionsReturn {
  const [params, setParamsState] = useState<TransactionListParams>({
    ...DEFAULT_PARAMS, ...initial,
  })
  const [createState, setCreate] = useState<ActionState<CreateTransactionResult>>({ status: 'idle' })
  const [updateState, setUpdate] = useState<ActionState<Transaction>>({ status: 'idle' })
  const [deleteState, setDelete] = useState<ActionState<{ deleted: true }>>({ status: 'idle' })

  const url = buildUrl(params)

  const { data, isLoading, isValidating, error } = useSWR<
    TransactionListPayload
  >(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval:  CacheTTL.transactions * 1000,
    keepPreviousData:  true,
  })

  const setParams = useCallback((next: Partial<TransactionListParams>) => {
    setParamsState(prev => ({ ...prev, ...next, page: 'page' in next ? (next.page ?? 1) : 1 }))
  }, [])

  const setPage = useCallback((page: number) => {
    setParamsState(prev => ({ ...prev, page }))
  }, [])

  const resetFilters = useCallback(() => setParamsState(DEFAULT_PARAMS), [])

  const create = useCallback(async (input: unknown) => {
    setCreate({ status: 'loading' })
    const result = await createTransactionAction(input)
    if (result.ok) {
      setCreate({ status: 'success', data: result.data })
      await globalMutate(url)
      return true
    }
    setCreate({ status: 'error', error: result.error as FormError })
    return false
  }, [url])

  const update = useCallback(async (id: string, input: unknown) => {
    setUpdate({ status: 'loading' })
    const result = await updateTransactionAction(id, input)
    if (result.ok) {
      setUpdate({ status: 'success', data: result.data })
      await globalMutate(url)
      return true
    }
    setUpdate({ status: 'error', error: result.error as FormError })
    return false
  }, [url])

  const remove = useCallback(async (id: string, force = false) => {
    setDelete({ status: 'loading' })
    const result = await deleteTransactionAction(id, force)
    if (result.ok) {
      setDelete({ status: 'success', data: { deleted: true } })
      await globalMutate(url)
      return true
    }
    setDelete({ status: 'error', error: result.error as FormError })
    return false
  }, [url])

  const transactions = data?.data ?? []
  const paginationBase = extractPagination(data)
  const pagination = paginationBase && paginationBase.per_page > 0 ? {
    ...paginationBase,
    total_pages: Math.ceil(paginationBase.total / paginationBase.per_page),
  } : null

  return {
    transactions, pagination,
    isLoading: isLoading && !data,
    isValidating: isValidating && !!data,
    isEmpty: !isLoading && transactions.length === 0,
    error: error as FormError | null,
    params, setParams, setPage, resetFilters,
    createState, updateState, deleteState,
    create, update, remove,
  }
}

export function useTransaction(id: string | null) {
  const { data, isLoading, error } = useSWR(
    id ? `/api/transactions/${id}` : null, fetcher,
    { revalidateOnFocus: false }
  )
  return { transaction: data as TransactionListItem | null, isLoading, error }
}
