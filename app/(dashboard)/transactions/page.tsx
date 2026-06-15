import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase.server'
import { withTimeout } from '@/lib/server/promise-timeout'
import {
  getTransactionFormOptions,
  resolveTransactionInitialValues,
  type TransactionSearchParamMap,
} from '@/lib/server/transaction-form-options'
import { TransactionsWorkspace } from '@/components/transactions/TransactionsWorkspace'

const SERVER_QUERY_TIMEOUT_MS = 4_000

export const metadata: Metadata = {
  title: 'Movimientos | FinTrack',
  description: 'Registra y gestiona tus ingresos, egresos, transferencias y más.',
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams?: TransactionSearchParamMap
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const optionsResult = await Promise.allSettled([
    withTimeout(getTransactionFormOptions(user.id), SERVER_QUERY_TIMEOUT_MS),
  ])

  const options =
    optionsResult[0]?.status === 'fulfilled'
      ? optionsResult[0].value
      : {
          accounts: [],
          creditCards: [],
          creditors: [],
          debtors: [],
          pendingReceivables: [],
          pendingPayables: [],
          assetTypes: [],
          categories: { income: [], expense: [] },
          currencies: [
            { value: 'PEN', label: 'PEN — Soles peruanos' },
            { value: 'USD', label: 'USD — Dólares americanos' },
          ],
        }

  const initialValuesResult = await Promise.allSettled([
    withTimeout(resolveTransactionInitialValues(searchParams, user.id, options), SERVER_QUERY_TIMEOUT_MS),
  ])

  const initialValues =
    initialValuesResult[0]?.status === 'fulfilled'
      ? initialValuesResult[0].value
      : {}

  return (
    <TransactionsWorkspace
      options={options}
      initialValues={initialValues}
    />
  )
}
