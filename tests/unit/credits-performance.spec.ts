import { expect, test } from '@playwright/test'
import { getCreditBankFilterOptions } from '@/modules/credits/bank-filter-options'
import type { CreditListItem } from '@/lib/credits/display-type'

test('credit entity filters reuse the user-scoped bank relation already returned with each credit', () => {
  const credits = [
    { bank_entity: { id: 'bank-b', name: 'Banco B', short_name: 'B' } },
    { bank_entity: { id: 'bank-a', name: 'Banco A', short_name: 'A' } },
    { bank_entity: { id: 'bank-b', name: 'Banco B', short_name: 'B' } },
    { bank_entity: null },
  ] as unknown as CreditListItem[]

  expect(getCreditBankFilterOptions(credits)).toEqual([
    { id: 'bank-a', name: 'Banco A' },
    { id: 'bank-b', name: 'Banco B' },
  ])
})
