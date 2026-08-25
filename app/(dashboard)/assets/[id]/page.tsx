// app/(dashboard)/assets/[id]/page.tsx
import { notFound, redirect } from 'next/navigation'
import { createClient }       from '@/lib/supabase.server'
import { withTimeout } from '@/lib/server/promise-timeout'
import { AssetDetail }        from '@/components/detail/ModuleDetails'

const SERVER_QUERY_TIMEOUT_MS = 4_000

export default async function AssetDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [assetResult] = await Promise.allSettled([
    withTimeout(
      supabase.from('assets').select('*, asset_type_info:asset_types(id, name, color, icon)')
        .eq('id', params.id).eq('user_id', user.id).single(),
      SERVER_QUERY_TIMEOUT_MS,
    ),
  ])
  const asset =
    assetResult.status === 'fulfilled' && !assetResult.value.error
      ? assetResult.value.data
      : null
  if (!asset) notFound()

  const transaction = asset.transaction_id
    ? await withTimeout(
        supabase.from('transactions').select('id,description').eq('id', asset.transaction_id).single(),
        SERVER_QUERY_TIMEOUT_MS,
      ).then(result => (!result.error ? result.data : null)).catch(() => null)
    : null

  return <AssetDetail asset={asset} transaction={transaction}/>
}
