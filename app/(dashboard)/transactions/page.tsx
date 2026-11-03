import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase.server'
import { withTimeout } from '@/lib/server/promise-timeout'
import {
  getTransactionFormOptions,
  resolveTransactionInitialValues,
  shouldPreloadTransactionFormOptions,
  type TransactionSearchParamMap,
} from '@/lib/server/transaction-form-options'
import {
  TransactionsWorkspace,
  type TransactionPreloadWarning,
} from '@/components/transactions/TransactionsWorkspace'
import type { TransactionFormOptions } from '@/lib/contracts/ui.contracts'

const SERVER_QUERY_TIMEOUT_MS = 4_000

const FALLBACK_TRANSACTION_OPTIONS: TransactionFormOptions = {
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

function buildTransactionPreloadWarning(
  area: TransactionPreloadWarning['area'],
  reason: unknown,
): TransactionPreloadWarning {
  const isTimeout = reason instanceof Error && reason.message.includes('Timeout after')

  if (area === 'options') {
    return {
      area,
      message: 'No se pudieron cargar algunas opciones para registrar movimientos.',
      detail: isTimeout
        ? 'La carga tardó demasiado. Recarga la página para volver a intentar.'
        : 'Recarga la página para volver a intentar. Tus datos no se han modificado.',
      affectedOptions: [
        'accounts',
        'categories',
        'credit_cards',
        'counterparties',
        'pending_documents',
        'asset_types',
      ],
    }
  }

  return {
    area,
    message: 'No se pudieron aplicar los datos precargados del movimiento.',
    detail: isTimeout
      ? 'La carga tardó demasiado. Puedes continuar manualmente o recargar la página.'
      : 'Puedes continuar manualmente o recargar la página para volver a intentar.',
    affectedOptions: ['initial_values'],
  }
}

export const metadata: Metadata = {
  title: 'Movimientos | FinTrack',
  description: 'Registra y gestiona tus ingresos, egresos, transferencias y más.',
}

export default async function TransactionsPage(
  props: {
    searchParams?: Promise<TransactionSearchParamMap>
  }
) {
  const searchParams = await props.searchParams
  const needsFormOptions = shouldPreloadTransactionFormOptions(searchParams)
  let formUserId: string | null = null

  // The authenticated dashboard layout already guards the ordinary listing.
  // Only resolve the user again when the server must load user-scoped form data.
  if (needsFormOptions) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')
    formUserId = user.id
  }
  if (needsFormOptions && !formUserId) redirect('/login')

  const optionsResult = formUserId
    ? await Promise.allSettled([withTimeout(getTransactionFormOptions(formUserId), SERVER_QUERY_TIMEOUT_MS)])
    : null

  const options =
    optionsResult?.[0]?.status === 'fulfilled'
      ? optionsResult[0].value
      : FALLBACK_TRANSACTION_OPTIONS

  const preloadWarnings: TransactionPreloadWarning[] = []

  if (optionsResult?.[0]?.status === 'rejected') {
    preloadWarnings.push(buildTransactionPreloadWarning('options', optionsResult[0].reason))
  }

  const initialValuesResult = formUserId
    ? await Promise.allSettled([withTimeout(resolveTransactionInitialValues(searchParams, formUserId, options), SERVER_QUERY_TIMEOUT_MS)])
    : null

  const initialValues =
    initialValuesResult?.[0]?.status === 'fulfilled'
      ? initialValuesResult[0].value
      : {}

  if (initialValuesResult?.[0]?.status === 'rejected') {
    preloadWarnings.push(buildTransactionPreloadWarning('initialValues', initialValuesResult[0].reason))
  }

  return (
    <TransactionsWorkspace
      options={options}
      optionsLoaded={Boolean(optionsResult?.[0]?.status === 'fulfilled')}
      initialValues={initialValues}
      preloadWarnings={preloadWarnings}
    />
  )
}
