import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

test('receivable and payable RPC jsonb arguments are not double-encoded', () => {
  const service = readFileSync(resolve(process.cwd(), 'modules/transactions/transaction.service.ts'), 'utf8')
  const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260927000001_converge_transaction_atomic_security.sql'), 'utf8')

  expect(service).toMatch(/p_receivable:\s+payload\.p_receivable\s*[,}]/)
  expect(service).toMatch(/p_payable:\s+payload\.p_payable\s*[,}]/)
  expect(service).not.toMatch(/p_receivable:\s+payload\.p_receivable\s*\?\s*JSON\.stringify/)
  expect(service).not.toMatch(/p_payable:\s+payload\.p_payable\s*\?\s*JSON\.stringify/)
  expect(migration).toContain("p_receivable->>'debtor_name'")
  expect(migration).toContain("p_payable->>'creditor_name'")
})

test('Supabase RPC serializes a nested jsonb argument as an object', async () => {
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

  await client.rpc('create_transaction_atomic', {
    p_receivable: { debtor_name: 'Unit Debtor' },
    p_payable: { creditor_name: 'Unit Creditor' },
  })

  expect(requestBody).toMatchObject({
    p_receivable: { debtor_name: 'Unit Debtor' },
    p_payable: { creditor_name: 'Unit Creditor' },
  })
})
