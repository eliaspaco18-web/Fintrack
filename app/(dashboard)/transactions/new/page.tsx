import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import type { TransactionSearchParamMap } from '@/lib/server/transaction-form-options'

export const metadata: Metadata = { title: 'Nueva transacción' }

function normalizeValue(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function buildTransactionModalQuery(
  searchParams: TransactionSearchParamMap | undefined,
): URLSearchParams {
  const params = new URLSearchParams()
  params.set('new', 'transaction')

  if (!searchParams) return params

  Object.entries(searchParams).forEach(([key, rawValue]) => {
    if (key === 'new' || rawValue == null) return

    const values = Array.isArray(rawValue) ? rawValue : [rawValue]
    values.forEach(entry => {
      const safe = normalizeValue(String(entry))
      if (!safe) return
      params.append(key, safe)
    })
  })

  return params
}

export default function NewTransactionPage({
  searchParams,
}: {
  searchParams?: TransactionSearchParamMap
}) {
  const params = buildTransactionModalQuery(searchParams)
  redirect(`/transactions?${params.toString()}`)
}

