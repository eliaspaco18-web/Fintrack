import { expect, test } from '@playwright/test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

// Exercise the actual shared component in an isolated browser without mounting
// a product route, connecting Supabase, or simulating a financial mutation.
const componentPath = join(process.cwd(), 'components/ui/AppSelect.tsx')
const reactPath = join(process.cwd(), 'node_modules/react/umd/react.development.js')
const reactDomPath = join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js')

function browserComponentSource(): string {
  const source = readFileSync(componentPath, 'utf8')
    .replace(/^'use client'\s*/, '')
    .replace(/import\s*\{[\s\S]*?\}\s*from 'react'/, 'const React = window.React; const { useCallback, useEffect, useId, useMemo, useRef, useState } = React')
    .replace(/import \{ createPortal \} from 'react-dom'/, 'const { createPortal } = window.ReactDOM')
    .replace(/export type /g, 'type ')
    .replace(/export function /g, 'function ')
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.None,
      jsx: ts.JsxEmit.React,
    },
  }).outputText
  return `${compiled}\nwindow.FinTrackTestAppSelect = AppSelect;`
}

test('search, exact value commit, disabled choice, keyboard and Escape stay inside selection layer', async ({ page }) => {
  await page.setContent('<style>.app-select{position:relative}.app-select-menu{position:absolute;z-index:5;background:white}.app-select-option{display:block}</style><div id="root"></div>')
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: browserComponentSource() })
  await page.addScriptTag({ content: `
    window.parentEscapeCount = 0;
    document.addEventListener('keydown', event => { if (event.key === 'Escape') window.parentEscapeCount += 1; });
    const options = [
      { value: 'pen', label: 'Sol peruano', hint: 'PEN' },
      { value: 'usd', label: 'Dólar estadounidense', hint: 'USD' },
      { value: 'eur', label: 'Euro', hint: 'EUR', disabled: true },
    ];
    function Harness() {
      const [value, setValue] = React.useState('usd');
      return React.createElement('div', null,
        React.createElement('button', { id: 'previous-field' }, 'Anterior'),
        React.createElement(window.FinTrackTestAppSelect, {
          options, value, onChange: setValue, ariaLabel: 'Moneda', searchable: false, testId: 'currency-select',
        }),
        React.createElement('button', { id: 'next-field' }, 'Siguiente'),
        React.createElement('output', { id: 'committed-value' }, value),
      );
    }
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
  ` })

  const trigger = page.getByTestId('currency-select')
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  if (process.env.V3_CAPTURE_SELECT === '1') {
    const cssDirectory = join(process.cwd(), '.next/static/css')
    const globalCssName = readdirSync(cssDirectory, { recursive: true }).map(String).find(name => name.endsWith('.css') &&
      readFileSync(join(cssDirectory, name), 'utf8').includes('ft-v3-select-enter'),
    )
    if (!globalCssName) throw new Error('Build V3 CSS before capturing the selector')
    await page.addStyleTag({ content: readFileSync(join(cssDirectory, globalCssName), 'utf8') })
    await page.evaluate(() => {
      document.getElementById('root')?.setAttribute('data-ft-v3', '')
      document.getElementById('root')?.setAttribute('style', 'width: 360px; margin: 100px 0 0 48px;')
    })
    await page.setViewportSize({ width: 1440, height: 900 })
  }
  await trigger.click()
  const search = page.getByRole('combobox', { name: 'Moneda' })
  await expect(search).toBeFocused()
  const listboxId = await search.getAttribute('aria-controls')
  expect(listboxId).toBeTruthy()
  await expect(page.locator(`[id="${listboxId}"]`)).toHaveAttribute('role', 'listbox')
  await expect(page.getByRole('option', { name: /Dólar estadounidense/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('option', { name: /Euro/ })).toBeDisabled()

  if (process.env.V3_CAPTURE_SELECT === '1') {
    const captureOnlyStyle = await page.addStyleTag({ content: '#previous-field,#next-field,#committed-value{display:none!important}' })
    await page.screenshot({ path: join(process.cwd(), 'docs/redesign-v3/implementation/stage4-select-light-1440.png') })
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
    await expect.poll(() => trigger.evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(32, 35, 39)')
    await page.screenshot({ path: join(process.cwd(), 'docs/redesign-v3/implementation/stage4-select-dark-1440.png') })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.evaluate(() => {
      document.getElementById('root')?.setAttribute('style', 'width: 320px; margin: 80px auto 0;')
    })
    await page.screenshot({ path: join(process.cwd(), 'docs/redesign-v3/implementation/stage4-select-dark-390.png') })
    await captureOnlyStyle.evaluate(element => (element as Element).remove())
  }

  await search.fill('sol')
  await expect(page.getByRole('option')).toHaveCount(1)
  await expect(page.locator('#committed-value')).toHaveText('usd')
  await search.evaluate(element => element.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Enter', bubbles: true, isComposing: true,
  })))
  await expect(page.locator('#committed-value')).toHaveText('usd')
  await search.press('Enter')
  await expect(page.locator('#committed-value')).toHaveText('pen')
  await expect(trigger).toBeFocused()

  await trigger.press('ArrowDown')
  await expect(search).toBeFocused()
  await search.press('Escape')
  await expect(trigger).toBeFocused()
  await expect(page.getByRole('combobox')).toHaveCount(0)
  await expect(page.locator('#committed-value')).toHaveText('pen')
  expect(await page.evaluate(() => Reflect.get(window, 'parentEscapeCount'))).toBe(0)

  await trigger.click()
  await search.press('Tab')
  await expect(page.locator('#next-field')).toBeFocused()
  await expect(page.getByRole('combobox')).toHaveCount(0)
  await trigger.click()
  await search.press('Shift+Tab')
  await expect(page.locator('#previous-field')).toBeFocused()
})

test('selected ID survives missing options and two selectors have distinct accessible IDs', async ({ page }) => {
  await page.setContent('<style>#root>div{display:flex;gap:500px}.app-select{position:relative;width:180px}.app-select-menu{position:absolute;z-index:5;background:white}.app-select-option{display:block}</style><div id="root"></div>')
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: browserComponentSource() })
  await page.addScriptTag({ content: `
    function Harness() {
      const [value, setValue] = React.useState('historical-id');
      const props = { options: [{ value: 'new-id', label: 'Nueva cuenta' }], value, onChange: setValue };
      return React.createElement('div', null,
        React.createElement(window.FinTrackTestAppSelect, { ...props, ariaLabel: 'Cuenta origen', selectedFallbackLabel: 'Cuenta histórica' }),
        React.createElement(window.FinTrackTestAppSelect, { ...props, ariaLabel: 'Cuenta destino' }),
        React.createElement('output', { id: 'committed-value' }, value),
      );
    }
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
  ` })

  await expect(page.getByRole('button', { name: 'Cuenta origen' })).toContainText('Cuenta histórica')
  await expect(page.locator('#committed-value')).toHaveText('historical-id')
  await page.getByRole('button', { name: 'Cuenta origen' }).click()
  const firstPanelId = await page.getByRole('button', { name: 'Cuenta origen' }).getAttribute('aria-controls')
  expect(firstPanelId).toBeTruthy()
  await page.getByRole('button', { name: 'Cuenta destino' }).click()
  const secondPanelId = await page.getByRole('button', { name: 'Cuenta destino' }).getAttribute('aria-controls')
  expect(secondPanelId).toBeTruthy()
  expect(firstPanelId).not.toBe(secondPanelId)
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await expect(page.locator('#committed-value')).toHaveText('historical-id')
})

test('loading, error, retry and no-match leave the committed value untouched', async ({ page }) => {
  await page.setContent('<style>.app-select{position:relative}.app-select-menu{position:absolute;z-index:5;background:white}.app-select-option{display:block}</style><div id="root"></div>')
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: browserComponentSource() })
  await page.addScriptTag({ content: `
    function Harness() {
      const [status, setStatus] = React.useState('loading');
      const [value, setValue] = React.useState('historical-id');
      return React.createElement('div', null,
        React.createElement(window.FinTrackTestAppSelect, {
          options: [{ value: 'one', label: 'Ahorros' }], value, onChange: setValue,
          ariaLabel: 'Cuenta', selectedFallbackLabel: 'Cuenta histórica',
          loading: status === 'loading', error: status === 'error' ? 'No se pudieron cargar cuentas' : null,
          onRetry: () => setStatus('ready'), sourceComplete: false,
        }),
        React.createElement('button', { id: 'fail', onClick: () => setStatus('error') }, 'Falló'),
        React.createElement('output', { id: 'committed-value' }, value),
      );
    }
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
  ` })

  await page.getByRole('button', { name: 'Cuenta' }).click()
  await expect(page.getByRole('status', { name: '' }).filter({ hasText: 'Cargando opciones' })).toBeVisible()
  await page.evaluate(() => document.getElementById('fail')?.click())
  await expect(page.getByRole('alert')).toContainText('No se pudieron cargar cuentas')
  await page.getByRole('button', { name: 'Reintentar' }).click()
  await expect(page.getByText('Mostrando opciones cargadas')).toBeVisible()
  const search = page.getByRole('combobox', { name: 'Cuenta' })
  await search.fill('No existe')
  await expect(page.getByText('Sin resultados')).toBeVisible()
  await expect(page.locator('#committed-value')).toHaveText('historical-id')
})

test('a selection inside a modal stays in its accessibility subtree and flips within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 500 })
  await page.setContent('<style>.app-select-menu{background:white;z-index:20}.app-select-option{display:block;height:44px}</style><div id="root"></div>')
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: browserComponentSource() })
  await page.addScriptTag({ content: `
    function Harness() {
      return React.createElement('div', {
        role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Registrar',
        style: { height: '180px', width: '400px', margin: '400px auto 0', overflow: 'hidden' },
      }, React.createElement(window.FinTrackTestAppSelect, {
        options: [{ value: 'one', label: 'Cuenta uno' }, { value: 'two', label: 'Cuenta dos' }],
        value: 'one', onChange: () => {}, ariaLabel: 'Cuenta',
      }));
    }
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
  ` })

  await page.getByRole('button', { name: 'Cuenta' }).click()
  const selection = page.getByRole('dialog', { name: 'Cuenta' })
  await expect(selection).toBeVisible()
  expect(await selection.evaluate(element => element.parentElement?.getAttribute('aria-label'))).toBe('Registrar')
  const triggerBox = await page.getByRole('button', { name: 'Cuenta' }).boundingBox()
  const menuBox = await selection.boundingBox()
  expect(triggerBox).not.toBeNull()
  expect(menuBox).not.toBeNull()
  expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(500)
  expect(menuBox!.y).toBeLessThan(triggerBox!.y)
  await expect(page.getByRole('combobox', { name: 'Cuenta' })).toBeFocused()
})

test('mobile selection uses the visual viewport bounds without committing on search', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 })
  await page.setContent('<style>.app-select-menu{background:white;z-index:20}.app-select-option{display:block;height:48px}</style><div id="root"></div>')
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: browserComponentSource() })
  await page.addScriptTag({ content: `
    function Harness() {
      const [value, setValue] = React.useState('two');
      return React.createElement('div', null,
        React.createElement(window.FinTrackTestAppSelect, {
          options: [{ value: 'one', label: 'Cuenta uno' }, { value: 'two', label: 'Cuenta dos' }],
          value, onChange: setValue, ariaLabel: 'Cuenta',
        }), React.createElement('output', { id: 'value' }, value));
    }
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
  ` })

  await page.getByRole('button', { name: 'Cuenta' }).click()
  const menu = page.getByRole('dialog', { name: 'Cuenta' })
  const box = await menu.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x).toBe(8)
  expect(box!.width).toBe(374)
  expect(box!.y + box!.height).toBeLessThanOrEqual(600)
  await page.getByRole('combobox', { name: 'Cuenta' }).fill('No coincide')
  await expect(page.locator('#value')).toHaveText('two')
})

test('pointer exit lasts 110 ms, rapid reopen cancels stale cleanup, keyboard exit is immediate', async ({ page }) => {
  await page.clock.install()
  await page.setContent('<div id="root" data-ft-v3=""></div>')
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: browserComponentSource() })
  await page.addScriptTag({ content: `
    function Harness() {
      const [value, setValue] = React.useState('one');
      return React.createElement(window.FinTrackTestAppSelect, {
        options: [{ value: 'one', label: 'Uno' }, { value: 'two', label: 'Dos' }],
        value, onChange: setValue, ariaLabel: 'Prueba',
      });
    }
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
  ` })

  const trigger = page.getByRole('button', { name: 'Prueba' })
  await trigger.click()
  await page.getByRole('option', { name: 'Dos' }).click()
  await expect(page.locator('.app-select-menu-exit')).toHaveCount(1)
  await expect(trigger.locator('.app-select-trigger-label-settle')).toHaveCount(1)
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await trigger.click()
  await expect(page.locator('.app-select-menu')).toHaveCount(1)
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await page.clock.runFor(120)
  await expect(trigger.locator('.app-select-trigger-label-settle')).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: 'Prueba' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Prueba' }).press('Escape')
  await expect(page.locator('.app-select-menu')).toHaveCount(0)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await trigger.click()
  await page.getByRole('option', { name: 'Uno' }).click()
  await expect(trigger.locator('.app-select-trigger-label-settle')).toHaveCount(0)
  await expect(page.locator('.app-select-menu')).toHaveCount(0)
})
