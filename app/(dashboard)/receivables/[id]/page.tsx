// app/(dashboard)/receivables/[id]/page.tsx
import { notFound, redirect }  from 'next/navigation'
import { createClient }        from '@/lib/supabase.server'
import { withTimeout } from '@/lib/server/promise-timeout'
import { ReceivableDetail }    from '@/components/detail/ModuleDetails'

const SERVER_QUERY_TIMEOUT_MS = 4_000

export default async function ReceivableDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [receivableResult] = await Promise.allSettled([
    withTimeout(
      supabase.from('accounts_receivable').select('*')
        .eq('id', params.id).eq('user_id', user.id).single(),
      SERVER_QUERY_TIMEOUT_MS,
    ),
  ])
  const receivable =
    receivableResult.status === 'fulfilled' && !receivableResult.value.error
      ? receivableResult.value.data
      : null
  if (!receivable) notFound()

  const transaction = receivable.transaction_id
    ? await withTimeout(
        supabase.from('transactions').select('id,description').eq('id', receivable.transaction_id).single(),
        SERVER_QUERY_TIMEOUT_MS,
      ).then(result => (!result.error ? result.data : null)).catch(() => null)
    : null

  return <ReceivableDetail receivable={receivable} transaction={transaction}/>
}
