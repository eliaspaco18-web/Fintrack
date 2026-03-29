import { expect, test } from '@playwright/test'

const PROTECTED_ROUTES = [
  '/dashboard',
  '/transactions',
  '/portfolio',
  '/admin',
] as const

for (const route of PROTECTED_ROUTES) {
  test(`redirects unauthenticated user from ${route} to login`, async ({ page }) => {
    await page.goto(route)
    await expect(page).toHaveURL(/\/login(\?.*)?$/)

    const currentUrl = new URL(page.url())
    expect(currentUrl.pathname).toBe('/login')
    expect(currentUrl.searchParams.get('next')).toBe(route)
  })
}
