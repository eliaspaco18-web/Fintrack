import { expect, test } from '@playwright/test'

const iconPaths = [
  '/brand/v3/ft-favicon.svg',
  '/brand/v3/ft-favicon-16.png',
  '/brand/v3/ft-favicon-32.png',
  '/brand/v3/ft-favicon-48.png',
  '/brand/v3/ft-apple-touch-icon.png',
]

test('browser metadata and icon resources resolve to the V3 identity', async ({ page, request }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/login')

  const metadataIcons = await page.locator('head link[rel="icon"], head link[rel="shortcut icon"], head link[rel="apple-touch-icon"]').evaluateAll(links =>
    links.map(link => ({
      rel: (link as HTMLLinkElement).rel,
      href: new URL((link as HTMLLinkElement).href).pathname,
      type: (link as HTMLLinkElement).type,
      sizes: (link as HTMLLinkElement).sizes?.value ?? '',
    })),
  )

  for (const path of iconPaths) {
    expect(metadataIcons.some(icon => icon.href === path), `missing metadata link for ${path}`).toBe(true)
    const response = await request.get(path)
    expect(response.status(), path).toBe(200)
    expect(response.headers()['content-type']).toMatch(path.endsWith('.svg') ? /image\/svg\+xml/ : /image\/png/)
  }

  expect(metadataIcons).toContainEqual(expect.objectContaining({
    rel: 'icon',
    href: '/brand/v3/ft-favicon.svg',
    type: 'image/svg+xml',
    sizes: 'any',
  }))
  expect(metadataIcons).toContainEqual(expect.objectContaining({
    rel: 'apple-touch-icon',
    href: '/brand/v3/ft-apple-touch-icon.png',
  }))
  const faviconSvg = await (await request.get('/brand/v3/ft-favicon.svg')).text()
  expect(faviconSvg).toContain('prefers-color-scheme:dark')
  expect(faviconSvg).toContain('#9ed6c5')

  const pageHtml = await page.content()
  expect(pageHtml).not.toMatch(/fintrack-(?:mark|tab-icon)\.png/)
  expect(pageHtml).not.toContain('/brand/logo-fintrack.png')
  expect(page.locator('img[src="/brand/v3/ft-ligature.svg"]')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('brand-v3-login-desktop.png'), fullPage: true })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.locator('img[src="/brand/v3/ft-ligature.svg"]').first()).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('brand-v3-landing-mobile.png'), fullPage: true })
})

test('protected dashboard retains the root V3 identity while unauthenticated', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login(?:\?|$)/)
  await expect(page.locator('head link[rel="icon"][href*="ft-favicon.svg"]')).toHaveCount(1)
})
