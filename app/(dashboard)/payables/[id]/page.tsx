// app/(dashboard)/payables/[id]/page.tsx
import { notFound, redirect } from 'next/navigation'
import { createClient }       from '@/lib/supabase.server'
import { PayableDetail }      from '@/components/detail/ModuleDetails'

export default async function PayableDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: payable } = await supabase.from('accounts_payable').select('*')
    .eq('id', params.id).eq('user_id', user.id).single()
  if (!payable) notFound()

  const { data: transaction } = payable.transaction_id
    ? await supabase.from('transactions').select('id,description').eq('id', payable.transaction_id).single()
    : { data: null }

  return <PayableDetail payable={payable} transaction={transaction}/>
}
