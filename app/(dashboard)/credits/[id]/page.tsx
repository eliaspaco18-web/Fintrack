// app/(dashboard)/credits/[id]/page.tsx
import { notFound, redirect } from 'next/navigation'
import { createClient }       from '@/lib/supabase.server'
import { withTimeout } from '@/lib/server/promise-timeout'
import { CreditDetail }       from '@/components/detail/ModuleDetails'

const SERVER_QUERY_TIMEOUT_MS = 4_000

export default async function CreditDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [creditResult, installmentsResult] = await Promise.allSettled([
    withTimeout(
      supabase.from('credits').select('*').eq('id', params.id).eq('user_id', user.id).single(),
      SERVER_QUERY_TIMEOUT_MS,
    ),
    withTimeout(
      supabase.from('installments')
        .select('*, loan:loans!inner(credit_id)')
        .eq('loan.credit_id', params.id)
        .order('installment_number'),
      SERVER_QUERY_TIMEOUT_MS,
    ),
  ])

  const credit =
    creditResult.status === 'fulfilled' && !creditResult.value.error
      ? creditResult.value.data
      : null
  const installments =
    installmentsResult.status === 'fulfilled' && !installmentsResult.value.error
      ? (installmentsResult.value.data ?? [])
      : []

  if (!credit) notFound()

  const txId = credit.transaction_id
  const transaction = txId
    ? await withTimeout(
        supabase.from('transactions').select('id,description').eq('id', txId).single(),
        SERVER_QUERY_TIMEOUT_MS,
      ).then(result => (!result.error ? result.data : null)).catch(() => null)
    : null

  return <CreditDetail credit={credit} installments={installments ?? []} transaction={transaction}/>
}
