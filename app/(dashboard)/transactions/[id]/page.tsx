// =============================================================================
// app/(dashboard)/transactions/[id]/page.tsx
// Página de detalle de transacción — Server Component.
// Carga la transacción y sus módulos derivados. El cliente gestiona acciones.
// =============================================================================

import { notFound, redirect }     from 'next/navigation'
import type { Metadata }          from 'next'
import { createClient }           from '@/lib/supabase.server'
import { withTimeout } from '@/lib/server/promise-timeout'
import { getTransactionFormOptions } from '@/lib/server/transaction-form-options'
import { TransactionService }     from '@/modules/transactions/transaction.service'
import { TransactionDetailClient } from '@/components/detail/TransactionDetailClient'

interface Props { params: { id: string } }
const SERVER_QUERY_TIMEOUT_MS = 4_000

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: 'Transacción' }
}

export default async function TransactionDetailPage({ params }: Props) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = new TransactionService(supabase)
  const result  = await withTimeout(service.getTransactionById(user.id, params.id), SERVER_QUERY_TIMEOUT_MS)
  if (!result.ok) notFound()
  const formOptions = await withTimeout(getTransactionFormOptions(user.id), SERVER_QUERY_TIMEOUT_MS)

  // Cargar módulos derivados vinculados a esta transacción
  const [assetResult, creditResult, loanResult, receivableResult, payableResult] = await Promise.allSettled([
    withTimeout(
      supabase.from('assets').select('id,name,asset_type,current_value,status')
        .eq('transaction_id', params.id).maybeSingle(),
      SERVER_QUERY_TIMEOUT_MS,
    ),
    withTimeout(
      supabase.from('credits').select('id,name,credit_type,available_amount,status')
        .eq('transaction_id', params.id).maybeSingle(),
      SERVER_QUERY_TIMEOUT_MS,
    ),
    withTimeout(
      supabase.from('loans').select('id,creditor_name,total_installments,paid_installments,status')
        .eq('transaction_id', params.id).maybeSingle(),
      SERVER_QUERY_TIMEOUT_MS,
    ),
    withTimeout(
      supabase.from('accounts_receivable').select('id,debtor_name,amount,status')
        .eq('transaction_id', params.id).maybeSingle(),
      SERVER_QUERY_TIMEOUT_MS,
    ),
    withTimeout(
      supabase.from('accounts_payable').select('id,creditor_name,amount,status')
        .eq('transaction_id', params.id).maybeSingle(),
      SERVER_QUERY_TIMEOUT_MS,
    ),
  ])

  const asset =
    assetResult.status === 'fulfilled' && !assetResult.value.error
      ? assetResult.value.data
      : null
  const credit =
    creditResult.status === 'fulfilled' && !creditResult.value.error
      ? creditResult.value.data
      : null
  const loan =
    loanResult.status === 'fulfilled' && !loanResult.value.error
      ? loanResult.value.data
      : null
  const receivable =
    receivableResult.status === 'fulfilled' && !receivableResult.value.error
      ? receivableResult.value.data
      : null
  const payable =
    payableResult.status === 'fulfilled' && !payableResult.value.error
      ? payableResult.value.data
      : null

  return (
    <TransactionDetailClient
      transaction={result.data}
      linkedModules={{ asset, credit, loan, receivable, payable }}
      options={formOptions}
    />
  )
}
