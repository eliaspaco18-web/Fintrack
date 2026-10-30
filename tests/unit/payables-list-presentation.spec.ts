import { expect, test } from '@playwright/test'
import { getPayablePaymentProgress, countPayablesDueWithinDays, isValidIsoDate } from '@/modules/payables/payables-list-presentation'
import { buildPayableFinancialHistory } from '@/modules/payables/payables-history-presentation'

test.describe('Payables list presentation', () => {
  test('calculates paid progress by verified native currency', () => {
    expect(getPayablePaymentProgress([
      { currency: 'PEN', total: 2000, settled: 800, pending: 1200, recordCount: 2, openRecordCount: 1 },
      { currency: 'USD', total: 500, settled: 125, pending: 375, recordCount: 1, openRecordCount: 1 },
    ])).toEqual({ available: true, items: [{ currency: 'PEN', percent: 40 }, { currency: 'USD', percent: 25 }] })
  })

  test('does not invent progress for empty, zero, or inconsistent summaries', () => {
    expect(getPayablePaymentProgress([])).toEqual({ available: false, reason: 'empty' })
    expect(getPayablePaymentProgress([{ currency: 'PEN', total: 0, settled: 0, pending: 0, recordCount: 1, openRecordCount: 0 }])).toEqual({ available: false, reason: 'inconsistent' })
    expect(getPayablePaymentProgress([{ currency: 'USD', total: 100, settled: 110, pending: -10, recordCount: 1, openRecordCount: 1 }])).toEqual({ available: false, reason: 'inconsistent' })
    expect(getPayablePaymentProgress([{ currency: 'PEN', total: 100, settled: 50, pending: 40, recordCount: 1, openRecordCount: 1 }])).toEqual({ available: false, reason: 'inconsistent' })
  })

  test('counts only unpaid obligations with a real date within the window', () => {
    expect(countPayablesDueWithinDays([
      { status: 'PENDING', due_date: '2026-10-25' },
      { status: 'PARTIAL', due_date: '2026-10-27' },
      { status: 'DISPUTED', due_date: '2026-10-26' },
      { status: 'PAID', due_date: '2026-10-24' },
      { status: 'PENDING', due_date: null },
      { status: 'PENDING', due_date: '2026-11-01' },
    ], '2026-10-21', 7)).toBe(3)
    expect(countPayablesDueWithinDays([{ status: 'PENDING', due_date: '2026-02-31' }], '2026-02-20', 14)).toBe(0)
    expect(isValidIsoDate('2026-10-20')).toBe(true)
    expect(isValidIsoDate('2026-02-31')).toBe(false)
  })

  test('deduplicates a document only when the exact linked transaction is present', () => {
    const history = buildPayableFinancialHistory([
      { id: 'doc-linked', transaction_id: 'tx-linked', concept: 'Factura', amount: 200, currency: 'PEN', issue_date: '2026-10-01', due_date: '2026-10-30', status: 'PARTIAL', source_account: { id: 'cash', name: 'Caja' } },
      { id: 'doc-only', transaction_id: 'tx-missing', concept: 'Deuda documentada', amount: 70, currency: 'USD', issue_date: '2026-10-02', due_date: null, status: 'PENDING' },
    ], [
      { id: 'tx-linked', type: 'EXPENSE', amount: 200, currency: 'PEN', description: 'Factura', notes: null, transaction_date: '2026-10-01', source_account: { id: 'cash', name: 'Caja' } },
      { id: 'payment', type: 'EXPENSE', amount: 50, currency: 'PEN', description: 'Pago parcial', notes: null, transaction_date: '2026-10-03', source_account: { id: 'cash', name: 'Caja' } },
      { id: 'loan', type: 'INCOME', amount: 100, currency: 'USD', description: null, notes: null, transaction_date: '2026-10-04' },
    ])

    expect(history.map(item => item.id)).toEqual(['ledger:loan', 'ledger:payment', 'payable:doc-only', 'ledger:tx-linked'])
    expect(history.find(item => item.id === 'ledger:tx-linked')).toMatchObject({ kind: 'obligation', status: 'Parcial', account: 'Caja' })
    expect(history.find(item => item.id === 'ledger:payment')).toMatchObject({ kind: 'payment', amount: 50, currency: 'PEN' })
    expect(history.find(item => item.id === 'ledger:loan')).toMatchObject({ kind: 'loan', currency: 'USD' })
    expect(history.filter(item => item.title === 'Factura')).toHaveLength(1)
  })
})
