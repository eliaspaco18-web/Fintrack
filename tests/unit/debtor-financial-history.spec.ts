import { expect, test } from '@playwright/test'
import { buildDebtorFinancialHistory } from '@/modules/receivables/debtor-financial-history'

test('combines documented lending with real linked movements and omits the mirrored source transaction', () => {
  const history = buildDebtorFinancialHistory([
    {
      id: 'receivable-1', transaction_id: 'issue-1', concept: 'Préstamo para equipo',
      amount: 2000, currency: 'PEN', issue_date: '2026-09-01', status: 'PARTIAL',
      source_account: { id: 'account-1', name: 'Cuenta soles' }, attachment_url: null,
    },
  ], [
    {
      id: 'issue-1', type: 'EXPENSE', amount: 2000, currency: 'PEN', description: 'Préstamo para equipo',
      notes: null, transaction_date: '2026-09-01', source_account: { id: 'account-1', name: 'Cuenta soles' },
    },
    {
      id: 'collection-1', type: 'INCOME', amount: 800, currency: 'PEN', description: 'Abono recibido',
      notes: 'Pago parcial', transaction_date: '2026-10-01', source_account: { id: 'account-2', name: 'Cuenta principal' },
    },
  ])

  expect(history).toHaveLength(2)
  expect(history.map(row => row.id)).toEqual(['transaction:collection-1', 'obligation:receivable-1'])
  expect(history[0]).toMatchObject({ source: 'transaction', type: 'INCOME', amount: 800, date: '2026-10-01' })
  expect(history[1]).toMatchObject({ source: 'obligation', type: 'EXPENSE', amount: 2000, date: '2026-09-01', accountName: 'Cuenta soles' })
})

test('does not infer undocumented links and preserves native currency and status fields', () => {
  const history = buildDebtorFinancialHistory([
    {
      id: 'legacy-receivable', concept: 'Registro heredado', amount: '100', currency: 'PEN',
      issue_date: '2026-08-01', status: 'PENDING', transaction_id: null,
    },
  ], [
    {
      id: 'legacy-expense', type: 'EXPENSE', amount: '100', currency: 'PEN', description: 'Registro heredado',
      notes: null, transaction_date: '2026-08-01',
    },
    {
      id: 'usd-income', type: 'INCOME', amount: '20', currency: 'USD', description: 'Abono',
      notes: null, transaction_date: '2026-08-02',
    },
  ])

  expect(history).toHaveLength(3)
  expect(history.find(row => row.id === 'obligation:legacy-receivable')?.status).toBe('PENDING')
  expect(history.find(row => row.id === 'transaction:usd-income')).toMatchObject({ currency: 'USD', amount: '20' })
})
