import { expect, test } from '@playwright/test'

test('login page renders required controls', async ({ page }) => {
  await page.goto('/login')

  await expect(page.getByTestId('login-form')).toBeVisible()
  await expect(page.getByTestId('login-email-input')).toBeVisible()
  await expect(page.getByTestId('login-password-input')).toBeVisible()
  await expect(page.getByTestId('login-submit-button')).toBeVisible()
  await expect(page.getByTestId('login-signup-button')).toBeVisible()
})
