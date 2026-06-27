import { expect, test, type Page } from '@playwright/test'
import { getE2ECredentials, loginViaUI } from './helpers/auth'

const credentials = getE2ECredentials()

async function ensureTransactionFormReady(page: Page) {
  await page.goto('/transactions/new')

  const noAccountsState = page.getByTestId('new-transaction-no-accounts')
  const needsBootstrap = (await noAccountsState.count()) > 0

  if (!needsBootstrap) {
    await expect(page.getByTestId('transaction-form')).toBeVisible()
    return
  }

  const accountName = `E2E Seed ${Date.now()}`
  await page.goto('/portfolio?new=portfolio')
  await expect(page.getByTestId('portfolio-form')).toBeVisible()

  await page.getByTestId('portfolio-name-input').fill(accountName)
  await page.getByTestId('portfolio-initial-balance-input').fill('100')
  await page.getByTestId('portfolio-submit-button').click()
  await expect(page.getByTestId('portfolio-name-input')).toHaveValue('', { timeout: 15_000 })

  await page.goto('/transactions/new')
  await expect(page.getByTestId('transaction-form')).toBeVisible()
}

test.describe('authenticated quick create', () => {
  test.skip(!credentials, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run authenticated quick-create tests.')

  test('quick account creation from transaction form', async ({ page }) => {
    await loginViaUI(page, credentials!)
    await ensureTransactionFormReady(page)

    const accountName = `E2E Quick Cuenta ${Date.now()}`
    const quickAccountTrigger = page.getByTestId('transaction-open-quick-account')
    await quickAccountTrigger.click()
    await expect(page.getByTestId('quick-account-modal')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('quick-create-overlay')).toHaveCount(0)
    await expect(quickAccountTrigger).toBeFocused()

    await quickAccountTrigger.click()
    await expect(page.getByTestId('quick-account-modal')).toBeVisible()

    await page.getByTestId('quick-account-name-input').fill(accountName)
    await page.getByTestId('quick-account-institution-input').fill('E2E Quick Bank')
    await page.getByTestId('quick-account-balance-input').fill('150')
    await page.getByTestId('quick-create-save').click()

    await expect(page.getByTestId('quick-create-overlay')).toHaveCount(0, { timeout: 15_000 })

    const selectedAccountOption = page.locator(
      '[data-testid="transaction-source-account-select"] option:checked'
    )
    await expect(selectedAccountOption).toContainText(accountName)
  })

  test('quick category creation from transaction form', async ({ page }) => {
    await loginViaUI(page, credentials!)
    await ensureTransactionFormReady(page)

    const categoryName = `E2E Quick Categoria ${Date.now()}`
    const quickCategoryTrigger = page.getByTestId('transaction-open-quick-category')
    await quickCategoryTrigger.click()
    await expect(page.getByTestId('quick-category-modal')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('quick-create-overlay')).toHaveCount(0)
    await expect(quickCategoryTrigger).toBeFocused()

    await quickCategoryTrigger.click()
    await expect(page.getByTestId('quick-category-modal')).toBeVisible()

    await page.getByTestId('quick-category-name-input').fill(categoryName)
    await page.getByTestId('quick-category-scope-select').selectOption('EXPENSE')
    await page.getByTestId('quick-create-save').click()

    await expect(page.getByTestId('quick-create-overlay')).toHaveCount(0, { timeout: 15_000 })

    const selectedCategoryOption = page.locator(
      '[data-testid="transaction-category-select"] option:checked'
    )
    await expect(selectedCategoryOption).toContainText(categoryName)
  })
})
