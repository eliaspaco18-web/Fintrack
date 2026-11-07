import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  projectLegacyReceivableLinks,
  type ReceivableReadDocument,
  type ReceivableSourceTransaction,
} from '@/lib/server/receivable-read-model'
import { getReceivablePersonState } from '@/modules/receivables/receivables-list-presentation'

test('a persisted collected document and an inherited open obligation remain pending', () => {
  const projection = projectLegacyReceivableLinks(
    [{ id: 'debtor-a', name: 'Lucía Núñez' }],
    [{
      id: 'document-collected', transaction_id: 'txn-collected', debtor_id: 'debtor-a', debtor_name: 'Lucía Núñez',
      amount: 100, collected_amount: 100, currency: 'PEN', status: 'COLLECTED',
    }],
    [
      { id: 'txn-collected', debtor_id: 'debtor-a', description: 'Préstamo cobrado', amount: 100, currency: 'PEN', transaction_date: '2026-10-01', notes: null },
      { id: 'txn-pending', debtor_id: 'debtor-a', description: 'Préstamo heredado', amount: 75, currency: 'USD', transaction_date: '2026-10-03', notes: null },
    ],
  )
  const records = projection.byDebtor.get('debtor-a') ?? []

  expect(records.map(row => [row.status, row.projection_source])).toEqual([
    ['COLLECTED', 'receivable'],
    ['PENDING', 'transaction'],
  ])
  expect(getReceivablePersonState(records, 'debtor-a', false)).toBe('OPEN')
  expect(records.filter(row => ['PENDING', 'PARTIAL'].includes(row.status))).toHaveLength(1)
  expect(records[1]).toMatchObject({ id: 'legacy-transaction-txn-pending', currency: 'USD', is_legacy_projection: true })
})

test('legacy documents with duplicate debtor names stay unassigned and mark both candidates incomplete', () => {
  const projection = projectLegacyReceivableLinks(
    [{ id: 'debtor-a', name: 'Alex Rivera' }, { id: 'debtor-b', name: ' Alex Rivera ' }],
    [{ id: 'orphan-1', transaction_id: null, debtor_id: null, debtor_name: 'ALEX RIVERA', amount: 500, collected_amount: 0, currency: 'PEN', status: 'PENDING' }],
    [],
  )

  expect(projection.byDebtor.get('debtor-a')).toEqual([])
  expect(projection.byDebtor.get('debtor-b')).toEqual([])
  expect(projection.coverage.ambiguousOrphanDocumentCount).toBe(1)
  expect(projection.coverage.ambiguousDebtorIds).toEqual(new Set(['debtor-a', 'debtor-b']))
})

test('duplicate transaction links are excluded from verified projection totals', () => {
  const docs = [
    { id: 'doc-a', transaction_id: 'txn-shared', debtor_id: 'debtor-a', debtor_name: 'A', amount: 100, collected_amount: 0, currency: 'PEN', status: 'PENDING' },
    { id: 'doc-b', transaction_id: 'txn-shared', debtor_id: 'debtor-b', debtor_name: 'B', amount: 100, collected_amount: 0, currency: 'PEN', status: 'PENDING' },
  ] as ReceivableReadDocument[]
  const projection = projectLegacyReceivableLinks([{ id: 'debtor-a', name: 'A' }, { id: 'debtor-b', name: 'B' }], docs, [])

  expect(projection.coverage.duplicateTransactionLinkCount).toBe(1)
  expect(projection.coverage.ambiguousDebtorIds).toEqual(new Set(['debtor-a', 'debtor-b']))
  expect(projection.byDebtor.get('debtor-a')?.every(row => row.is_ambiguous_projection)).toBe(true)
  expect(projection.byDebtor.get('debtor-b')?.every(row => row.is_ambiguous_projection)).toBe(true)
})

test('legacy transactions without a verifiable currency do not receive a PEN fallback', () => {
  const transaction = {
    id: 'txn-missing-currency', debtor_id: 'debtor-a', description: 'Sin moneda', amount: 10,
    currency: null, transaction_date: '2026-10-03', notes: null,
  } as ReceivableSourceTransaction
  const projected = projectLegacyReceivableLinks<ReceivableReadDocument, ReceivableSourceTransaction>([{ id: 'debtor-a', name: 'A' }], [], [transaction])

  expect(projected.byDebtor.get('debtor-a')?.[0]?.currency).toBeNull()
})

test('unlinked orphan documents and unlinked transactions remain incomplete instead of being double-counted', () => {
  const projection = projectLegacyReceivableLinks(
    [{ id: 'debtor-a', name: 'A' }],
    [{ id: 'orphan', transaction_id: null, debtor_id: null, debtor_name: 'A', amount: 40, collected_amount: 0, currency: 'PEN', status: 'PENDING' }],
    [{ id: 'transaction', debtor_id: 'debtor-a', description: 'Legacy', amount: 40, currency: 'PEN', transaction_date: '2026-10-01', notes: null }],
  )
  const rows = projection.byDebtor.get('debtor-a') ?? []

  expect(rows).toHaveLength(2)
  expect(rows.every(row => row.is_ambiguous_projection)).toBe(true)
  expect(projection.coverage.ambiguousDebtorIds.has('debtor-a')).toBe(true)
})

test('receivable read endpoints remain read-only and scope every projection query to the session user', () => {
  const debtorsRoute = readFileSync(resolve(process.cwd(), 'app/api/debtors/route.ts'), 'utf8')
  const receivablesRoute = readFileSync(resolve(process.cwd(), 'app/api/receivables/route.ts'), 'utf8')
  const debtorsGet = debtorsRoute.split('export async function GET')[1]?.split('export async function POST')[0] ?? ''
  const receivablesGet = receivablesRoute.split('export async function GET')[1]?.split('export async function POST')[0] ?? ''

  for (const handlerSource of [debtorsGet, receivablesGet]) {
    expect(handlerSource).not.toContain('repairLegacyReceivableLinks')
    expect(handlerSource).not.toMatch(/\.insert\s*\(/)
    expect(handlerSource).not.toMatch(/\.update\s*\(/)
    expect(handlerSource).toContain(".eq('user_id', userId)")
  }
  expect(debtorsGet).toContain('readAllPages')
  expect(receivablesGet).toContain('readAllPages')
})
