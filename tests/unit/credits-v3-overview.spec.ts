import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { deriveCreditDisplayType, type CreditListItem } from '@/lib/credits/display-type'
import { summarizeCredits } from '@/lib/credits/overview'
import type { Credit } from '@/types/database.types'

function fixture(overrides: Partial<Credit> & Partial<Pick<CreditListItem, 'display_type' | 'has_loan'>> = {}): CreditListItem {
  const credit: Credit = {
    id: 'credit-test', user_id: 'user-test', account_id: null, bank_entity_id: null,
    transaction_id: null, credit_type: 'LINE_OF_CREDIT', name: 'Crédito de prueba',
    currency: 'PEN', credit_limit: 1000, credit_limit_pen: 1000, credit_limit_usd: 0,
    used_amount: 250, used_amount_pen: 250, used_amount_usd: 0,
    initial_used_amount_pen: 250, initial_used_amount_usd: 0, available_amount: 750,
    interest_rate: 0, closing_day: null, payment_day: null, status: 'ACTIVE', notes: null,
    created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
  return { ...credit, display_type: overrides.display_type ?? 'LINE', has_loan: overrides.has_loan ?? false }
}

test('credit classifications keep cards, linked loans and ordinary lines distinct', () => {
  expect(deriveCreditDisplayType({ creditType: 'CREDIT_CARD', hasLoan: true })).toBe('CARD')
  expect(deriveCreditDisplayType({ creditType: 'LINE_OF_CREDIT', hasLoan: true })).toBe('LOAN')
  expect(deriveCreditDisplayType({ creditType: 'LINE_OF_CREDIT', hasLoan: false })).toBe('LINE')
})

test('overview keeps card debt and verified loan capital separate by native currency', () => {
  const result = summarizeCredits([
    fixture({ id: 'card-pen', credit_type: 'CREDIT_CARD', display_type: 'CARD', used_amount: 300, used_amount_pen: 300 }),
    fixture({ id: 'card-usd', credit_type: 'CREDIT_CARD', currency: 'USD', display_type: 'CARD', used_amount: 50, used_amount_pen: 0, used_amount_usd: 50 }),
    fixture({ id: 'loan-pen', display_type: 'LOAN', has_loan: true, credit_limit: 2000, used_amount: 2000 }),
    fixture({ id: 'loan-usd', currency: 'USD', display_type: 'LOAN', has_loan: true, credit_limit: 400, used_amount: 400 }),
    fixture({ id: 'loan-unknown', currency: 'EUR', display_type: 'LOAN', has_loan: false, credit_limit: 9999 }),
    fixture({ id: 'closed-card', credit_type: 'CREDIT_CARD', display_type: 'CARD', status: 'CLOSED', used_amount_pen: 900 }),
  ])

  expect(result).toMatchObject({
    activeCount: 5,
    closedCount: 1,
    activeCardCount: 2,
    cardDebt: { PEN: 300, USD: 50 },
    activeLoanCount: 3,
    verifiedLoanCapital: { PEN: 2000, USD: 400 },
    unavailableLoanCapitalCount: 1,
  })
})

test('credits screen uses approved V3 primitives and responsive list defaults', () => {
  const source = readFileSync(resolve(process.cwd(), 'components/credits/CreditsListPanel.tsx'), 'utf8')
  const css = readFileSync(resolve(process.cwd(), 'components/credits/CreditsListPanel.module.css'), 'utf8')
  const shell = readFileSync(resolve(process.cwd(), 'components/layout/AppShell.tsx'), 'utf8')
  const workspace = readFileSync(resolve(process.cwd(), 'components/credits/CreditsWorkspace.tsx'), 'utf8')
  const loanForm = readFileSync(resolve(process.cwd(), 'components/credits/BankLoanForm.tsx'), 'utf8')
  const cardSchedule = readFileSync(resolve(process.cwd(), 'components/credits/CreditCardScheduleModal.tsx'), 'utf8')
  const loanSchedule = readFileSync(resolve(process.cwd(), 'components/credits/BankLoanScheduleModal.tsx'), 'utf8')
  const cardForm = readFileSync(resolve(process.cwd(), 'components/credits/CreditCardForm.tsx'), 'utf8')
  const workbenchCss = readFileSync(resolve(process.cwd(), 'components/credits/CreditsWorkbench.module.css'), 'utf8')
  const contextualHint = readFileSync(resolve(process.cwd(), 'components/credits/CreditInfoHint.tsx'), 'utf8')

  expect(source).toContain('pageStyles.pageOverview')
  expect(source).toContain('pageStyles.v3ModulePrimaryAction')
  expect(source).toContain('<DataTable density="credit"')
  expect(source).toContain("useState<ViewMode>('list')")
  expect(source).toContain("value: 'BLOCKED', label: 'Bloqueados'")
  expect(source).toContain('setBankFilter')
  expect(source).toContain('typeFilter !== \'all\' && credit.display_type !== typeFilter')
  expect(source).not.toMatch(/--c-[a-z-]+|font-mono/)
  expect(css).toContain('@media (max-width: 980px)')
  expect(css).toContain('prefers-reduced-motion: reduce')
  expect(shell).toContain("pathname === '/credits' || pathname.startsWith('/credits/')")
  expect(workspace).toContain('presentation="workbench"')
  expect(source).toContain('presentation="workbench"')
  expect(loanForm).toContain('<IncomeDatePicker')
  expect(cardSchedule).toContain('workbenchKind="schedule"')
  expect(loanSchedule).toContain('workbenchKind="schedule"')
  expect(source).toContain('pageStyles.controlsMain')
  expect(source).toContain('pageStyles.controlsActions')
  expect(css).toContain('min-height: 36px')
  expect(css).toContain('min-height: 68px')
  expect(css).toContain('minmax(160px, 26fr)')
  expect(cardForm).toContain('<CreditCardScheduleModal')
  expect(cardForm).not.toContain('<CreditCardScheduleEditor')
  expect(workbenchCss).toContain('min(1040px, calc(100vw - 24px))')
  expect(workbenchCss).toContain('min(1240px, calc(100vw - 24px))')
  expect(workbenchCss).toContain('@media (max-width: 767px)')
  expect(contextualHint).toContain('aria-expanded={open}')
  expect(contextualHint).toContain("event.key === 'Escape'")
})
