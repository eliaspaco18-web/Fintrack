import { expect, test } from '@playwright/test'
import { getE2ECredentials, loginViaUI } from './helpers/auth'

const credentials = getE2ECredentials()

test.describe('authenticated saved views', () => {
  test.skip(!credentials, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run authenticated saved-views tests.')

  test('can save, apply and delete a transaction table view', async ({ page }) => {
    await loginViaUI(page, credentials!)

    await page.addInitScript(() => {
      window.localStorage.removeItem('fintrack.transactions.saved-views.v1')
    })

    await page.goto('/transactions')
    await expect(page.getByTestId('transactions-search-input')).toBeVisible()

    const searchTerm = `vista-e2e-${Date.now()}`
    const viewName = `Vista E2E ${Date.now()}`

    await page.getByTestId('transactions-search-input').fill(searchTerm)
    await page.getByTestId('transactions-quick-filter-expense').click()
    await page.getByTestId('transactions-sort-select').selectOption('amount-desc')
    await page.getByTestId('transactions-per-page-select').selectOption('50')

    await page.getByTestId('transactions-save-view-button').click()
    await expect(page.getByTestId('transactions-save-view-modal')).toBeVisible()
    await page.getByTestId('transactions-save-view-name-input').fill(viewName)
    await page.getByTestId('transactions-save-view-confirm-button').click()
    await expect(page.getByTestId('transactions-save-view-modal')).toHaveCount(0)

    const savedViewSelect = page.getByTestId('transactions-saved-view-select')
    const savedViewOption = page.locator(
      '[data-testid="transactions-saved-view-select"] option',
      { hasText: viewName }
    ).first()
    await expect(savedViewOption).toBeVisible()
    await expect(
      page.locator('[data-testid="transactions-saved-view-select"] option:checked')
    ).toContainText(viewName)

    await page.getByTestId('transactions-search-input').fill(`${searchTerm}-changed`)
    await expect(savedViewSelect).toHaveValue('')

    const savedViewId = await savedViewOption.getAttribute('value')
    if (savedViewId) {
      await savedViewSelect.selectOption(savedViewId)
    }

    await expect(page.getByTestId('transactions-search-input')).toHaveValue(searchTerm)
    await expect(page.getByTestId('transactions-sort-select')).toHaveValue('amount-desc')
    await expect(page.getByTestId('transactions-per-page-select')).toHaveValue('50')

    await page.getByTestId('transactions-delete-view-button').click()
    await expect(page.getByTestId('transactions-delete-view-modal')).toBeVisible()
    await page.getByTestId('transactions-delete-view-confirm-button').click()
    await expect(page.getByTestId('transactions-delete-view-modal')).toHaveCount(0)

    await expect(savedViewOption).toHaveCount(0)
    await expect(savedViewSelect).toHaveValue('')
  })
})
