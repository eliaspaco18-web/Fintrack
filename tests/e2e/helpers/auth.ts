import { expect, type Page } from '@playwright/test'

export interface E2ECredentials {
  email: string
  password: string
}

export function getE2ECredentials(): E2ECredentials | null {
  const email = process.env.E2E_USER_EMAIL?.trim()
  const password = process.env.E2E_USER_PASSWORD?.trim()

  if (!email || !password) return null

  return { email, password }
}

export async function loginViaUI(page: Page, credentials: E2ECredentials) {
  await page.goto('/login')

  await page.getByTestId('login-email-input').fill(credentials.email)
  await page.getByTestId('login-password-input').fill(credentials.password)

  await Promise.all([
    page.waitForURL(/\/dashboard$/),
    page.getByTestId('login-submit-button').click(),
  ])

  await expect(page).toHaveURL(/\/dashboard$/)
}
