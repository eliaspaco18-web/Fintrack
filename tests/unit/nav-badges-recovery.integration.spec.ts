import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'
import { getNavBadgesCacheKey, NAV_BADGES_ENDPOINT, NAV_BADGES_SWR_POLICY } from '@/lib/hooks/nav-badges-policy'

declare global {
  interface Window {
    renderNavBadgeNotice: (showError: boolean, isRetrying?: boolean) => void
    navBadgeRetryCount: number
  }
}

const reactPath = join(process.cwd(), 'node_modules/react/umd/react.development.js')
const reactDomPath = join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js')

function noticeScript() {
  const source = readFileSync(join(process.cwd(), 'components/layout/NavBadgesErrorNotice.tsx'), 'utf8')
    .replace(/^'use client'\s*/, '')
    .replace(/export function /g, 'function ')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React },
  }).outputText
  return `${compiled}\nwindow.NavBadgesErrorNotice = NavBadgesErrorNotice;`
}

async function mountNotice(page: import('@playwright/test').Page, width: number) {
  await page.setViewportSize({ width, height: 760 })
  await page.setContent('<main id="root"></main>')
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: noticeScript() })
  await page.addScriptTag({ content: `
    window.navBadgeRetryCount = 0;
    window.renderNavBadgeNotice = (showError, isRetrying = false) => ReactDOM.render(
      showError ? React.createElement(window.NavBadgesErrorNotice, {
        isRetrying,
        onRetry: () => { window.navBadgeRetryCount += 1; },
      }) : null,
      document.getElementById('root'),
    );
  ` })
}

test('navigation badge cache is user-scoped and retries are bounded and deduplicated', () => {
  expect(getNavBadgesCacheKey('user-a')).toEqual([NAV_BADGES_ENDPOINT, 'user-a'])
  expect(getNavBadgesCacheKey('user-b')).not.toEqual(getNavBadgesCacheKey('user-a'))
  expect(getNavBadgesCacheKey(null)).toBeNull()
  expect(NAV_BADGES_SWR_POLICY).toMatchObject({
    shouldRetryOnError: true,
    errorRetryCount: 2,
    errorRetryInterval: 5_000,
    dedupingInterval: 30_000,
    refreshInterval: 60_000,
  })
})

test('navigation count warning permits in-app retry and clears after verified recovery on desktop and mobile', async ({ page }) => {
  for (const width of [1280, 390]) {
    await mountNotice(page, width)
    await page.evaluate(() => window.renderNavBadgeNotice(true))

    const warning = page.getByRole('alert')
    const retry = page.getByRole('button', { name: 'Reintentar verificación de indicadores de navegación' })
    await expect(warning).toContainText('No se pudieron verificar los indicadores de navegación.')
    await expect(warning).not.toContainText('recargar la página')
    await expect(retry).toBeVisible()
    await retry.click()
    await expect.poll(() => page.evaluate(() => window.navBadgeRetryCount)).toBe(1)

    await page.evaluate(() => window.renderNavBadgeNotice(true, true))
    await expect(retry).toBeDisabled()
    await expect(retry).toHaveText('Verificando…')

    // SWR removes its error after a successful revalidation; the notice follows that state.
    await page.evaluate(() => window.renderNavBadgeNotice(false))
    await expect(page.getByRole('alert')).toHaveCount(0)
  }
})
