'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AssetsListPanel } from '@/components/assets/AssetsListPanel'
import type { AssetWithTypeInfo } from '@/modules/assets/asset-presentation'

type AssetTypeOption = { id: string; name: string }

const ASSET_PURCHASE_URL = '/transactions?new=transaction&module=asset&type=EXPENSE'

export function AssetsWorkspace({
  demoAllowed,
  demoAssets,
  demoTypes,
}: {
  demoAllowed: boolean
  demoAssets?: AssetWithTypeInfo[]
  demoTypes?: AssetTypeOption[]
}) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const demoMode = demoAllowed && searchParams.get('demo-assets') === '1'
  const openFromLegacyQuery = searchParams.get('new') === 'asset'
  const handledLegacyQuery = useRef(false)

  useEffect(() => {
    if (!openFromLegacyQuery) {
      handledLegacyQuery.current = false
      return
    }
    if (handledLegacyQuery.current) return
    handledLegacyQuery.current = true

    if (!demoMode) {
      router.replace(ASSET_PURCHASE_URL)
      return
    }

    const params = new URLSearchParams(searchParams.toString())
    params.delete('new')
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [demoMode, openFromLegacyQuery, pathname, router, searchParams])

  return (
    <AssetsListPanel
      onCreate={() => {
        if (!demoMode) router.push(ASSET_PURCHASE_URL)
      }}
      demoMode={demoMode}
      demoAssets={demoAssets}
      demoTypes={demoTypes}
      onExitDemo={() => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete('demo-assets')
        params.delete('new')
        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
      }}
    />
  )
}
