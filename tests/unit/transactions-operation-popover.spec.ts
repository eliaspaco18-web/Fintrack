import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import * as ts from 'typescript'

const reactPath = join(process.cwd(), 'node_modules/react/umd/react.development.js')
const reactDomPath = join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js')

function operationSource(): string {
  const source = readFileSync(join(process.cwd(), 'components/transactions/OperationTypeSelector.tsx'), 'utf8')
    .replace(/^'use client'\s*/, '')
    .replace(/import React, \{([^}]*)\} from 'react'/, (_match, hooks: string) =>
      `const React = window.React; const {${hooks}} = React`)
    .replace(/import styles from '@\/components\/tables\/TransactionsRound07.module.css'/, 'const styles = window.operationStyles')
    .replace(/export function /g, 'function ')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React },
  }).outputText
  const browserScript = compiled.replace(/^"use strict";\s*Object\.defineProperty\(exports, "__esModule", \{ value: true \}\);\s*/m, '')
  return `(() => {\n${browserScript}\nwindow.FinTrackOperationPopover = OperationTypePopover; window.FinTrackOperationConfig = operationTypeToFormConfig;\n})()`
}

async function mount(page: import('@playwright/test').Page) {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.setContent('<div id="root"></div>')
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: `
    window.operationStyles = {
      operationPopover: 'operation-popover', operationPopoverHeading: 'operation-popover-heading',
      operationMenuItem: 'operation-menu-item', operationSelector: 'operation-selector',
      operationGrid: 'operation-grid', operation: 'operation',
    };
  ` })
  await page.addStyleTag({ path: join(process.cwd(), 'docs/redesign-v3/preview/design.css') })
  await page.addStyleTag({ content: `
    .operation-popover { position:fixed; inset:auto; margin:0; border:1px solid #dce1e5; border-radius:14px; padding:7px; min-width:220px; max-width:calc(100vw - 24px); max-height:min(460px,calc(100dvh - 32px)); overflow:auto; font-family:Manrope,sans-serif; font-size:12px; line-height:1.5; color:#242a30; background:#fff; box-shadow:0 3px 8px rgb(25 51 49 / 7%),0 16px 44px rgb(25 51 49 / 13%); }
    .operation-popover-heading { padding:9px 9px 11px; border-bottom:1px solid #dce1e5; margin-bottom:5px; font-size:11px; font-weight:600; }
    .operation-menu-item { display:flex; align-items:center; gap:10px; width:100%; min-height:38px; border:0; border-radius:8px; background:transparent; padding:10px; font:inherit; text-align:left; }
    .operation-menu-item > span { flex:1; }
    .operation-menu-item small { display:block; margin-top:2px; font-size:10px; line-height:16px; }
  ` })
  await page.addScriptTag({ content: operationSource() })
  await page.addScriptTag({ content: `
    window.selectedOperationTypes = [];
    const React = window.React;
    const ReactDOM = window.ReactDOM;
    function Harness() {
      const [open, setOpen] = React.useState(false);
      const [formType, setFormType] = React.useState(null);
      const anchorRef = React.useRef(null);
      const select = type => { window.selectedOperationTypes.push(type); setFormType(type); setOpen(false); };
      return React.createElement(React.Fragment, null,
        React.createElement('button', { id: 'new', ref: anchorRef, style: { marginLeft: '1000px', marginTop: '80px' }, onClick: () => { setFormType(null); setOpen(value => !value); } }, 'Nuevo movimiento'),
        React.createElement(window.FinTrackOperationPopover, {
          anchorRef, menuId: 'operation-menu', open, onClose: () => setOpen(false), onSelect: select,
        }),
        React.createElement('button', { id: 'after' }, 'After'),
        formType ? React.createElement('div', { role: 'dialog', 'data-testid': 'real-operation-flow', 'data-operation': formType }, formType) : null
      );
    }
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
  ` })
  try {
    await page.getByRole('button', { name: 'Nuevo movimiento' }).waitFor({ timeout: 3000 })
  } catch {
    throw new Error(`Operation popover harness did not mount: ${pageErrors.join(' | ') || 'no browser exception captured'}`)
  }
}

test('Astra operation menu is an anchored vertical popover and preserves all eight operation handlers', async ({ page }) => {
  await mount(page)
  const trigger = page.getByRole('button', { name: 'Nuevo movimiento' })
  const operations = [
    ['Ingreso', 'income', { type: 'INCOME' }],
    ['Egreso', 'expense', { type: 'EXPENSE' }],
    ['Transferencia interna', 'transfer', { type: 'TRANSFER' }],
    ['Prestar dinero', 'receivable_issue', { type: 'EXPENSE', creates_receivable: true }],
    ['Registrar cobro', 'receivable_collect', { type: 'INCOME', creates_receivable: false }],
    ['Dinero recibido a devolver', 'payable_issue', { type: 'INCOME', creates_payable: true }],
    ['Registrar pago', 'payable_pay', { type: 'EXPENSE', creates_payable: false }],
    ['Comprar un activo', 'asset_purchase', { type: 'EXPENSE', creates_asset: true }],
  ] as const

  await trigger.click()
  const menu = page.getByRole('menu', { name: 'Registrar una operación' })
  await expect(menu).toBeVisible()
  const items = menu.getByRole('menuitem')
  await expect(items).toHaveCount(8)
  await expect(items).toHaveText([
    'IngresoDinero que recibes',
    'EgresoDinero que sale',
    'Transferencia internaEntre tus propias cuentas',
    'Prestar dinero',
    'Registrar cobro',
    'Dinero recibido a devolver',
    'Registrar pago',
    'Comprar un activo',
  ])
  const anchorBox = await trigger.boundingBox()
  const menuBox = await menu.boundingBox()
  expect(anchorBox).not.toBeNull()
  expect(menuBox).not.toBeNull()
  expect(Math.abs(menuBox!.x + menuBox!.width - (anchorBox!.x + anchorBox!.width))).toBeLessThan(3)
  expect(Math.abs(menuBox!.y - (anchorBox!.y + anchorBox!.height + 8))).toBeLessThan(1)

  for (const [label, operationType, expectedConfig] of operations) {
    if (!(await menu.isVisible())) await trigger.click()
    await menu.getByRole('menuitem', { name: new RegExp(`^${label}`) }).click()
    await expect(page.getByTestId('real-operation-flow')).toHaveAttribute('data-operation', operationType)
    expect(await page.evaluate((type: string) => window.FinTrackOperationConfig(type), operationType)).toEqual(expectedConfig)
  }
  expect(await page.evaluate(() => window.selectedOperationTypes)).toEqual(operations.map(([, type]) => type))
})

test('operation popover opens for keyboard, supports roving arrows, Escape restores trigger focus, and outside click dismisses', async ({ page }) => {
  await mount(page)
  const trigger = page.getByRole('button', { name: 'Nuevo movimiento' })
  await trigger.focus()
  await trigger.press('Enter')
  const menu = page.getByRole('menu', { name: 'Registrar una operación' })
  await expect(menu.getByRole('menuitem').first()).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(menu.getByRole('menuitem').nth(1)).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await trigger.click()
  await page.getByRole('button', { name: 'After' }).click()
  await expect(menu).toHaveCount(0)
})

test('Astra reference and React menu expose the same eight ordered options at the same viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(pathToFileURL(join(process.cwd(), 'docs/redesign-v3/preview/index.html')).href)
  const referenceTrigger = page.locator('#main button[data-action="create"]').first()
  await referenceTrigger.waitFor()
  await referenceTrigger.click()
  const referenceMenu = page.locator('.context-popover[role="menu"]')
  await expect(referenceMenu).toBeVisible()
  const expected = [
    'IngresoDinero que recibes',
    'EgresoDinero que sale',
    'Transferencia internaEntre tus propias cuentas',
    'Prestar dinero',
    'Registrar cobro',
    'Dinero recibido a devolver',
    'Registrar pago',
    'Comprar un activo',
  ]
  await expect(referenceMenu.getByRole('menuitem')).toHaveText(expected)
  const referenceBox = await referenceMenu.boundingBox()
  const outputDir = process.env.OPERATION_MENU_COMPARISON_DIR
  if (outputDir) {
    await referenceMenu.screenshot({ path: join(outputDir, 'astra-operation-menu.png'), animations: 'disabled' })
  }

  await mount(page)
  const integratedTrigger = page.getByRole('button', { name: 'Nuevo movimiento' })
  await integratedTrigger.evaluate(element => {
    ;(element as HTMLButtonElement).style.marginLeft = '1000px'
    ;(element as HTMLButtonElement).style.marginTop = '80px'
  })
  await integratedTrigger.click()
  const integratedMenu = page.getByRole('menu', { name: 'Registrar una operación' })
  await expect(integratedMenu.getByRole('menuitem')).toHaveText(expected)
  const integratedBox = await integratedMenu.boundingBox()
  expect(referenceBox).not.toBeNull()
  expect(integratedBox).not.toBeNull()
  expect(Math.abs(referenceBox!.width - integratedBox!.width)).toBeLessThan(2)
  expect(Math.abs(referenceBox!.height - integratedBox!.height)).toBeLessThan(2)
  if (outputDir) {
    await integratedMenu.screenshot({ path: join(outputDir, 'fintrack-operation-menu.png'), animations: 'disabled' })
  }
})

declare global {
  interface Window {
    FinTrackOperationConfig: (type: string) => Record<string, unknown>
    selectedOperationTypes: string[]
  }
}
