import type { Asset } from '@/types/database.types'
import type { AssetWithTypeInfo } from './asset-presentation'

export type AssetsDemoEnvironment = {
  vercelEnv?: string
  nodeEnv?: string
  localOptIn?: string
}

/** Demo fixtures are intentionally unavailable in production, even when a URL flag is present. */
export function isAssetsDemoAllowed(environment: AssetsDemoEnvironment): boolean {
  if (environment.vercelEnv === 'production') return false
  if (environment.vercelEnv === 'preview') return true
  return environment.nodeEnv === 'development' && environment.localOptIn === '1'
}

const DEMO_USER_ID = 'demo-assets-view-only'

function fixture(
  values: Pick<Asset, 'id' | 'name' | 'asset_type' | 'currency' | 'purchase_date' | 'purchase_value' | 'current_value' | 'status' | 'recipient' | 'notes'>,
): AssetWithTypeInfo {
  return {
    ...values,
    user_id: DEMO_USER_ID,
    asset_type_id: null,
    attachment_url: null,
    created_at: '2026-01-01T12:00:00.000Z',
    depreciation_rate: null,
    location: null,
    serial_number: null,
    transaction_id: null,
    updated_at: '2026-01-01T12:00:00.000Z',
    asset_type_info: null,
  }
}

/** Fixed, fictitious records for isolated visual review only. No linked transactions or persisted IDs. */
export const ASSETS_DEMO_FIXTURES: AssetWithTypeInfo[] = [
  fixture({ id: 'demo-asset-macbook', name: 'MacBook Pro 14', asset_type: 'EQUIPMENT', currency: 'PEN', purchase_date: '2026-01-15', purchase_value: 8499, current_value: 8499, status: 'ACTIVE', recipient: 'Equipo de trabajo', notes: 'Registro ficticio para revisión visual.' }),
  fixture({ id: 'demo-asset-iphone', name: 'iPhone 16 Pro', asset_type: 'EQUIPMENT', currency: 'USD', purchase_date: '2026-02-08', purchase_value: 1199, current_value: 1199, status: 'ACTIVE', recipient: 'Dispositivo móvil', notes: 'Registro ficticio para revisión visual.' }),
  fixture({ id: 'demo-asset-toyota', name: 'Toyota Corolla', asset_type: 'VEHICLE', currency: 'PEN', purchase_date: '2025-11-20', purchase_value: 78500, current_value: 78500, status: 'ACTIVE', recipient: 'Movilidad', notes: 'Registro ficticio para revisión visual.' }),
  fixture({ id: 'demo-asset-sony', name: 'Cámara Sony', asset_type: 'EQUIPMENT', currency: 'USD', purchase_date: '2024-10-04', purchase_value: 1849, current_value: 1849, status: 'SOLD', recipient: 'Equipo audiovisual', notes: 'Registro ficticio; estado vendido solo para la demostración.' }),
  fixture({ id: 'demo-asset-epson', name: 'Impresora Epson', asset_type: 'EQUIPMENT', currency: 'PEN', purchase_date: '2023-06-12', purchase_value: 1299, current_value: 1299, status: 'DEPRECIATED', recipient: 'Oficina', notes: 'Importe de demostración; no representa depreciación calculada.' }),
  fixture({ id: 'demo-asset-desk', name: 'Escritorio de oficina', asset_type: 'OTHER', currency: 'PEN', purchase_date: '2025-03-01', purchase_value: 980, current_value: 980, status: 'ACTIVE', recipient: 'Mobiliario', notes: 'Registro ficticio para revisión visual.' }),
]

export const ASSETS_DEMO_TYPES = [
  { id: 'EQUIPMENT', name: 'Equipo' },
  { id: 'VEHICLE', name: 'Vehículo' },
  { id: 'OTHER', name: 'Otro' },
]
