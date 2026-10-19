import { expect, test } from '@playwright/test'
import { quickOperationHrefForId } from '@/lib/constants/quick-operations'

const operationIds = [
  'income',
  'expense',
  'transfer',
  'receivable_issue',
  'receivable_collect',
  'payable_issue',
  'payable_pay',
  'asset_purchase',
] as const

test('dashboard selector resolves all eight operations to existing transaction creation deep links', () => {
  for (const operationId of operationIds) {
    const href = quickOperationHrefForId(operationId)
    expect(href, operationId).not.toBeNull()

    const params = new URLSearchParams(href?.split('?')[1])
    expect(params.get('new'), operationId).toBe('transaction')
    expect(params.has('type'), operationId).toBe(true)
  }

  expect(quickOperationHrefForId('unknown-operation')).toBeNull()
})
