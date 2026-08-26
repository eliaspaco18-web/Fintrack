import { expect, type Page } from '@playwright/test'
import { requireAuthenticatedQaTarget } from './qa-target'

export interface E2ECredentials {
  email: string
  password: string
}

export function getE2ECredentials(
  env: Record<string, string | undefined> = process.env,
): E2ECredentials | null {
  const email = env.E2E_USER_EMAIL?.trim()
  const password = env.E2E_USER_PASSWORD?.trim()

  if (!email && !password) return null

  requireAuthenticatedQaTarget(env)

  return { email: email!, password: password! }
}

export async function loginViaUI(page: Page, credentials: E2ECredentials) {
  const target = requireAuthenticatedQaTarget()
  await page.goto('/login')

  if (new URL(page.url()).origin !== target.baseURL) {
    throw new Error('Authenticated QA blocked because login left the approved Preview origin.')
  }

  await page.getByTestId('login-email-input').fill(credentials.email)
  await page.getByTestId('login-password-input').fill(credentials.password)

  await Promise.all([
    page.waitForURL(url => url.origin === target.baseURL && url.pathname === '/dashboard'),
    page.getByTestId('login-submit-button').click(),
  ])

  expect(new URL(page.url()).origin).toBe(target.baseURL)
  expect(new URL(page.url()).pathname).toBe('/dashboard')
}
