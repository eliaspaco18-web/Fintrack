import { expect, test } from '@playwright/test'
import { ASSETS_DEMO_FIXTURES, isAssetsDemoAllowed } from '@/modules/assets/demo-assets'

test.describe('assets visual demo isolation', () => {
  test('allows the demo only in Preview or explicitly opted-in local development', () => {
    expect(isAssetsDemoAllowed({ vercelEnv: 'preview', nodeEnv: 'production' })).toBe(true)
    expect(isAssetsDemoAllowed({ nodeEnv: 'development', localOptIn: '1' })).toBe(true)
    expect(isAssetsDemoAllowed({ nodeEnv: 'development' })).toBe(false)
    expect(isAssetsDemoAllowed({ vercelEnv: 'production', nodeEnv: 'production', localOptIn: '1' })).toBe(false)
    expect(isAssetsDemoAllowed({ vercelEnv: 'staging', nodeEnv: 'production', localOptIn: '1' })).toBe(false)
  })

  test('fixtures are six fictitious, unlinked, mixed-currency records', () => {
    expect(ASSETS_DEMO_FIXTURES).toHaveLength(6)
    expect(ASSETS_DEMO_FIXTURES.map(asset => asset.name)).toEqual([
      'MacBook Pro 14', 'iPhone 16 Pro', 'Toyota Corolla', 'Cámara Sony', 'Impresora Epson', 'Escritorio de oficina',
    ])
    expect(new Set(ASSETS_DEMO_FIXTURES.map(asset => asset.currency))).toEqual(new Set(['PEN', 'USD']))
    expect(ASSETS_DEMO_FIXTURES.map(asset => asset.status)).toEqual(['ACTIVE', 'ACTIVE', 'ACTIVE', 'SOLD', 'DEPRECIATED', 'ACTIVE'])
    expect(ASSETS_DEMO_FIXTURES.every(asset => asset.user_id === 'demo-assets-view-only' && asset.transaction_id === null)).toBe(true)
    expect(ASSETS_DEMO_FIXTURES.every(asset => asset.id.startsWith('demo-asset-'))).toBe(true)
  })
})
