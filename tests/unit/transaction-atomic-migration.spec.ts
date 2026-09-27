import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

const migration = (name: string) =>
  readFileSync(resolve(process.cwd(), 'supabase/migrations', name), 'utf8')

const converged = migration('20260927000001_converge_transaction_atomic_security.sql')

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

  test('explicitly removes anonymous and service-role execution from both overloads', () => {
    expect(converged.match(/FROM PUBLIC, anon, service_role;/g)).toHaveLength(2)
    expect(converged.match(/TO authenticated;/g)).toHaveLength(2)
    expect(
      readFileSync(resolve(process.cwd(), 'supabase/functions/fn_create_transaction_atomic.sql'), 'utf8'),
    ).not.toContain('CREATE OR REPLACE FUNCTION')
  })
})
