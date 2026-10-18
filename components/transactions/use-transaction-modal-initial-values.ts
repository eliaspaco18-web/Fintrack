'use client'

import { useMemo } from 'react'
import type { TransactionFormValues } from '@/lib/contracts/ui.contracts'
import { operationTypeToFormConfig, type OperationType } from '@/components/transactions/OperationTypeSelector'

/**
 * Keeps the selected create form's defaults stable while URL state is synced or
 * removed. The form orchestrator intentionally resets when its initial values
 * change, so unrelated query updates must not manufacture a new defaults object.
 */
export function useTransactionModalInitialValues(
  initialValues: Partial<TransactionFormValues>,
  openFromQuery: boolean,
  hasPrefillParams: boolean,
  selectedOperationType: OperationType | null,
): Partial<TransactionFormValues> | undefined {
  const selectedOperationValues = useMemo(() => {
    if (!selectedOperationType) return undefined
    return {
      ...initialValues,
      ...(operationTypeToFormConfig(selectedOperationType) as Partial<TransactionFormValues>),
    }
  }, [initialValues, selectedOperationType])

  if (selectedOperationValues) return selectedOperationValues
  if (openFromQuery && hasPrefillParams) return initialValues
  return undefined
}
