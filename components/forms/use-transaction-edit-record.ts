'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { EditableTransaction } from '@/components/forms/transaction-edit-data'
import type { TransactionWithRelations } from '@/types/database.types'

type LoadedTransaction = TransactionWithRelations & EditableTransaction
type EditLoadState =
  | { transactionId: string; status: 'loading' }
  | { transactionId: string; status: 'loaded'; transaction: LoadedTransaction }
  | { transactionId: string; status: 'error'; message: string }
  | { transactionId: null; status: 'idle' }

export interface TransactionEditRecordResult {
  transaction: LoadedTransaction | null
  status: EditLoadState['status']
  error: string | null
  retry: () => void
  clearAfterExit: () => void
}

const EDIT_LOAD_TIMEOUT_MS = 15_000

function normalizeTransaction(raw: unknown, expectedId: string): LoadedTransaction | null {
  if (!raw || typeof raw !== 'object') return null
  const candidate = raw as Partial<LoadedTransaction>
  if (candidate.id !== expectedId || !candidate.type || !candidate.transaction_date) return null
  return candidate as LoadedTransaction
}

/**
 * Loads one complete edit record, keyed to the selected ID. Partial table rows
 * are never returned as editable data. A loaded record is retained only while
 * its modal is completing the visual exit, then cleared by clearAfterExit.
 */
export function useTransactionEditRecord(
  open: boolean,
  transactionId: string | null,
): TransactionEditRecordResult {
  const [loadState, setLoadState] = useState<EditLoadState>({ transactionId: null, status: 'idle' })
  const [retryAttempt, setRetryAttempt] = useState(0)
  const openRef = useRef(open)
  const activeTransactionIdRef = useRef<string | null>(null)
  const loadedTransactionRef = useRef<LoadedTransaction | null>(null)
  openRef.current = open
  if (open && transactionId) activeTransactionIdRef.current = transactionId

  useEffect(() => {
    if (!open || !transactionId) return
    if (loadedTransactionRef.current?.id === transactionId) return
    loadedTransactionRef.current = null

    const controller = new AbortController()
    let active = true
    let timedOut = false
    activeTransactionIdRef.current = transactionId
    const timeoutId = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, EDIT_LOAD_TIMEOUT_MS)

    setLoadState({ transactionId, status: 'loading' })

    const loadTransaction = async () => {
      try {
        const response = await fetch(`/api/transactions/${transactionId}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        const json = await response.json().catch(() => null)
        if (!active) return
        if (timedOut || controller.signal.aborted) {
          throw new Error('TRANSACTION_EDIT_LOAD_TIMEOUT')
        }

        if (!response.ok || !json?.ok) {
          throw new Error(json?.error?.message ?? 'No se pudo cargar el movimiento.')
        }

        const nextTransaction = normalizeTransaction(json.data, transactionId)
        if (!nextTransaction) {
          throw new Error('No se pudieron verificar los datos del movimiento seleccionado.')
        }

        loadedTransactionRef.current = nextTransaction
        setLoadState({ transactionId, status: 'loaded', transaction: nextTransaction })
      } catch (caught) {
        if (!active) return
        setLoadState({
          transactionId,
          status: 'error',
          message: timedOut || (caught instanceof Error && caught.message === 'TRANSACTION_EDIT_LOAD_TIMEOUT')
            ? 'La carga tardó demasiado. Intenta nuevamente.'
            : caught instanceof Error && caught.name !== 'AbortError'
              ? caught.message
              : 'No se pudo cargar el movimiento.',
        })
      } finally {
        window.clearTimeout(timeoutId)
      }
    }

    void loadTransaction()
    return () => {
      active = false
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [open, retryAttempt, transactionId])

  const retry = useCallback(() => {
    if (!transactionId) return
    setLoadState({ transactionId, status: 'loading' })
    setRetryAttempt(value => value + 1)
  }, [transactionId])

  const clearAfterExit = useCallback(() => {
    if (openRef.current) return
    loadedTransactionRef.current = null
    activeTransactionIdRef.current = null
    setLoadState({ transactionId: null, status: 'idle' })
  }, [])

  const renderTransactionId = open
    ? transactionId
    : loadState.transactionId ?? activeTransactionIdRef.current
  const matchingState = loadState.transactionId === renderTransactionId ? loadState : null
  const transaction = matchingState?.status === 'loaded'
    && matchingState.transaction.id === renderTransactionId
    ? matchingState.transaction
    : null
  const status = matchingState?.status ?? (renderTransactionId ? 'loading' : 'idle')
  const error = matchingState?.status === 'error' ? matchingState.message : null

  return { transaction, status, error, retry, clearAfterExit }
}
