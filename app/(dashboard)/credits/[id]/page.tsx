// app/(dashboard)/credits/[id]/page.tsx
import { notFound, redirect } from 'next/navigation'
import { createClient }       from '@/lib/supabase.server'
import { CreditDetail }       from '@/components/detail/ModuleDetails'

export default async function CreditDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: credit }, { data: installments }] = await Promise.all([
    supabase.from('credits').select('*').eq('id', params.id).eq('user_id', user.id).single(),
    supabase.from('installments')
      .select('*, loan:loans!inner(credit_id)')
      .eq('loan.credit_id', params.id)
      .order('installment_number'),
  ])

  if (!credit) notFound()

  const txId = credit.transaction_id
  const { data: transaction } = txId
    ? await supabase.from('transactions').select('id,description').eq('id', txId).single()
    : { data: null }

  return <CreditDetail credit={credit} installments={installments ?? []} transaction={transaction}/>
}
