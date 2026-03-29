// =============================================================================
// app/(dashboard)/transactions/[id]/page.tsx
// Página de detalle de transacción — Server Component.
// Carga la transacción y sus módulos derivados. El cliente gestiona acciones.
// =============================================================================

import { notFound, redirect }     from 'next/navigation'
import type { Metadata }          from 'next'
import { createClient }           from '@/lib/supabase.server'
import { TransactionService }     from '@/modules/transactions/transaction.service'
import { TransactionDetailClient } from '@/components/detail/TransactionDetailClient'

interface Props { params: { id: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: 'Transacción' }
}

export default async function TransactionDetailPage({ params }: Props) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const service = new TransactionService(supabase)
  const result  = await service.getTransactionById(user.id, params.id)
  if (!result.ok) notFound()

  // Cargar módulos derivados vinculados a esta transacción
  const [
    { data: asset },
    { data: credit },
    { data: loan },
    { data: receivable },
    { data: payable },
  ] = await Promise.all([
    supabase.from('assets').select('id,name,asset_type,current_value,status')
      .eq('transaction_id', params.id).maybeSingle(),
    supabase.from('credits').select('id,name,credit_type,available_amount,status')
      .eq('transaction_id', params.id).maybeSingle(),
    supabase.from('loans').select('id,creditor_name,total_installments,paid_installments,status')
      .eq('transaction_id', params.id).maybeSingle(),
    supabase.from('accounts_receivable').select('id,debtor_name,amount,status')
      .eq('transaction_id', params.id).maybeSingle(),
    supabase.from('accounts_payable').select('id,creditor_name,amount,status')
      .eq('transaction_id', params.id).maybeSingle(),
  ])

  return (
    <TransactionDetailClient
      transaction={result.data}
      linkedModules={{ asset, credit, loan, receivable, payable }}
    />
  )
}
