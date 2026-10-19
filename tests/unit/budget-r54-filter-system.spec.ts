import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'

const managerSource = readFileSync(join(process.cwd(), 'components/management/BudgetsManager.tsx'), 'utf8')
const budgetsCss = readFileSync(join(process.cwd(), 'components/management/BudgetsManager.module.css'), 'utf8')
const movementCss = readFileSync(join(process.cwd(), 'components/tables/TransactionsRound07.module.css'), 'utf8')

test('budget filters reuse the approved portfolio toolbar and adaptive AppSelect menu behavior', () => {
  expect(managerSource).toContain('movementPageStyles.portfolioFilterBar} ${styles.budgetFilterToolbar}')
  expect(managerSource).toContain('className={`${movementPageStyles.searchControl} ${styles.budgetSearchControl}`}')
  expect(managerSource.match(/adaptiveMenuWidth/g)).toHaveLength(3)
  expect(managerSource).toContain('movementPageStyles.portfolioFilterCurrency')
  expect(managerSource).toContain('styles.budgetPeriodFilter')
  expect(managerSource).toContain('styles.budgetCategoryFilter')

  // The trigger, focus, hover and compact-height rules come from the same real
  // Round 07 class used by PortfolioManager, not a second budget-only skin.
  expect(budgetsCss).not.toContain('.budgetFilterToolbar :global(.app-select-trigger-compact)')
  expect(budgetsCss).not.toContain('.budgetFilterToolbar :global(.app-select-trigger-compact:hover)')
  expect(budgetsCss).not.toContain('.budgetFilterToolbar :global(.app-select-trigger-compact:focus-visible)')
  expect(movementCss).toContain('.portfolioFilterBar :global(.app-select-trigger-compact)')
  expect(movementCss).toContain('.portfolioFilterBar :global(.app-select-trigger-compact:hover)')
  expect(movementCss).toContain('.portfolioFilterBar :global(.app-select-trigger-compact:focus-visible)')
})

test('budget toolbar keeps one search frame and omits removed status, refresh, and result-count controls', () => {
  const toolbarStart = managerSource.indexOf('data-testid="budgets-filter-toolbar"')
  const toolbarEnd = managerSource.indexOf('\n      >', toolbarStart)
  const toolbar = managerSource.slice(toolbarStart, toolbarEnd)
  expect(toolbar).not.toContain('Activos')
  expect(toolbar).not.toContain('Inactivos')
  expect(toolbar).not.toContain('Todos')
  expect(toolbar).not.toContain('Actualizar')
  expect(toolbar).not.toContain('filteredBudgetSeries.length')
  expect(toolbar).not.toContain('filteredPeriodRows.length')
  expect(budgetsCss).toContain(".budgetSearchControl > :global(input[data-testid='budgets-search-input'])")
  expect(budgetsCss).toContain('border: 0;')
  expect(budgetsCss).toContain('background: transparent;')
  expect(budgetsCss).toContain('box-shadow: none;')
})
