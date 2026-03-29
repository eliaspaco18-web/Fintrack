// app/(dashboard)/receivables/[id]/page.tsx
import { notFound, redirect }  from 'next/navigation'
import { createClient }        from '@/lib/supabase.server'
import { ReceivableDetail }    from '@/components/detail/ModuleDetails'

export default async function ReceivableDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: receivable } = await supabase.from('accounts_receivable').select('*')
    .eq('id', params.id).eq('user_id', user.id).single()
  if (!receivable) notFound()

  const { data: transaction } = receivable.transaction_id
    ? await supabase.from('transactions').select('id,description').eq('id', receivable.transaction_id).single()
    : { data: null }

  return <ReceivableDetail receivable={receivable} transaction={transaction}/>
}
