import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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
    .replace(/export const /g, 'const ')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React },
  }).outputText
  const browserScript = compiled.replace(/^"use strict";\s*Object\.defineProperty\(exports, "__esModule", \{ value: true \}\);\s*/m, '')
  return `(() => {\n${browserScript}\nwindow.FinTrackOperationPopover = OperationTypePopover; window.FinTrackOperationConfig = operationTypeToFormConfig; window.FinTrackOperationTitles = OPERATION_TITLES;\n})()`
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
      operationSelector: 'operation-selector', operationGroups: 'operation-groups',
      operationGroup: 'operation-group', operationGroupHeading: 'operation-group-heading',
      operationGroupItems: 'operation-group-items', operation: 'operation', operationIcon: 'operation-icon',
      operationIncome: 'operation-income', operationExpense: 'operation-expense',
      operationTransfer: 'operation-transfer', operationAsset: 'operation-asset',
    };
  ` })
  await page.addStyleTag({ path: join(process.cwd(), 'docs/redesign-v3/preview/design.css') })
  await page.addStyleTag({ content: `
    .operation-popover { position:fixed; inset:auto; margin:0; box-sizing:border-box; border:1px solid #dce1e5; border-radius:14px; padding:11px; width:min(460px,calc(100vw - 24px)); min-width:min(360px,calc(100vw - 24px)); max-width:calc(100vw - 24px); max-height:min(560px,calc(100dvh - 24px)); overflow:auto; font-family:Manrope,sans-serif; font-size:12px; line-height:1.5; color:#242a30; background:#fff; box-shadow:0 3px 8px rgb(25 51 49 / 7%),0 16px 44px rgb(25 51 49 / 13%); }
    .operation-popover-heading { padding:1px 2px 9px; border-bottom:1px solid #dce1e5; margin:0 0 11px; font-size:11px; font-weight:700; }
    .operation-groups { display:grid; grid-template-columns:minmax(0,1fr); gap:8px; }
    .operation-group { min-width:0; }
    .operation-group:not(:last-child) { padding-bottom:8px; border-bottom:1px solid #dce1e5; }
    .operation-group-heading { margin:0 0 5px; font-size:11.5px; font-weight:700; line-height:16px; }
    .operation-group-items { display:grid; gap:4px; min-width:0; }
    .operation { display:flex; align-items:center; gap:9px; width:100%; min-width:0; min-height:50px; border:1px solid #dce1e5; border-radius:10px; background:#fff; padding:6px 9px; text-align:left; }
    .operation-icon { display:grid; width:30px; height:30px; flex:0 0 30px; place-items:center; border-radius:9px; }
    .operation > span:last-child { min-width:0; }
    .operation strong, .operation small { display:block; }
    .operation strong { font-size:12.5px; line-height:17px; }
    .operation small { margin-top:2px; font-size:11.5px; line-height:16px; overflow-wrap:anywhere; }
    @media (max-width:767px) { .operation-groups { gap:7px; } .operation { padding:7px 9px; } }
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

test('operation menu groups all eight operation handlers by cash flow and preserves their mappings', async ({ page }) => {
  await mount(page)
  const trigger = page.getByRole('button', { name: 'Nuevo movimiento' })
  const operations = [
    ['Ingreso', 'income', { type: 'INCOME' }],
    ['Egreso', 'expense', { type: 'EXPENSE' }],
    ['Transferencia', 'transfer', { type: 'TRANSFER' }],
    ['Prestar dinero', 'receivable_issue', { type: 'EXPENSE', creates_receivable: true }],
    ['Registrar cobro', 'receivable_collect', { type: 'INCOME', creates_receivable: false }],
    ['Recibir préstamo', 'payable_issue', { type: 'INCOME', creates_payable: true }],
    ['Registrar pago', 'payable_pay', { type: 'EXPENSE', creates_payable: false }],
    ['Comprar activo', 'asset_purchase', { type: 'EXPENSE', creates_asset: true }],
  ] as const

  await trigger.click()
  const menu = page.getByRole('menu', { name: 'Registrar una operación' })
  await expect(menu).toBeVisible()
  const items = menu.getByRole('menuitem')
  await expect(items).toHaveCount(8)
  await expect(items).toHaveText([
    'IngresoDinero que recibes.',
    'Registrar cobroCobras dinero que te debían.',
    'Recibir préstamoRecibes dinero que luego devolverás.',
    'EgresoDinero que gastas.',
    'Prestar dineroDas dinero que te devolverán.',
    'Registrar pagoPagas una deuda pendiente.',
    'Comprar activoCompras un bien para conservarlo.',
    'TransferenciaMueves dinero entre tus cuentas o tarjetas.',
  ])
  await expect(menu.getByRole('group', { name: 'Dinero que entra' }).getByRole('menuitem')).toHaveCount(3)
  await expect(menu.getByRole('group', { name: 'Dinero que sale' }).getByRole('menuitem')).toHaveCount(4)
  await expect(menu.getByRole('group', { name: 'Entre tus cuentas' }).getByRole('menuitem')).toHaveCount(1)
  const anchorBox = await trigger.boundingBox()
  const menuBox = await menu.boundingBox()
  expect(anchorBox).not.toBeNull()
  expect(menuBox).not.toBeNull()
  expect(Math.abs(menuBox!.x + menuBox!.width - (anchorBox!.x + anchorBox!.width))).toBeLessThan(3)
  expect(Math.abs(menuBox!.y - (anchorBox!.y + anchorBox!.height + 8))).toBeLessThan(1)
  expect(menuBox!.x).toBeGreaterThanOrEqual(12)
  expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(1268)
  expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(788)

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

test('operation popover stays anchored and the selector adapts to narrow viewports', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await mount(page)
  const integratedTrigger = page.getByRole('button', { name: 'Nuevo movimiento' })
  await integratedTrigger.click()
  const integratedMenu = page.getByRole('menu', { name: 'Registrar una operación' })
  const integratedBox = await integratedMenu.boundingBox()
  expect(integratedBox).not.toBeNull()
  const triggerBox = await integratedTrigger.boundingBox()
  expect(triggerBox).not.toBeNull()
  expect(Math.abs(integratedBox!.x + integratedBox!.width - (triggerBox!.x + triggerBox!.width))).toBeLessThan(3)
  expect(integratedBox!.width).toBeGreaterThanOrEqual(360)
  expect(integratedBox!.width).toBeLessThanOrEqual(460)
  const desktopColumns = await integratedMenu.locator('.operation-groups').evaluate(element => getComputedStyle(element).gridTemplateColumns)
  expect(desktopColumns.split(' ').length).toBe(1)
  expect(await integratedMenu.locator('.operation strong').first().evaluate(element => getComputedStyle(element).fontSize)).toBe('12.5px')
  expect(await integratedMenu.locator('.operation small').first().evaluate(element => getComputedStyle(element).fontSize)).toBe('11.5px')
  expect(await integratedMenu.evaluate(element => getComputedStyle(element).overflowY)).toBe('auto')
  expect(await integratedMenu.evaluate(element => Number.parseFloat(getComputedStyle(element).maxHeight))).toBeLessThanOrEqual(560)
  const desktopTextOverflow = await integratedMenu.locator('.operation').evaluateAll(elements =>
    elements.some(element => element.scrollWidth > element.clientWidth),
  )
  expect(desktopTextOverflow).toBe(false)

  await page.setViewportSize({ width: 390, height: 844 })
  await integratedTrigger.evaluate(element => { (element as HTMLButtonElement).style.marginLeft = '0' })
  await integratedTrigger.click()
  await expect(integratedMenu).toBeVisible()
  const mobileColumns = await integratedMenu.locator('.operation-groups').evaluate(element => getComputedStyle(element).gridTemplateColumns)
  expect(mobileColumns.split(' ').length).toBe(1)
  expect(await integratedMenu.locator('.operation strong').first().evaluate(element => getComputedStyle(element).fontSize)).toBe('12.5px')
  expect(await integratedMenu.locator('.operation small').first().evaluate(element => getComputedStyle(element).fontSize)).toBe('11.5px')
  const mobileBox = await integratedMenu.boundingBox()
  expect(mobileBox).not.toBeNull()
  expect(mobileBox!.x).toBeGreaterThanOrEqual(0)
  expect(mobileBox!.x + mobileBox!.width).toBeLessThanOrEqual(390)

  const outputDir = process.env.OPERATION_MENU_COMPARISON_DIR
  if (outputDir) {
    await integratedMenu.screenshot({ path: join(outputDir, 'fintrack-operation-menu.png'), animations: 'disabled' })
  }
})

test('operation labels and creation modal titles share one exact title map', async ({ page }) => {
  await mount(page)
  await page.getByRole('button', { name: 'Nuevo movimiento' }).click()
  const items = page.getByRole('menu', { name: 'Registrar una operación' }).getByRole('menuitem')
  await expect(items).toHaveText([
    'IngresoDinero que recibes.',
    'Registrar cobroCobras dinero que te debían.',
    'Recibir préstamoRecibes dinero que luego devolverás.',
    'EgresoDinero que gastas.',
    'Prestar dineroDas dinero que te devolverán.',
    'Registrar pagoPagas una deuda pendiente.',
    'Comprar activoCompras un bien para conservarlo.',
    'TransferenciaMueves dinero entre tus cuentas o tarjetas.',
  ])
  const titles = await page.evaluate(() => (window as Window & {
    FinTrackOperationTitles: Record<string, string>
  }).FinTrackOperationTitles)
  expect(titles).toEqual({
    income: 'Ingreso',
    expense: 'Egreso',
    receivable_collect: 'Registrar cobro',
    payable_issue: 'Recibir préstamo',
    receivable_issue: 'Prestar dinero',
    payable_pay: 'Registrar pago',
    asset_purchase: 'Comprar activo',
    transfer: 'Transferencia',
  })
  const workspaceSource = readFileSync(join(process.cwd(), 'components/transactions/TransactionsWorkspace.tsx'), 'utf8')
  expect(workspaceSource).not.toContain('ASTRA_FORM_TITLES')
  expect(workspaceSource).toContain('OPERATION_TITLES[selectedOperationType]')
})

declare global {
  interface Window {
    FinTrackOperationConfig: (type: string) => Record<string, unknown>
    FinTrackOperationTitles: Record<string, string>
    selectedOperationTypes: string[]
  }
}
