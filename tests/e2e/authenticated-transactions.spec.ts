import { expect, test, type Page } from '@playwright/test'
import { getE2ECredentials, loginViaUI } from './helpers/auth'

const credentials = getE2ECredentials()

async function ensureAtLeastOneAccount(page: Page) {
  await page.goto('/transactions/new')

  const noAccountsState = page.getByTestId('new-transaction-no-accounts')
  const needsBootstrap = (await noAccountsState.count()) > 0

  if (!needsBootstrap) return

  await page.goto('/portfolio?new=portfolio')
  await expect(page.getByTestId('portfolio-form')).toBeVisible()

  const accountName = `E2E Cuenta ${Date.now()}`
  await page.getByTestId('portfolio-name-input').fill(accountName)
  await page.getByTestId('portfolio-initial-balance-input').fill('100')
  await page.getByTestId('portfolio-submit-button').click()

  // El form se resetea tras guardado exitoso.
  await expect(page.getByTestId('portfolio-name-input')).toHaveValue('', { timeout: 15_000 })
}

async function createExpenseTransaction(page: Page, description: string, amount = '57.9') {
  await page.goto('/transactions/new')
  await expect(page.getByTestId('transaction-form')).toBeVisible()

  const sourceSelect = page.getByTestId('transaction-source-account-select')
  const firstAccountOption = sourceSelect.locator('option:not([value=""])').first()
  await expect(firstAccountOption).toBeVisible()

  const sourceAccountId = await firstAccountOption.getAttribute('value')
  if (sourceAccountId) {
    await sourceSelect.selectOption(sourceAccountId)
  }

  const categorySelect = page.getByTestId('transaction-category-select')
  const firstCategoryOption = categorySelect.locator('option:not([value=""])').first()
  await expect(firstCategoryOption).toBeVisible()

  const categoryId = await firstCategoryOption.getAttribute('value')
  if (categoryId) {
    await categorySelect.selectOption(categoryId)
  }

  await page.getByTestId('transaction-amount-input').fill(amount)
  await page.getByTestId('transaction-description-input').fill(description)
  await page.getByTestId('transaction-submit-button').click()

  await expect(page.getByTestId('transaction-success-summary')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('transaction-success-summary')).toContainText(description)

  await page.getByTestId('transaction-success-view-button').click()
  await expect(page).toHaveURL(/\/transactions$/)
}

async function createAssetPurchaseTransaction(page: Page, assetName: string, amount = '1200') {
  await page.goto('/transactions/new?module=asset')
  await expect(page.getByTestId('transaction-form')).toBeVisible()

  const sourceSelect = page.getByTestId('transaction-source-account-select')
  const firstAccountOption = sourceSelect.locator('option:not([value=""])').first()
  await expect(firstAccountOption).toBeVisible()

  const sourceAccountId = await firstAccountOption.getAttribute('value')
  if (sourceAccountId) {
    await sourceSelect.selectOption(sourceAccountId)
  }

  await expect(page.getByTestId('transaction-currency-select')).toBeDisabled()

  const assetTypeSelect = page.getByTestId('transaction-asset-type-select')
  const firstAssetTypeOption = assetTypeSelect.locator('option:not([value=""])').first()
  await expect(firstAssetTypeOption).toBeVisible()

  const assetTypeId = await firstAssetTypeOption.getAttribute('value')
  if (assetTypeId) {
    await assetTypeSelect.selectOption(assetTypeId)
  }

  await page.getByTestId('transaction-amount-input').fill(amount)
  await page.getByTestId('transaction-asset-name-input').fill(assetName)
  await page.getByTestId('transaction-description-input').fill(`Compra ${assetName}`)
  await page.getByTestId('transaction-submit-button').click()

  await expect(page.getByTestId('transaction-success-summary')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('transaction-success-summary')).toContainText(assetName)
}

test.describe('authenticated transactions', () => {
  test.skip(!credentials, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run authenticated transaction tests.')

  test('can create an expense transaction end-to-end', async ({ page }) => {
    await loginViaUI(page, credentials!)
    await ensureAtLeastOneAccount(page)

    const description = `E2E TX ${Date.now()}`
    await createExpenseTransaction(page, description)
  })

  test('can create an asset purchase transaction with managed asset types', async ({ page }) => {
    await loginViaUI(page, credentials!)
    await ensureAtLeastOneAccount(page)

    const assetName = `E2E Asset ${Date.now()}`
    await createAssetPurchaseTransaction(page, assetName)
  })

  test('transactions table shows key controls', async ({ page }) => {
    await loginViaUI(page, credentials!)
    await page.goto('/transactions')

    await expect(page.getByTestId('transactions-search-input')).toBeVisible()
    await expect(page.getByTestId('transactions-account-filter')).toBeVisible()
    await expect(page.getByTestId('transactions-category-filter')).toBeVisible()
    await expect(page.getByTestId('transactions-sort-select')).toBeVisible()
    await expect(page.getByTestId('transactions-per-page-select')).toBeVisible()
    await expect(page.getByTestId('transactions-reset-filters-button')).toBeVisible()
  })

  test('can delete a transaction through the table modal', async ({ page }) => {
    await loginViaUI(page, credentials!)
    await ensureAtLeastOneAccount(page)

    const description = `E2E DELETE ${Date.now()}`
    await createExpenseTransaction(page, description, '19.9')

    await expect(page.getByTestId('transactions-search-input')).toBeVisible()
    await page.getByTestId('transactions-search-input').fill(description)

    const row = page.locator('tbody tr', { hasText: description }).first()
    await expect(row).toBeVisible({ timeout: 15_000 })

    const deleteButton = row.locator('[data-testid^="transactions-row-delete-"]').first()
    await deleteButton.click({ force: true })

    await expect(page.getByTestId('transactions-delete-modal')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('transactions-delete-modal')).toHaveCount(0)
    await expect(deleteButton).toBeFocused()

    await deleteButton.click({ force: true })
    await expect(page.getByTestId('transactions-delete-modal')).toBeVisible()
    await page.getByTestId('transactions-delete-confirm-button').click()
    await expect(page.getByTestId('transactions-delete-modal')).toHaveCount(0, { timeout: 20_000 })

    await expect(page.locator('tbody tr', { hasText: description })).toHaveCount(0, { timeout: 20_000 })
  })

  test('can delete a transaction from transaction detail modal', async ({ page }) => {
    await loginViaUI(page, credentials!)
    await ensureAtLeastOneAccount(page)

    const description = `E2E DETAIL DELETE ${Date.now()}`
    await createExpenseTransaction(page, description, '23.4')

    await expect(page.getByTestId('transactions-search-input')).toBeVisible()
    await page.getByTestId('transactions-search-input').fill(description)

    const row = page.locator('tbody tr', { hasText: description }).first()
    await expect(row).toBeVisible({ timeout: 15_000 })
    await row.click()

    await expect(page).toHaveURL(/\/transactions\/[0-9a-f-]+$/)
    await expect(page.getByTestId('transaction-detail-delete-button')).toBeVisible()

    await page.getByTestId('transaction-detail-delete-button').click()
    await expect(page.getByTestId('transaction-detail-delete-modal')).toBeVisible()
    await page.getByTestId('transaction-detail-delete-cancel-button').click()
    await expect(page.getByTestId('transaction-detail-delete-modal')).toHaveCount(0)

    await page.getByTestId('transaction-detail-delete-button').click()
    await expect(page.getByTestId('transaction-detail-delete-modal')).toBeVisible()
    await page.getByTestId('transaction-detail-delete-confirm-button').click()

    await expect(page).toHaveURL(/\/transactions$/)
    await page.getByTestId('transactions-search-input').fill(description)
    await expect(page.locator('tbody tr', { hasText: description })).toHaveCount(0, { timeout: 20_000 })
  })
})
