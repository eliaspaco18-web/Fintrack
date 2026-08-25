import { expect, test } from '@playwright/test'
import {
  ASSET_STATUS_FILTERS,
  getAssetStatusPresentation,
  getAssetTypePresentation,
  matchesAssetStatusFilter,
  type AssetWithTypeInfo,
} from '@/modules/assets/asset-presentation'

function assetFixture(overrides: Partial<AssetWithTypeInfo> = {}): AssetWithTypeInfo {
  return {
    id: 'asset-1',
    user_id: 'user-1',
    name: 'Equipo principal',
    asset_type: 'OTHER',
    asset_type_id: null,
    asset_type_info: null,
    purchase_date: '2026-08-01',
    purchase_value: 4_500,
    current_value: 4_200,
    currency: 'PEN',
    status: 'ACTIVE',
    depreciation_rate: null,
    serial_number: null,
    location: null,
    recipient: null,
    notes: null,
    attachment_url: null,
    transaction_id: null,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

test.describe('Assets status filtering and custom type detail correctness', () => {
  test('uses only the three persisted asset statuses as verified filters', () => {
    expect(ASSET_STATUS_FILTERS).toEqual(['ACTIVE', 'SOLD', 'DEPRECIATED'])

    for (const status of ASSET_STATUS_FILTERS) {
      expect(matchesAssetStatusFilter(status, status)).toBe(true)
      expect(getAssetStatusPresentation(status).isVerified).toBe(true)
    }

    expect(matchesAssetStatusFilter('SOLD', 'ACTIVE')).toBe(false)
    expect(matchesAssetStatusFilter('DEPRECIATED', 'SOLD')).toBe(false)
    expect(matchesAssetStatusFilter('ACTIVE', 'DEPRECIATED')).toBe(false)
  })

  test('presents active, sold and depreciated records without collapsing their meaning', () => {
    expect(getAssetStatusPresentation('ACTIVE')).toMatchObject({
      status: 'ACTIVE',
      label: 'Activo',
      isVerified: true,
    })
    expect(getAssetStatusPresentation('SOLD')).toMatchObject({
      status: 'SOLD',
      label: 'Vendido',
      isVerified: true,
    })
    expect(getAssetStatusPresentation('DEPRECIATED')).toMatchObject({
      status: 'DEPRECIATED',
      label: 'Depreciado',
      isVerified: true,
    })
  })

  test('does not reinterpret unsupported inactive, archived or retired states as active', () => {
    for (const status of ['INACTIVE', 'ARCHIVED', 'RETIRED', null, undefined]) {
      expect(getAssetStatusPresentation(status)).toMatchObject({
        status: null,
        label: 'Estado no verificable',
        isVerified: false,
      })
      expect(matchesAssetStatusFilter(status, 'ACTIVE')).toBe(false)
      expect(matchesAssetStatusFilter(status, 'UNKNOWN')).toBe(true)
      expect(matchesAssetStatusFilter(status, 'all')).toBe(true)
    }
  })

  test('shows a configured custom type instead of the legacy OTHER value', () => {
    const asset = assetFixture({
      asset_type: 'OTHER',
      asset_type_id: 'type-custom-1',
      asset_type_info: {
        id: 'type-custom-1',
        name: 'Coleccionable',
        color: '#0D6B5E',
        icon: null,
      },
    })
    const before = structuredClone(asset)

    expect(getAssetTypePresentation(asset)).toEqual({
      label: 'Coleccionable',
      source: 'CUSTOM',
      isVerified: true,
    })
    expect(asset).toEqual(before)
  })

  test('keeps standard legacy types truthful when no custom type is assigned', () => {
    expect(getAssetTypePresentation(assetFixture({
      asset_type: 'REAL_ESTATE',
      asset_type_id: null,
      asset_type_info: null,
    }))).toEqual({
      label: 'Inmueble',
      source: 'STANDARD',
      isVerified: true,
    })
  })

  test('does not invent a custom type when its reference cannot be resolved', () => {
    expect(getAssetTypePresentation(assetFixture({
      asset_type: 'OTHER',
      asset_type_id: 'missing-type',
      asset_type_info: null,
    }))).toEqual({
      label: 'Tipo personalizado no verificable',
      source: 'UNVERIFIED',
      isVerified: false,
    })
  })

  test('does not trust custom type metadata associated with a different identifier', () => {
    expect(getAssetTypePresentation(assetFixture({
      asset_type: 'OTHER',
      asset_type_id: 'type-custom-1',
      asset_type_info: {
        id: 'type-custom-2',
        name: 'Tipo equivocado',
        color: null,
        icon: null,
      },
    }))).toEqual({
      label: 'Tipo personalizado no verificable',
      source: 'UNVERIFIED',
      isVerified: false,
    })
  })

  test('does not invent a standard label for an unsupported legacy type', () => {
    const asset = assetFixture()
    const unsupported = {
      ...asset,
      asset_type: 'COLLECTIBLE',
    } as unknown as AssetWithTypeInfo

    expect(getAssetTypePresentation(unsupported)).toEqual({
      label: 'Tipo no verificable',
      source: 'UNVERIFIED',
      isVerified: false,
    })
  })

  test('does not change stored values, currency or depreciation data while presenting metadata', () => {
    const asset = assetFixture({
      status: 'DEPRECIATED',
      purchase_value: 9_900,
      current_value: 6_300,
      currency: 'USD',
      depreciation_rate: 0.15,
      asset_type: 'EQUIPMENT',
    })
    const before = structuredClone(asset)

    getAssetStatusPresentation(asset.status)
    getAssetTypePresentation(asset)

    expect(asset).toEqual(before)
    expect(asset.purchase_value).toBe(9_900)
    expect(asset.current_value).toBe(6_300)
    expect(asset.currency).toBe('USD')
    expect(asset.depreciation_rate).toBe(0.15)
  })
})
