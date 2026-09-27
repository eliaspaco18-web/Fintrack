import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

const source = readFileSync(join(process.cwd(), 'lib/constants/quick-operations.ts'), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText
const moduleExports: Record<string, unknown> = {}
new Function('exports', compiled)(moduleExports)

type Operation = { id: string; label: string; href: string }
const operations = moduleExports.QUICK_OPERATIONS as Operation[]
const contextual = moduleExports.QUICK_CONTEXTUAL_CREATE as {
  portfolio: Operation
  budgets: Operation
  credits: Operation
}

test('Registrar preserves all eight real operation identities and prefill contracts', () => {
  expect(operations.map(operation => operation.id)).toEqual([
    'expense', 'income', 'transfer', 'receivable_issue', 'receivable_collect',
    'payable_issue', 'payable_pay', 'asset_purchase',
  ])
  expect(new Set(operations.map(operation => operation.href)).size).toBe(8)
  for (const operation of operations) {
    const url = new URL(operation.href, 'http://localhost')
    expect(url.pathname).toBe('/transactions')
    expect(url.searchParams.get('new')).toBe('transaction')
    expect(url.searchParams.has('account_id')).toBe(false)
    expect(url.searchParams.has('receivable_id')).toBe(false)
    expect(url.searchParams.has('payable_id')).toBe(false)
  }
  expect(operations.find(item => item.id === 'payable_pay')?.href).toContain('type=EXPENSE&module=payable')
  expect(operations.find(item => item.id === 'receivable_collect')?.href).toContain('type=INCOME&module=receivable')
  expect(operations.find(item => item.id === 'transfer')?.href).toContain('type=TRANSFER')
})

test('contextual creation remains limited to existing account, budget and credit entry paths', () => {
  expect(Object.keys(contextual)).toEqual(['portfolio', 'budgets', 'credits'])
  expect(contextual.portfolio.href).toBe('/portfolio?new=portfolio')
  expect(contextual.budgets.href).toBe('/budgets?new=budget')
  expect(contextual.credits.href).toBe('/credits?new=credit')
})
