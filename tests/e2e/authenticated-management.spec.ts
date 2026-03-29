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
  await page.goto('/portfolio')
  await expect(page.getByTestId('portfolio-form')).toBeVisible()

  await page.getByTestId('portfolio-name-input').fill(accountName)
  await page.getByTestId('portfolio-initial-balance-input').fill('100')
  await page.getByTestId('portfolio-submit-button').click()
  await expect(page.getByTestId('portfolio-name-input')).toHaveValue('', { timeout: 15_000 })

  await page.goto('/transactions/new')
  await expect(page.getByTestId('transaction-form')).toBeVisible()
}

async function createPortfolioAccount(page: Page, accountName: string) {
  await page.goto('/portfolio')
  await expect(page.getByTestId('portfolio-form')).toBeVisible()

  await page.getByTestId('portfolio-name-input').fill(accountName)
  await page.getByTestId('portfolio-institution-input').fill('E2E Bank')
  await page.getByTestId('portfolio-initial-balance-input').fill('250')
  await page.getByTestId('portfolio-submit-button').click()

  await expect(page.getByTestId('portfolio-name-input')).toHaveValue('', { timeout: 15_000 })
}

async function createCategory(page: Page, categoryName: string) {
  await page.goto('/admin')
  await expect(page.getByTestId('categories-form')).toBeVisible()

  await page.getByTestId('categories-name-input').fill(categoryName)
  await page.getByTestId('categories-scope-select').selectOption('EXPENSE')
  await page.getByTestId('categories-submit-button').click()

  await expect(page.getByTestId('categories-name-input')).toHaveValue('', { timeout: 15_000 })
}

test.describe('authenticated management connectivity', () => {
  test.skip(!credentials, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run authenticated management tests.')

  test('new portfolio account appears in transaction account selector', async ({ page }) => {
    await loginViaUI(page, credentials!)

    const accountName = `E2E Portfolio ${Date.now()}`
    await createPortfolioAccount(page, accountName)
    await expect(page.getByText(accountName).first()).toBeVisible({ timeout: 15_000 })

    await page.goto('/transactions/new')
    await expect(page.getByTestId('transaction-form')).toBeVisible()

    const accountOption = page.locator(
      '[data-testid="transaction-source-account-select"] option',
      { hasText: accountName }
    )
    await expect(accountOption.first()).toBeVisible()
  })

  test('new admin category appears in transaction category selector', async ({ page }) => {
    await loginViaUI(page, credentials!)
    await ensureTransactionFormReady(page)

    const categoryName = `E2E Categoria ${Date.now()}`
    await createCategory(page, categoryName)
    await expect(page.getByText(categoryName).first()).toBeVisible({ timeout: 15_000 })

    await page.goto('/transactions/new?type=EXPENSE')
    await expect(page.getByTestId('transaction-form')).toBeVisible()

    const categoryOption = page.locator(
      '[data-testid="transaction-category-select"] option',
      { hasText: categoryName }
    )
    await expect(categoryOption.first()).toBeVisible()
  })

  test('can deactivate a portfolio account using modal confirmation', async ({ page }) => {
    await loginViaUI(page, credentials!)

    const accountName = `E2E Portfolio Deactivate ${Date.now()}`
    await createPortfolioAccount(page, accountName)

    const row = page.locator('[data-testid^="portfolio-row-"]').filter({ hasText: accountName }).first()
    await expect(row).toBeVisible({ timeout: 15_000 })

    const deactivateButton = row.locator('[data-testid^="portfolio-deactivate-"]')
    await deactivateButton.click()
    await expect(page.getByTestId('portfolio-deactivate-modal')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('portfolio-deactivate-modal')).toHaveCount(0)
    await expect(deactivateButton).toBeFocused()

    await deactivateButton.click()
    await expect(page.getByTestId('portfolio-deactivate-modal')).toBeVisible()
    await page.getByTestId('portfolio-deactivate-confirm-button').click()
    await expect(page.getByTestId('portfolio-deactivate-modal')).toHaveCount(0, { timeout: 20_000 })

    await expect(row.locator('[data-testid^="portfolio-reactivate-"]')).toBeVisible({ timeout: 20_000 })
  })

  test('can delete a custom category using modal confirmation', async ({ page }) => {
    await loginViaUI(page, credentials!)

    const categoryName = `E2E Categoria Delete ${Date.now()}`
    await createCategory(page, categoryName)

    const row = page.locator('[data-testid^="categories-row-"]').filter({ hasText: categoryName }).first()
    await expect(row).toBeVisible({ timeout: 15_000 })

    const deleteButton = row.locator('[data-testid^="categories-delete-"]')
    await deleteButton.click()
    await expect(page.getByTestId('categories-delete-modal')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('categories-delete-modal')).toHaveCount(0)
    await expect(deleteButton).toBeFocused()

    await deleteButton.click()
    await expect(page.getByTestId('categories-delete-modal')).toBeVisible()
    await page.getByTestId('categories-delete-confirm-button').click()
    await expect(page.getByTestId('categories-delete-modal')).toHaveCount(0, { timeout: 20_000 })

    await expect(page.locator('[data-testid^="categories-row-"]').filter({ hasText: categoryName })).toHaveCount(0, {
      timeout: 20_000,
    })
  })
})
