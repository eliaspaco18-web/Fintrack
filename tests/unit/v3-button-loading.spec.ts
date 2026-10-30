import { expect, test } from '@playwright/test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

const reactPath = join(process.cwd(), 'node_modules/react/umd/react.development.js')
const reactDomPath = join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js')

function buttonSource() {
  const source = readFileSync(join(process.cwd(), 'components/ui/Button.tsx'), 'utf8')
    .replace(/^'use client'\s*/, '')
    .replace(/import type \{[\s\S]*?\} from 'react'/, 'const React = window.React')
    .replace(/import Link from 'next\/link'/,
      'const Link = ({ href, children, ...rest }) => React.createElement("a", { href, ...rest }, children)')
    .replace(/export (type|interface|function) /g, '$1 ')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React },
  }).outputText
  return `${compiled}\nwindow.FinTrackButton = Button;`
}

test('V3 busy button reserves both labels, announces progress and prevents double submit', async ({ page }) => {
  await page.setContent('<div id="root" data-ft-v3="" style="margin:80px"></div>')
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: buttonSource() })
  const cssDirectory = join(process.cwd(), '.next/static/css')
  const cssName = readdirSync(cssDirectory, { recursive: true }).map(String).find(name => name.endsWith('.css') &&
    readFileSync(join(cssDirectory, name), 'utf8').includes('ft-v3-button-lock-hidden'))
  if (!cssName) throw new Error('Build V3 CSS before checking button width')
  await page.addStyleTag({ content: readFileSync(join(cssDirectory, cssName), 'utf8') })
  await page.addScriptTag({ content: `
    window.submits = 0;
    function Harness() {
      const [loading, setLoading] = React.useState(false);
      return React.createElement(window.FinTrackButton, {
        variant: 'primary', size: 'md', loading, stableLoading: true,
        loadingText: 'Guardando…', onClick: () => { window.submits += 1; setLoading(true); },
      }, 'Guardar');
    }
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
  ` })
  const button = page.getByRole('button', { name: 'Guardar', exact: true })
  await expect(button).toBeVisible()
  const idleWidth = await button.evaluate(element => element.getBoundingClientRect().width)
  await button.click()
  const busy = page.getByRole('button', { name: 'Guardando…' })
  await expect(busy).toHaveAttribute('aria-busy', 'true')
  await expect(busy).toBeDisabled()
  const busyWidth = await busy.evaluate(element => element.getBoundingClientRect().width)
  expect(busyWidth).toBe(idleWidth)
  expect(await page.evaluate(() => Reflect.get(window, 'submits'))).toBe(1)
  if (process.env.V3_CAPTURE_BUTTONS === '1') {
    await page.mouse.move(0, 0)
    await page.screenshot({ path: join(process.cwd(), 'docs/redesign-v3/implementation/stage4-button-busy-light.png') })
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
    await expect.poll(() => busy.evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(138, 209, 191)')
    await page.screenshot({ path: join(process.cwd(), 'docs/redesign-v3/implementation/stage4-button-busy-dark.png') })
  }
})
