import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { atomicDerivedJsonbArguments } from '../../modules/transactions/transaction-atomic-rpc-arguments'

const derivedKeys = [
  'p_asset',
  'p_credit',
  'p_loan',
  'p_receivable',
  'p_payable',
] as const

test('all five derived RPC arguments remain jsonb objects', () => {
  const service = readFileSync(resolve(process.cwd(), 'modules/transactions/transaction.service.ts'), 'utf8')
  const argumentsHelper = readFileSync(resolve(process.cwd(), 'modules/transactions/transaction-atomic-rpc-arguments.ts'), 'utf8')
  const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260927000001_converge_transaction_atomic_security.sql'), 'utf8')

  expect(service).toContain('...atomicDerivedJsonbArguments(payload)')
  for (const key of derivedKeys) {
    expect(argumentsHelper).toMatch(new RegExp(`${key}: payload\\.${key}\\s*[,}]`))
    expect(service).not.toMatch(new RegExp(`${key}:\\s*.*JSON\\.stringify`))
    expect(migration).toContain(`${key}->>`)
  }
  expect(argumentsHelper).not.toContain('JSON.stringify')
})

test('Supabase RPC serializes every derived jsonb argument as an object', async () => {
  let requestBody: unknown
  const fetchMock: typeof fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body))
    return new Response(JSON.stringify({ transaction_id: 'unit-test' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  const client = createClient('https://example.supabase.co', 'sb_publishable_unit_test', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: fetchMock },
  })

  const derived = {
    p_asset: { name: 'Unit Asset', asset_type: 'EQUIPMENT', purchase_value: 25 },
    p_credit: { name: 'Unit Credit', credit_type: 'LINE_OF_CREDIT', credit_limit: 50 },
    p_loan: { creditor_name: 'Unit Lender', principal_amount: 25, total_installments: 2 },
    p_receivable: { debtor_name: 'Unit Debtor' },
    p_payable: { creditor_name: 'Unit Creditor' },
  } as unknown as Parameters<typeof atomicDerivedJsonbArguments>[0]

  await client.rpc('create_transaction_atomic', atomicDerivedJsonbArguments(derived))

  expect(requestBody).toMatchObject(derived)
  for (const key of derivedKeys) {
    expect(typeof (requestBody as Record<string, unknown>)[key]).toBe('object')
    expect((requestBody as Record<string, unknown>)[key]).not.toBeNull()
  }
})

test('absent derived modules remain null instead of encoded strings', () => {
  const absent = Object.fromEntries(derivedKeys.map(key => [key, null])) as Parameters<typeof atomicDerivedJsonbArguments>[0]
  expect(atomicDerivedJsonbArguments(absent)).toEqual(absent)
})
