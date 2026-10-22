import { expect, test } from '@playwright/test'
import { buildAssetPurchaseModulePayload } from '@/modules/assets/asset-purchase-payload'
import type { TransactionFormValues } from '@/lib/contracts/ui.contracts'

const values: TransactionFormValues = {
  type: 'EXPENSE',
  source_account_id: 'account-1',
  payment_method: 'DEBIT',
  amount: 1250.5,
  currency: 'PEN',
  description: 'Compra de equipo',
  transaction_date: '2026-10-22',
  is_recurring: false,
  creates_asset: false,
  creates_credit: false,
  creates_loan: false,
  loan_schedule: true,
  creates_receivable: false,
  creates_payable: false,
  category_system_key: null,
  asset_name: 'Equipo de prueba',
  asset_type: 'EQUIPMENT',
  asset_type_id: 'custom-type-1',
  asset_serial: 'SERIAL-01',
  asset_location: 'Oficina',
  notes: '  Conservar esta nota en el registro del activo  ',
}

test('asset purchase preserves the approved form metadata in the one linked asset payload', () => {
  expect(buildAssetPurchaseModulePayload(values)).toEqual({
    name: 'Equipo de prueba',
    asset_type: 'EQUIPMENT',
    asset_type_id: 'custom-type-1',
    purchase_value: 1250.5,
    serial_number: 'SERIAL-01',
    location: 'Oficina',
    notes: 'Conservar esta nota en el registro del activo',
  })
})

test('empty optional asset notes remain omitted rather than being represented as fabricated content', () => {
  expect(buildAssetPurchaseModulePayload({ ...values, notes: '   ' }).notes).toBeUndefined()
})
