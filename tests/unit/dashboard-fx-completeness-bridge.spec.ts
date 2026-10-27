import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

const service = readFileSync(resolve(process.cwd(), 'modules/dashboard/dashboard.service.ts'), 'utf8')

test('V2 dashboard refuses nullable or mismatched FX instead of converting it to zero or a fixed rate', () => {
  expect(service).toContain('getVerifiedPersistedUsdPenRate()')
  expect(service).toContain('raw.meta?.exchange_rate_verified === false')
  expect(service).toContain('raw.net_worth_pen == null')
  expect(service).toContain('account.balance_pen == null')
  expect(service).toContain('Math.abs(rpcRate - verifiedRateResult.data) > 0.000001')
  expect(service).toContain(".not('source', 'ilike', 'fallback')")
  expect(service).not.toContain('DEFAULT_USD_PEN_EXCHANGE_RATE')
  expect(service).not.toContain('raw.net_worth_pen ?? 0')
})
