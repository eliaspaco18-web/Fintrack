import { expect, test } from '@playwright/test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

const reactPath = join(process.cwd(), 'node_modules/react/umd/react.development.js')
const reactDomPath = join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js')

function tabsSource() {
  const source = readFileSync(join(process.cwd(), 'components/ui/V3Tabs.tsx'), 'utf8')
    .replace(/^'use client'\s*/, '')
    .replace(/import \{[\s\S]*?\} from 'react'/,
      'const React = window.React; const { useId, useRef } = React')
    .replace(/export interface /g, 'interface ')
    .replace(/export function /g, 'function ')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React },
  }).outputText
  return `${compiled}\nwindow.FinTrackTabs = V3Tabs;`
}

test('tabs keep exact panel linkage and keyboard/disabled behavior without route changes', async ({ page }) => {
  await page.setContent('<div id="root" data-ft-v3=""></div>')
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: tabsSource() })
  await page.addScriptTag({ content: `
    function Harness() {
      const [value, setValue] = React.useState('detail');
      return React.createElement('div', null,
        React.createElement(window.FinTrackTabs, {
          ariaLabel: 'Vista del registro', value, onChange: setValue,
          tabs: [
            { id: 'detail', label: 'Detalle', panelId: 'detail-panel' },
            { id: 'disabled', label: 'No disponible', panelId: 'disabled-panel', disabled: true },
            { id: 'context', label: 'Contexto', panelId: 'context-panel' },
          ],
        }),
        React.createElement('div', { id: 'detail-panel', role: 'tabpanel', hidden: value !== 'detail' }, 'Datos'),
        React.createElement('div', { id: 'context-panel', role: 'tabpanel', hidden: value !== 'context' }, 'Contexto real'),
        React.createElement('output', { id: 'selected-tab' }, value));
    }
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
  ` })

  const detail = page.getByRole('tab', { name: 'Detalle' })
  const context = page.getByRole('tab', { name: 'Contexto' })
  await expect(detail).toHaveAttribute('aria-controls', 'detail-panel')
  await expect(detail).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tab', { name: 'No disponible' })).toBeDisabled()
  await detail.focus()
  await detail.press('ArrowRight')
  await expect(context).toBeFocused()
  await expect(context).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('#context-panel')).toBeVisible()
  await context.press('Home')
  await expect(detail).toBeFocused()
  await expect(detail).toHaveAttribute('aria-selected', 'true')
  await detail.press('End')
  await expect(context).toBeFocused()
  await context.press('Tab')
  await expect(page.locator('#selected-tab')).toHaveText('context')
})

test('tabs use V3 material in both themes and 44 px mobile touch targets', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 })
  await page.setContent('<div id="root" data-ft-v3="" style="margin:80px 16px;width:358px"></div>')
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: tabsSource() })
  const cssDirectory = join(process.cwd(), '.next/static/css')
  const cssName = readdirSync(cssDirectory, { recursive: true }).map(String).find(name => name.endsWith('.css') &&
    readFileSync(join(cssDirectory, name), 'utf8').includes('ft-v3-tab[aria-selected'))
  if (!cssName) throw new Error('Build V3 CSS before checking tabs')
  await page.addStyleTag({ content: readFileSync(join(cssDirectory, cssName), 'utf8') })
  await page.addScriptTag({ content: `
    ReactDOM.createRoot(document.getElementById('root')).render(
      React.createElement(window.FinTrackTabs, {
        ariaLabel: 'Registro', value: 'detail', onChange: () => {},
        tabs: [
          { id: 'detail', label: 'Detalle', panelId: 'detail-panel' },
          { id: 'context', label: 'Contexto financiero', panelId: 'context-panel' },
        ],
      }));
  ` })
  const selected = page.getByRole('tab', { name: 'Detalle' })
  await expect(selected).toBeVisible()
  expect(await selected.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)
  await expect.poll(() => selected.evaluate(element => getComputedStyle(element, '::after').backgroundColor)).toBe('rgb(21, 94, 89)')
  if (process.env.V3_CAPTURE_TABS === '1') {
    await page.screenshot({ path: join(process.cwd(), 'docs/redesign-v3/implementation/stage4-tabs-light-390.png') })
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
    await expect.poll(() => selected.evaluate(element => getComputedStyle(element, '::after').backgroundColor)).toBe('rgb(138, 209, 191)')
    await page.waitForTimeout(250)
    await page.screenshot({ path: join(process.cwd(), 'docs/redesign-v3/implementation/stage4-tabs-dark-390.png') })
  }
})
