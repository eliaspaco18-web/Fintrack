import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

function compileNavigation(): string {
  const source = readFileSync(join(process.cwd(), 'components/layout/Sidebar.tsx'), 'utf8')
    .replace(/^import[\s\S]*?from ['"][^'"]+['"]\s*$/gm, '')
    .replace(/export function /g, 'function ')
  return ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React },
  }).outputText + '\nwindow.SidebarNavigation = SidebarNavigation;'
}

test('rail tooltip respects pointer dwell, fast target change, focus and scroll dismissal', async ({ page }) => {
  await page.setContent('<div id="root"></div>')
  await page.addScriptTag({ path: join(process.cwd(), 'node_modules/react/umd/react.development.js') })
  await page.addScriptTag({ path: join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js') })
  await page.addScriptTag({ content: `
    const { useState, useRef, useEffect, useLayoutEffect } = React;
    const createPortal = ReactDOM.createPortal;
    const NAV_ITEMS = [
      { key: 'dashboard', label: 'Inicio', href: '/dashboard' },
      { key: 'transactions', label: 'Movimientos', href: '/transactions' },
    ];
    const NAV_GROUPS = [{ label: 'Tu día a día', keys: ['dashboard', 'transactions'] }];
    function NavItem({ item, onRailTooltipEnter, onRailTooltipLeave }) {
      return React.createElement('a', { href: '#',
        onPointerEnter: event => onRailTooltipEnter(event.currentTarget, item.label, false),
        onPointerLeave: onRailTooltipLeave,
        onFocus: event => onRailTooltipEnter(event.currentTarget, item.label, true),
        onBlur: onRailTooltipLeave,
      }, item.label);
    }
  ` })
  await page.addScriptTag({ content: compileNavigation() })
  await page.addScriptTag({ content: `
    ReactDOM.createRoot(document.getElementById('root')).render(
      React.createElement(window.SidebarNavigation, { mode: 'collapsed', badges: {} })
    );
  ` })

  await page.getByRole('link', { name: 'Inicio' }).hover()
  await page.waitForTimeout(120)
  await expect(page.locator('.ft-rail-tooltip')).toHaveCount(0)
  await expect(page.locator('.ft-rail-tooltip')).toHaveText('Inicio')
  await page.getByRole('link', { name: 'Movimientos' }).hover()
  await expect(page.locator('.ft-rail-tooltip')).toHaveText('Movimientos', { timeout: 200 })
  await page.locator('nav').evaluate(element => element.dispatchEvent(new Event('scroll')))
  await expect(page.locator('.ft-rail-tooltip')).toHaveCount(0)
  await page.getByRole('link', { name: 'Inicio' }).focus()
  await expect(page.locator('.ft-rail-tooltip')).toHaveText('Inicio', { timeout: 200 })
})
