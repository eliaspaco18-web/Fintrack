import { expect, test } from '@playwright/test'
import { getE2ECredentials, loginViaUI } from './helpers/auth'

const credentials = getE2ECredentials()

test.describe('authenticated smoke', () => {
  test.skip(!credentials, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run authenticated smoke tests.')

  test('can access dashboard, transactions, portfolio and admin', async ({ page }) => {
    await loginViaUI(page, credentials!)

    await expect(page.getByText('Balance Consolidado')).toBeVisible()

    await page.goto('/transactions/new')
    await expect(page.getByTestId('new-transaction-summary')).toBeVisible()

    const form = page.getByTestId('transaction-form')
    if ((await form.count()) > 0) {
      await expect(form).toBeVisible()
    } else {
      await expect(page.getByTestId('new-transaction-no-accounts')).toBeVisible()
    }

    await page.goto('/portfolio?new=portfolio')
    await expect(page.getByTestId('portfolio-form')).toBeVisible()

    await page.goto('/admin')
    await expect(page.getByTestId('categories-form')).toBeVisible()
  })

  test('redirects authenticated user away from login', async ({ page }) => {
    await loginViaUI(page, credentials!)

    await page.goto('/login')
    await expect(page).toHaveURL(/\/dashboard$/)
  })

  test('can toggle theme and persists after reload', async ({ page }) => {
    await loginViaUI(page, credentials!)

    const toggle = page.getByTestId('theme-toggle-button')
    await expect(toggle).toBeVisible()

    const initialTheme = await page.evaluate(() => {
      const current = document.documentElement.getAttribute('data-theme')
      return current === 'light' ? 'light' : 'dark'
    })

    await toggle.click()

    await expect.poll(async () => {
      return page.evaluate(() => document.documentElement.getAttribute('data-theme'))
    }).toBe(initialTheme === 'light' ? 'dark' : 'light')

    await page.reload()
    await expect.poll(async () => {
      return page.evaluate(() => document.documentElement.getAttribute('data-theme'))
    }).toBe(initialTheme === 'light' ? 'dark' : 'light')
  })
})
