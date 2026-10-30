import type { Asset, AssetStatus, AssetType } from '@/types/database.types'

export const ASSET_STATUS_FILTERS = ['ACTIVE', 'SOLD', 'DEPRECIATED'] as const

export type AssetStatusFilter = 'all' | AssetStatus | 'UNKNOWN'

export type AssetTypeInfo = {
  id: string
  name: string
  color: string | null
  icon: string | null
}

export type AssetWithTypeInfo = Asset & {
  asset_type_info?: AssetTypeInfo | null
}

export type AssetValueSummary = {
  currency: string
  amount: number
  count: number
  invalidCount: number
}

/** Return the recorded value without substituting an invalid value with zero. */
export function getRecordedAssetValue(asset: Pick<AssetWithTypeInfo, 'current_value' | 'purchase_value'>): number | null {
  const value = asset.current_value ?? asset.purchase_value
  const amount = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(amount) && amount >= 0 ? amount : null
}

export function getAssetPurchaseValue(asset: Pick<AssetWithTypeInfo, 'purchase_value'>): number | null {
  if (asset.purchase_value === null || asset.purchase_value === undefined) return null
  const amount = typeof asset.purchase_value === 'number' ? asset.purchase_value : Number(asset.purchase_value)
  return Number.isFinite(amount) && amount >= 0 ? amount : null
}

/** Summarize active assets in their persisted currencies; never convert or combine currencies. */
export function summarizeActiveAssetValues(assets: readonly AssetWithTypeInfo[]): AssetValueSummary[] {
  const summaries = new Map<string, AssetValueSummary>()

  for (const asset of assets) {
    if (asset.status !== 'ACTIVE') continue
    const currency = typeof asset.currency === 'string' ? asset.currency.trim().toUpperCase() : ''
    const key = currency || 'UNVERIFIED'
    const summary = summaries.get(key) ?? { currency: key, amount: 0, count: 0, invalidCount: 0 }
    const value = getRecordedAssetValue(asset)
    if (!currency || value === null) {
      summary.invalidCount += 1
    } else {
      const total = summary.amount + value
      if (!Number.isFinite(total)) {
        summary.invalidCount += 1
      } else {
        summary.amount = total
        summary.count += 1
      }
    }
    summaries.set(key, summary)
  }

  return [...summaries.values()].sort((a, b) => a.currency.localeCompare(b.currency))
}

export type AssetStatusPresentation = {
  status: AssetStatus | null
  label: string
  tone: 'success' | 'neutral' | 'warning'
  isVerified: boolean
}

export type AssetTypePresentation = {
  label: string
  source: 'CUSTOM' | 'STANDARD' | 'UNVERIFIED'
  isVerified: boolean
}

const ASSET_STATUS_PRESENTATION: Record<AssetStatus, AssetStatusPresentation> = {
  ACTIVE: {
    status: 'ACTIVE',
    label: 'Activo',
    tone: 'success',
    isVerified: true,
  },
  SOLD: {
    status: 'SOLD',
    label: 'Vendido',
    tone: 'neutral',
    isVerified: true,
  },
  DEPRECIATED: {
    status: 'DEPRECIATED',
    label: 'Depreciado',
    tone: 'warning',
    isVerified: true,
  },
}

const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  REAL_ESTATE: 'Inmueble',
  VEHICLE: 'Vehículo',
  EQUIPMENT: 'Equipo',
  INVESTMENT: 'Inversión',
  OTHER: 'Otro',
}

export function getAssetStatusPresentation(status: unknown): AssetStatusPresentation {
  if (typeof status === 'string' && status in ASSET_STATUS_PRESENTATION) {
    return ASSET_STATUS_PRESENTATION[status as AssetStatus]
  }

  return {
    status: null,
    label: 'Estado no verificable',
    tone: 'warning',
    isVerified: false,
  }
}

export function matchesAssetStatusFilter(
  status: unknown,
  filter: AssetStatusFilter,
): boolean {
  if (filter === 'all') return true

  const presentation = getAssetStatusPresentation(status)
  if (filter === 'UNKNOWN') return !presentation.isVerified

  return presentation.status === filter
}

export function getAssetTypePresentation(
  asset: Pick<AssetWithTypeInfo, 'asset_type' | 'asset_type_id' | 'asset_type_info'>,
): AssetTypePresentation {
  const customName = asset.asset_type_info?.name?.trim()
  if (
    asset.asset_type_id
    && asset.asset_type_info?.id === asset.asset_type_id
    && customName
  ) {
    return {
      label: customName,
      source: 'CUSTOM',
      isVerified: true,
    }
  }

  if (asset.asset_type_id) {
    return {
      label: 'Tipo personalizado no verificable',
      source: 'UNVERIFIED',
      isVerified: false,
    }
  }

  if (Object.prototype.hasOwnProperty.call(ASSET_TYPE_LABELS, asset.asset_type)) {
    return {
      label: ASSET_TYPE_LABELS[asset.asset_type as AssetType],
      source: 'STANDARD',
      isVerified: true,
    }
  }

  return {
    label: 'Tipo no verificable',
    source: 'UNVERIFIED',
    isVerified: false,
  }
}
