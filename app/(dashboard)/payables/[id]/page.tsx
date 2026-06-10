// app/(dashboard)/payables/[id]/page.tsx
import { notFound, redirect } from 'next/navigation'
import { createClient }       from '@/lib/supabase.server'
import { withTimeout } from '@/lib/server/promise-timeout'
import { PayableDetail }      from '@/components/detail/ModuleDetails'

const SERVER_QUERY_TIMEOUT_MS = 4_000

export default async function PayableDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [payableResult] = await Promise.allSettled([
    withTimeout(
      supabase.from('accounts_payable').select('*')
        .eq('id', params.id).eq('user_id', user.id).single(),
      SERVER_QUERY_TIMEOUT_MS,
    ),
  ])
  const payable =
    payableResult.status === 'fulfilled' && !payableResult.value.error
      ? payableResult.value.data
      : null
  if (!payable) notFound()

  const transaction = payable.transaction_id
    ? await withTimeout(
        supabase.from('transactions').select('id,description').eq('id', payable.transaction_id).single(),
        SERVER_QUERY_TIMEOUT_MS,
      ).then(result => (!result.error ? result.data : null)).catch(() => null)
    : null

  return <PayableDetail payable={payable} transaction={transaction}/>
}
