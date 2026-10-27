import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

const migration = (name: string) =>
  readFileSync(resolve(process.cwd(), 'supabase/migrations', name), 'utf8')

const converged = migration('20260927000001_converge_transaction_atomic_security.sql')
const dashboardFx = migration('20261025000001_dashboard_fx_completeness.sql')

test.describe('atomic transaction migration contract', () => {
  test('drops all enum defaults before conversion and restores PEN after conversion', () => {
    const sql = migration('20260430000001_v2_schema_upgrade.sql')
    const columns = [
      ['profiles', 'default_currency'],
      ['accounts', 'currency'],
      ['transactions', 'currency'],
      ['assets', 'currency'],
      ['credits', 'currency'],
      ['loans', 'currency'],
      ['accounts_receivable', 'currency'],
      ['accounts_payable', 'currency'],
      ['budgets', 'currency'],
    ]

    for (const [table, column] of columns) {
      const drop = sql.search(new RegExp(`ALTER TABLE ${table}\\s+ALTER COLUMN ${column}\\s+DROP DEFAULT;`))
      const convert = sql.indexOf(`ALTER TABLE ${table} ALTER COLUMN ${column} TYPE text USING ${column}::text;`)
      const restored = sql.search(new RegExp(`ALTER TABLE ${table}\\s+ALTER COLUMN ${column}\\s+SET DEFAULT 'PEN';`))
      expect(drop, `${table} default drop`).toBeGreaterThan(-1)
      expect(convert, `${table} text conversion`).toBeGreaterThan(drop)
      expect(restored, `${table} text default`).toBeGreaterThan(convert)
    }
  })

  test('only post-conversion historical RPCs lose six stale casts each', () => {
    const historical = [
      '20260518000001_update_create_transaction_atomic_prd_v3.sql',
      '20260521000001_create_transaction_atomic_creditor_debtor_ids.sql',
      '20260527000001_transaction_asset_type_id_hotfix.sql',
    ]
    for (const name of historical) {
      expect(migration(name)).not.toContain('p_currency::currency_code')
      expect(migration(name).match(/\bp_currency\b/g)?.length).toBeGreaterThanOrEqual(6)
    }
    expect(
      migration('20260328232000_create_transaction_atomic.sql')
        .match(/p_currency::currency_code/g),
    ).toHaveLength(6)
  })

  test('has one invoker implementation and an invoker compatibility wrapper', () => {
    expect(converged.match(/SECURITY INVOKER/g)).toHaveLength(2)
    expect(converged).toContain('SET search_path = pg_catalog, public, pg_temp')
    expect(converged.match(/SET search_path = ''/g)).toHaveLength(1)
    expect(converged).not.toContain('SECURITY DEFINER')
    expect(converged).not.toContain('p_currency::currency_code')
    expect(converged.match(/INSERT INTO public\.transactions/g)).toHaveLength(1)
    expect(converged).toContain('SELECT public.create_transaction_atomic(')
    expect(converged).toContain('p_budget_id             => NULL::uuid')
  })

  test('forward hardening does not default omitted USD exchange rates to one', () => {
    const hardened = migration('20261025000002_atomic_exchange_rate_default_null.sql')
    expect(hardened.match(/p_exchange_rate\s+numeric\s+DEFAULT NULL,/g)).toHaveLength(2)
    expect(hardened).not.toContain('p_exchange_rate           numeric      DEFAULT 1.000000,')
    expect(hardened).toContain("p_currency = 'USD' AND")
    expect(hardened).toContain('(p_exchange_rate IS NULL OR p_exchange_rate < 0.01 OR p_exchange_rate > 100)')
    expect(hardened).toContain('CREATE OR REPLACE FUNCTION public.create_transaction_atomic(')
  })

  test('first dashboard FX migration preserves user isolation and least-privilege RPC access by itself', () => {
    const fnStart = dashboardFx.indexOf('CREATE OR REPLACE FUNCTION fn_dashboard_summary(p_user_id uuid)')
    const fnEnd = dashboardFx.indexOf('\n$$;', fnStart)
    const fnBody = dashboardFx.slice(fnStart, fnEnd)
    const revoke = dashboardFx.indexOf(
      'REVOKE ALL ON FUNCTION public.fn_dashboard_summary(uuid)\n  FROM PUBLIC, anon, service_role;'
    )
    const grant = dashboardFx.indexOf(
      'GRANT EXECUTE ON FUNCTION public.fn_dashboard_summary(uuid) TO authenticated;'
    )

    expect(fnStart).toBeGreaterThan(-1)
    expect(fnEnd).toBeGreaterThan(fnStart)
    expect(fnBody).toContain('IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN')
    expect(fnBody).toContain("USING ERRCODE = '42501'")
    expect(fnBody).toContain('SET search_path = pg_catalog, public, pg_temp')
    expect(revoke).toBeGreaterThan(fnEnd)
    expect(grant).toBeGreaterThan(revoke)
    expect(dashboardFx.slice(revoke)).not.toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.fn_dashboard_summary\(uuid\)\s+TO\s+(PUBLIC|anon|service_role)/i)
  })


  test('checks the caller and every externally supplied related id before insertion', () => {
    const guards = [
      'auth.uid() IS NULL',
      'p_user_id IS DISTINCT FROM auth.uid()',
      'FROM public.accounts',
      'FROM public.categories',
      'FROM public.budgets',
      'FROM public.asset_types',
      'FROM public.debtors',
      'FROM public.creditors',
      "p_currency NOT IN ('PEN', 'USD')",
      'p_amount <= 0',
    ]
    const firstInsert = converged.indexOf('INSERT INTO public.transactions')
    for (const guard of guards) {
      expect(converged.indexOf(guard), guard).toBeGreaterThan(-1)
      expect(converged.indexOf(guard), guard).toBeLessThan(firstInsert)
    }
  })

  test('links receivable/payable counterparties inside the atomic RPC instead of after-commit updates', () => {
    expect(converged).toContain('creditor_id, debtor_id')
    expect(converged).toContain("WHEN p_payable IS NOT NULL AND NULLIF(trim(p_payable->>'creditor_id'), '') IS NOT NULL")
    expect(converged).toContain("WHEN p_receivable IS NOT NULL AND NULLIF(trim(p_receivable->>'debtor_id'), '') IS NOT NULL")
    expect(converged).toContain('creditor_id, creditor_name')
    expect(converged).toContain('user_id, transaction_id, debtor_id, debtor_name')

    const receivableRoute = readFileSync(resolve(process.cwd(), 'app/api/receivables/route.ts'), 'utf8')
    const payableRoute = readFileSync(resolve(process.cwd(), 'app/api/payables/route.ts'), 'utf8')
    expect(receivableRoute).toContain('debtor_id: debtorId')
    expect(payableRoute).toContain('creditor_id,')
    expect(receivableRoute).not.toContain(".from('accounts_receivable')\n    .update(")
    expect(payableRoute).not.toContain(".from('accounts_payable')\n    .update(")
  })

  test('explicitly removes anonymous and service-role execution from both overloads', () => {
    expect(converged.match(/FROM PUBLIC, anon, service_role;/g)).toHaveLength(2)
    expect(converged.match(/TO authenticated;/g)).toHaveLength(2)
    expect(
      readFileSync(resolve(process.cwd(), 'supabase/functions/fn_create_transaction_atomic.sql'), 'utf8'),
    ).not.toContain('CREATE OR REPLACE FUNCTION')
  })
})
