import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  projectLegacyReceivableLinks,
  type ReceivableReadDocument,
  type ReceivableSourceTransaction,
} from '@/lib/server/receivable-read-model'

test('legacy receivable links are projected in memory with stable financial amounts and no duplicate transaction', () => {
  const debtors = [
    { id: 'debtor-a', name: 'Lucía Núñez' },
    { id: 'debtor-b', name: 'Marco Díaz' },
  ]
  const documents = [
    { transaction_id: 'txn-linked', debtor_id: 'debtor-a', debtor_name: 'Lucía Núñez', amount: 120, collected_amount: 20, currency: 'PEN', status: 'PARTIAL' },
    { transaction_id: null, debtor_id: null, debtor_name: '  LUCÍA NÚÑEZ ', amount: 40, collected_amount: 0, currency: 'USD', status: 'PENDING' },
  ] as ReceivableReadDocument[]
  const transactions = [
    { id: 'txn-linked', debtor_id: 'debtor-a', description: 'Ya documentado', amount: 120, currency: 'PEN', transaction_date: '2026-10-01', notes: null },
    { id: 'txn-missing', debtor_id: 'debtor-a', description: 'Préstamo heredado', amount: 75, currency: 'PEN', transaction_date: '2026-10-03', notes: 'Legado' },
    { id: 'txn-b', debtor_id: 'debtor-b', description: 'Otro deudor', amount: 90, currency: 'USD', transaction_date: '2026-10-04', notes: null },
  ] as ReceivableSourceTransaction[]

  const projected = projectLegacyReceivableLinks(debtors, documents, transactions, new Set(['txn-linked']))
  const debtorA = projected.get('debtor-a') ?? []
  const debtorB = projected.get('debtor-b') ?? []

  expect(debtorA).toHaveLength(3)
  expect(debtorA.filter(row => row.transaction_id === 'txn-linked')).toHaveLength(1)
  expect(debtorA.find(row => row.debtor_name === '  LUCÍA NÚÑEZ ')?.debtor_id).toBe('debtor-a')
  expect(debtorA.find(row => row.transaction_id === 'txn-missing')).toMatchObject({
    id: 'legacy-transaction-txn-missing',
    amount: 75,
    collected_amount: 0,
    currency: 'PEN',
    status: 'PENDING',
    is_legacy_projection: true,
  })
  expect(debtorB).toHaveLength(1)
  expect(debtorB[0]?.transaction_id).toBe('txn-b')
})

test('receivables and debtors GET handlers no longer run the mutating legacy repair helper', () => {
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
  expect(debtorsGet).toContain('projectLegacyReceivableLinks')
  expect(receivablesGet).toContain('projectLegacyReceivableLinks')
  expect((debtorsGet.match(/\.from\(/g) ?? [])).toHaveLength(3)
  expect((receivablesGet.match(/\.from\(/g) ?? [])).toHaveLength(4)
})
