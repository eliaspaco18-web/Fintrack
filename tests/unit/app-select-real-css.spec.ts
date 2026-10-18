import { expect, test } from '@playwright/test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

const componentPath = join(process.cwd(), 'components/ui/AppSelect.tsx')
const reactPath = join(process.cwd(), 'node_modules/react/umd/react.development.js')
const reactDomPath = join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js')
const cssDirectory = join(process.cwd(), '.next/static/css')

function builtCss(): string {
  const files = readdirSync(cssDirectory).filter(file => file.endsWith('.css')).sort()
  if (files.length === 0) throw new Error('Build the application before running real-CSS selector integration tests')
  return files.map(file => readFileSync(join(cssDirectory, file), 'utf8')).join('\n')
}

function moduleClass(css: string, localName: string): string {
  const match = css.match(new RegExp(`([A-Za-z0-9_-]*_${localName}__[A-Za-z0-9_-]+)`))
  if (!match?.[1]) throw new Error(`Could not find the built CSS-module class for ${localName}`)
  return match[1]
}

function browserComponentSource(): string {
  const source = readFileSync(componentPath, 'utf8')
    .replace(/^'use client'\s*/, '')
    .replace(/import\s*\{[\s\S]*?\}\s*from 'react'/, 'const React = window.React; const { useCallback, useEffect, useId, useMemo, useRef, useState } = React')
    .replace(/import \{ createPortal \} from 'react-dom'/, 'const { createPortal } = window.ReactDOM')
    .replace(/export type /g, 'type ')
    .replace(/export function /g, 'function ')
  return `(() => { ${ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React },
  }).outputText}\nwindow.FinTrackTestAppSelect = AppSelect; })();`
}

async function preparePage(page: import('@playwright/test').Page, css: string) {
  page.on('pageerror', error => console.log('AppSelect browser error:', error.message))
  page.on('console', message => { if (message.type() === 'error') console.log('AppSelect console error:', message.text()) })
  await page.setContent('<div id="root" class="fin-shell" data-ft-v3 data-ft-v3-shell></div>')
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: browserComponentSource() })
}

test('portfolio filter menus render at trigger width with built V3 CSS and body portal', async ({ page }) => {
  const css = builtCss()
  const classes = {
    controls: moduleClass(css, 'controls'),
    bar: moduleClass(css, 'portfolioFilterBar'),
    filter: moduleClass(css, 'portfolioFilter'),
    currency: moduleClass(css, 'portfolioFilterCurrency'),
    type: moduleClass(css, 'portfolioFilterType'),
    institution: moduleClass(css, 'portfolioFilterInstitution'),
  }

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 834, height: 900 },
    { width: 1440, height: 900 },
    { width: 1710, height: 1000 },
  ]) {
    await page.setViewportSize(viewport)
    await preparePage(page, css)
    await page.addScriptTag({ content: `(() => {
      const classes = ${JSON.stringify(classes)};
      const definitions = [
        { id: 'portfolio-currency-filter', label: 'Moneda', className: classes.currency, value: 'PEN', options: [
          { value: 'PEN', label: 'PEN' }, { value: 'USD', label: 'USD' },
        ] },
        { id: 'portfolio-type-filter', label: 'Tipo', className: classes.type, value: 'CHECKING', options: [
          { value: 'CHECKING', label: 'Cuenta corriente con una denominación extensa para probar truncado' },
          { value: 'SAVINGS', label: 'Cuenta ahorros' },
        ] },
        { id: 'portfolio-institution-filter', label: 'Institución', className: classes.institution, value: 'all', options: [
          { value: 'all', label: 'Todas' }, { value: 'long', label: 'Institución financiera con nombre suficientemente largo para medir geometría' },
        ] },
      ];
      function Harness() {
        const [values, setValues] = React.useState(Object.fromEntries(definitions.map(item => [item.id, item.value])));
        return React.createElement('div', { className: classes.controls + ' ' + classes.bar + ' min-w-0', id: 'portfolio-toolbar' },
          ...definitions.map(item => React.createElement(window.FinTrackTestAppSelect, {
            key: item.id, options: item.options, value: values[item.id], onChange: value => setValues(current => ({ ...current, [item.id]: value })),
            ariaLabel: item.label, compact: true, matchTriggerWidth: true,
            className: classes.filter + ' ' + item.className + ' filters-control', testId: item.id,
            searchPlaceholder: 'Buscar ' + item.label.toLowerCase() + '…',
          }))
        );
      }
      ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
    })();` })

    for (const filter of [
      { id: 'portfolio-currency-filter', label: 'Moneda', longOption: false },
      { id: 'portfolio-type-filter', label: 'Tipo', longOption: true },
      { id: 'portfolio-institution-filter', label: 'Institución', longOption: true },
    ]) {
      const trigger = page.getByTestId(filter.id)
      await trigger.click()
      const menu = page.getByRole('dialog', { name: filter.label })
      await expect(menu).toBeVisible()
      await expect(page.getByRole('combobox', { name: filter.label })).toBeVisible()
      await page.waitForTimeout(500)

      const beforeFix = await menu.evaluate(element => {
        element.classList.remove('app-select-menu-match-trigger-width')
        const rect = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        return { width: rect.width, minWidth: style.minWidth, right: rect.right }
      })
      await menu.evaluate(element => element.classList.add('app-select-menu-match-trigger-width'))

      const measured = await page.evaluate(() => {
        const menuElement = document.querySelector<HTMLElement>('.app-select-menu')
        const triggerElement = document.querySelector<HTMLElement>('[aria-expanded="true"]')
        const selectElement = triggerElement?.closest<HTMLElement>('.app-select')
        if (!menuElement || !triggerElement) throw new Error('Expected an open AppSelect trigger and its menu')
        const menuRect = menuElement.getBoundingClientRect()
        const triggerRect = triggerElement.getBoundingClientRect()
        const menuStyle = getComputedStyle(menuElement)
        return {
          triggerWidth: triggerRect.width,
          triggerLeft: triggerRect.left,
          selectWidth: selectElement?.getBoundingClientRect().width,
          selectClasses: selectElement?.className,
          selectParentClasses: selectElement?.parentElement?.className,
          menuWidth: menuRect.width,
          left: menuRect.left,
          right: menuRect.right,
          viewportWidth: window.innerWidth,
          minWidth: menuStyle.minWidth,
          cssWidth: menuStyle.width,
          maxWidth: menuStyle.maxWidth,
          parentIsBody: menuElement.parentElement === document.body,
        }
      })

      console.log(`AppSelect ${filter.label} ${viewport.width}px`, JSON.stringify({ beforeFix, afterFix: measured }))
      expect(beforeFix.minWidth).toBe('100%')
      expect(beforeFix.width).toBeGreaterThan(measured.triggerWidth + 2)
      expect(Math.abs(measured.menuWidth - measured.triggerWidth), `${filter.label} at ${viewport.width}px: ${JSON.stringify(measured)}`).toBeLessThanOrEqual(2)
      expect(measured.minWidth).toBe('0px')
      expect(Number.parseFloat(measured.cssWidth)).toBeCloseTo(measured.triggerWidth, 0)
      expect(Number.parseFloat(measured.maxWidth)).toBeLessThanOrEqual(measured.triggerWidth + 0.5)
      expect(measured.left).toBeGreaterThanOrEqual(0)
      expect(measured.right).toBeLessThanOrEqual(measured.viewportWidth)
      expect(measured.left).toBeCloseTo(Math.max(8, Math.min(measured.triggerLeft, measured.viewportWidth - measured.menuWidth - 8)), 0)
      expect(measured.parentIsBody).toBe(true)

      if (filter.longOption) {
        const longLabel = menu.locator('.app-select-option-label').first()
        await expect(longLabel).toHaveCSS('text-overflow', 'ellipsis')
        await expect(longLabel).toHaveCSS('overflow', 'hidden')
      }

      const search = page.getByRole('combobox', { name: filter.label })
      await search.press('Escape')
      await expect(menu).toHaveCount(0)
      await expect(trigger).toBeFocused()
    }
  }
})

test('matched menu flips upward near the viewport bottom and keeps dark V3 surfaces', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const css = builtCss()
  await page.setContent('<html data-theme="dark"><body><div id="root" class="fin-shell" data-ft-v3 data-ft-v3-shell></div></body></html>')
  await page.addStyleTag({ content: css + '.test-bottom-anchor { position: fixed; left: 24px; bottom: 12px; width: 180px; }' })
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: browserComponentSource() })
  await page.addScriptTag({ content: `(() => {
    function Harness() {
      return React.createElement('div', { className: 'test-bottom-anchor' }, React.createElement(window.FinTrackTestAppSelect, {
        options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }, { value: 'c', label: 'C' }],
        value: 'a', onChange: () => {}, ariaLabel: 'Filtro inferior', compact: true, matchTriggerWidth: true, testId: 'bottom-filter',
      }))
    }
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
  })();` })

  const trigger = page.getByTestId('bottom-filter')
  await trigger.click()
  const menu = page.getByRole('dialog', { name: 'Filtro inferior' })
  await expect(menu).toBeVisible()
  const geometry = await page.evaluate(() => {
    const triggerElement = document.querySelector<HTMLElement>('[data-testid="bottom-filter"]')!
    const menuElement = document.querySelector<HTMLElement>('.app-select-menu')!
    const triggerRect = triggerElement.getBoundingClientRect()
    const menuRect = menuElement.getBoundingClientRect()
    return {
      triggerTop: triggerRect.top,
      menuTop: menuRect.top,
      menuBottom: menuRect.bottom,
      menuWidth: menuRect.width,
      triggerWidth: triggerRect.width,
      background: getComputedStyle(menuElement).backgroundColor,
      viewportHeight: innerHeight,
    }
  })
  console.log('AppSelect bottom anchor dark mode 390px', JSON.stringify(geometry))
  expect(Math.abs(geometry.menuWidth - geometry.triggerWidth)).toBeLessThanOrEqual(2)
  expect(geometry.menuBottom).toBeLessThanOrEqual(geometry.triggerTop - 4)
  expect(geometry.menuTop).toBeGreaterThanOrEqual(0)
  expect(geometry.menuBottom).toBeLessThanOrEqual(geometry.viewportHeight)
  expect(geometry.background).not.toBe('rgba(0, 0, 0, 0)')
})

test('trigger-matched selector in the account modal portal keeps measured width and keyboard behavior', async ({ page }) => {
  await page.setViewportSize({ width: 834, height: 700 })
  const css = builtCss()
  await page.setContent(`
    <div class="fin-shell" data-ft-v3 data-ft-v3-shell>
      <div class="test-overlay"><div class="test-focus-scope" data-app-select-portal-root>
        <section role="dialog" aria-modal="true" aria-label="Añadir cuenta" class="test-account-modal">
          <button id="before-select">Anterior</button><div id="root"></div><button id="after-select">Siguiente</button>
        </section>
      </div></div>
    </div>
  `)
  await page.addStyleTag({ content: css + `
    .test-overlay { position: fixed; inset: 0; z-index: 120; background: rgb(0 0 0 / .24); }
    .test-focus-scope { position: relative; z-index: 1; width: 100%; height: 100%; }
    .test-account-modal { position: absolute; left: 200px; top: 180px; width: 420px; height: 260px; overflow: hidden; background: var(--ft-surface); padding: 24px; }
  ` })
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: browserComponentSource() })
  await page.addScriptTag({ content: `(() => {
    function Harness() {
      const [value, setValue] = React.useState('PEN');
      return React.createElement(window.FinTrackTestAppSelect, {
        options: [{ value: 'PEN', label: 'Sol peruano' }, { value: 'USD', label: 'Dólar estadounidense' }],
        value, onChange: setValue, ariaLabel: 'Moneda de la cuenta', compact: true, matchTriggerWidth: true, testId: 'account-modal-currency',
      });
    }
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
  })();` })

  const trigger = page.getByTestId('account-modal-currency')
  await trigger.click()
  const menu = page.getByRole('dialog', { name: 'Moneda de la cuenta' })
  await expect(menu).toBeVisible()
  await page.waitForTimeout(500)
  const dimensions = await menu.evaluate(element => {
    const menuRect = element.getBoundingClientRect()
    const triggerElement = document.querySelector<HTMLElement>('[data-testid="account-modal-currency"]')
    const triggerRect = triggerElement!.getBoundingClientRect()
    return {
      width: menuRect.width,
      triggerWidth: triggerRect.width,
      minWidth: getComputedStyle(element).minWidth,
      parentIsFocusScope: element.parentElement?.hasAttribute('data-app-select-portal-root'),
      right: menuRect.right,
    }
  })
  expect(Math.abs(dimensions.width - dimensions.triggerWidth)).toBeLessThanOrEqual(2)
  expect(dimensions.minWidth).toBe('0px')
  expect(dimensions.parentIsFocusScope).toBe(true)
  expect(dimensions.right).toBeLessThanOrEqual(834)

  const search = page.getByRole('combobox', { name: 'Moneda de la cuenta' })
  await search.fill('dólar')
  await search.press('Enter')
  await expect(menu).toHaveCount(0)
  await expect(trigger).toContainText('Dólar estadounidense')
  await expect(trigger).toBeFocused()
})
