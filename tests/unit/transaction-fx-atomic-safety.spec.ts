import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { getVerifiedUsdPenRate } from '@/lib/server/verified-exchange-rate'

const service = readFileSync(resolve(process.cwd(), 'modules/transactions/transaction.service.ts'), 'utf8')

test.describe('V2 compatibility with nullable exchange rates and the atomic RPC', () => {
  test('accepts persisted/manual rates and rejects fallback or absent rates', () => {
    expect(getVerifiedUsdPenRate(3.75, 'manual')).toBe(3.75)
    expect(getVerifiedUsdPenRate(3.72, 'exchange-api')).toBe(3.72)
    expect(getVerifiedUsdPenRate(3.7, 'fallback')).toBeNull()
    expect(getVerifiedUsdPenRate(null, 'exchange-api')).toBeNull()
    expect(getVerifiedUsdPenRate(Number.NaN, 'manual')).toBeNull()
  })

  test('the published V2 request shape includes budget id but omits the separately attached budget period', () => {
    const start = service.indexOf("'create_transaction_atomic',")
    const end = service.indexOf('\n      )', start)
    const request = service.slice(start, end)
    const argumentNames = [...request.matchAll(/^\s+(p_[a-z_]+):/gm)].map((match) => match[1])

    expect(start).toBeGreaterThan(-1)
    expect(argumentNames).toHaveLength(20)
    expect(argumentNames).toContain('p_budget_id')
    expect(argumentNames).not.toContain('p_budget_period_id')
  })

  test('RPC errors, including a stale PostgREST schema cache, fail closed without a direct insert fallback', () => {
    const start = service.indexOf('private async callAtomicFunction(')
    const end = service.indexOf('private async syncCounterpartyLinks(', start)
    const callImplementation = service.slice(start, end)

    expect(start).toBeGreaterThan(-1)
    expect(callImplementation).toContain('return Errors.atomicityFailure(')
    expect(callImplementation).not.toContain('createTransactionFallback')
    expect(callImplementation).not.toContain(".from('transactions')")
    expect(service).not.toContain('private async createTransactionFallback(')
    expect(service).not.toContain('private isMissingAtomicFunction(')
  })

  test('USD payload never inherits the PEN neutral factor when its verified rate is absent', () => {
    expect(service).toContain("input.currency === 'USD'\n        ? input.exchange_rate ?? null\n        : input.exchange_rate ?? 1.0")
    expect(service).toContain("snapshot.source)")
    expect(service).toContain('if (rate === null)')
  })
})
