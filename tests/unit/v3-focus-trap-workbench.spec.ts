import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

function focusTrapSource(): string {
  const source = readFileSync(join(process.cwd(), 'components/ui/accessibility.tsx'), 'utf8')
  const fragment = source.slice(source.indexOf('const FOCUSABLE ='), source.indexOf('// ─── KEYBOARD SHORTCUTS'))
    .replace('export function FocusTrap', 'function FocusTrap')
  const compiled = ts.transpileModule(`const { useEffect, useRef } = window.React;\n${fragment}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React },
  }).outputText
  return `${compiled}\nwindow.FinTrackFocusTrap = FocusTrap;`
}

test('opted-in workbench focuses its heading, keeps focus across handler rerenders and returns it on close', async ({ page }) => {
  await page.setContent('<div id="root"></div>')
  await page.addScriptTag({ path: join(process.cwd(), 'node_modules/react/umd/react.development.js') })
  await page.addScriptTag({ path: join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js') })
  await page.addScriptTag({ content: focusTrapSource() })
  await page.addScriptTag({ content: `
    function Harness() {
      const [open, setOpen] = React.useState(false);
      const [count, setCount] = React.useState(0);
      const heading = React.useRef(null);
      return React.createElement(React.Fragment, null,
        React.createElement('button', { id: 'launch', onClick: () => setOpen(true) }, 'Open'),
        open ? React.createElement(window.FinTrackFocusTrap, {
          active: true, initialFocusRef: heading, onEscape: () => setOpen(false),
        }, React.createElement('div', { role: 'dialog' },
          React.createElement('h2', { ref: heading, id: 'heading', tabIndex: -1 }, 'Record'),
          React.createElement('button', { id: 'rerender', onClick: () => setCount(count + 1) }, 'Rerender ' + count),
          React.createElement('button', { id: 'close', onClick: () => setOpen(false) }, 'Close')
        )) : null);
    }
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
  ` })

  await page.locator('#launch').click()
  await expect(page.locator('#heading')).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(page.locator('#close')).toBeFocused()
  await page.locator('#rerender').click()
  await expect(page.locator('#rerender')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('#launch')).toBeFocused()
})
