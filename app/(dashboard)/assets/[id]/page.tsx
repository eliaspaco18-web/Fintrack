// app/(dashboard)/assets/[id]/page.tsx
import { notFound, redirect } from 'next/navigation'
import { createClient }       from '@/lib/supabase.server'
import { AssetDetail }        from '@/components/detail/ModuleDetails'

export default async function AssetDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: asset } = await supabase.from('assets').select('*')
    .eq('id', params.id).eq('user_id', user.id).single()
  if (!asset) notFound()

  const { data: transaction } = asset.transaction_id
    ? await supabase.from('transactions').select('id,description').eq('id', asset.transaction_id).single()
    : { data: null }

  return <AssetDetail asset={asset} transaction={transaction}/>
}
