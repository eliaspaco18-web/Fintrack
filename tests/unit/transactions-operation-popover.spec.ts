import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'
import postcss from 'postcss'

const reactPath = join(process.cwd(), 'node_modules/react/umd/react.development.js')
const reactDomPath = join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js')

function operationSource(): string {
  const source = readFileSync(join(process.cwd(), 'components/transactions/OperationTypeSelector.tsx'), 'utf8')
    .replace(/^'use client'\s*/, '')
    .replace(/import React, \{([^}]*)\} from 'react'/, (_match, hooks: string) =>
      `const React = window.React; const {${hooks}} = React`)
    .replace(/import \{ OperationTypeIcon, type OperationType \} from '@\/components\/transactions\/OperationTypeIcon'/, 'const OperationTypeIcon = window.FinTrackOperationIcon')
    .replace(/import styles from '@\/components\/tables\/TransactionsRound07.module.css'/, 'const styles = window.operationStyles')
    .replace(/export function /g, 'function ')
    .replace(/export const /g, 'const ')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React },
  }).outputText
  const browserScript = compiled.replace(/^"use strict";\s*Object\.defineProperty\(exports, "__esModule", \{ value: true \}\);\s*/m, '')
  return `(() => {\n${browserScript}\nwindow.FinTrackOperationPopover = OperationTypePopover; window.FinTrackOperationConfig = operationTypeToFormConfig; window.FinTrackOperationTitles = OPERATION_TITLES;\n})()`
}

function operationIconSource(): string {
  const source = readFileSync(join(process.cwd(), 'components/transactions/OperationTypeIcon.tsx'), 'utf8')
    .replace(/import React from 'react'/, 'const React = window.React')
    .replace(/import \{ CategoryKeys \} from '@\/lib\/constants\/category-keys'/, 'const CategoryKeys = window.FinTrackCategoryKeys')
    .replace(/export function /g, 'function ')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React },
  }).outputText
  const browserScript = compiled.replace(/^"use strict";\s*Object\.defineProperty\(exports, "__esModule", \{ value: true \}\);\s*/m, '')
  return `(() => {\n${browserScript}\nwindow.FinTrackOperationIcon = OperationTypeIcon; window.FinTrackResolveTransactionIconType = resolveTransactionOperationIconType;\n})()`
}

function operationCssSource(): string {
  const source = postcss.parse(readFileSync(join(process.cwd(), 'components/tables/TransactionsRound07.module.css'), 'utf8'))
  const output = postcss.root()
  const classes = ['operationPopover', 'operationPopoverHeading', 'operationSelector', 'operationGroups', 'operationGroup', 'operationGroupHeading', 'operationGroupItems', 'operation', 'operationIcon', 'operationIncome', 'operationExpense', 'operationTransfer', 'operationAsset']
  source.walkRules(rule => {
    if (!classes.some(name => rule.selector.includes(`.${name}`))) return
    const copy = rule.clone({ selector: rule.selector
      .replace(/:global\(([^)]+)\)/g, '$1')
      .replace(/\.([A-Za-z][A-Za-z0-9]*)/g, (match, name: string) => classes.includes(name) ? `.${name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}` : match) })
    let node: postcss.Node = copy
    let parent = rule.parent
    while (parent && parent.type === 'atrule') {
      node = parent.clone({ nodes: [node] })
      parent = parent.parent
    }
    output.append(node)
  })
  return `:root { --ft-surface: #fff; --ft-text-strong: #242a30; --ft-text-muted: #59636d; --ft-border: #dce1e5; --ft-success: #2b7356; --ft-success-soft: #e8f2e9; --ft-danger: #ad4545; --ft-danger-soft: #f9eeee; --ft-info: #426f9f; --ft-info-soft: #ebf2fb; } html[data-theme='dark'] { --ft-surface: #202327; --ft-text-strong: #edf0f2; --ft-text-muted: #b7bfc5; --ft-border: #393f45; } ${output.toString()}`
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
    window.FinTrackCategoryKeys = {
      INCOME_RECEIVABLE_COLLECTION: 'income_receivable_collection',
      INCOME_PAYABLE_ISSUE: 'income_payable_issue',
      EXPENSE_PAYABLE_PAYMENT: 'expense_payable_payment',
      EXPENSE_ASSET: 'expense_asset',
      EXPENSE_RECEIVABLE_ISSUE: 'expense_receivable_issue',
    };
    window.operationStyles = {
      operationPopover: 'operation-popover', operationPopoverHeading: 'operation-popover-heading',
      operationSelector: 'operation-selector', operationGroups: 'operation-groups',
      operationGroup: 'operation-group', operationGroupHeading: 'operation-group-heading',
      operationGroupItems: 'operation-group-items', operation: 'operation', operationIcon: 'operation-icon',
      operationIncome: 'operation-income', operationExpense: 'operation-expense',
      operationTransfer: 'operation-transfer', operationAsset: 'operation-asset',
    };
  ` })
  await page.addStyleTag({ content: operationCssSource() })
  await page.addScriptTag({ content: operationIconSource() })
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
  expect(await items.locator('svg').evaluateAll(elements => elements.map(element => element.getAttribute('data-operation-icon')))).toEqual([
    'income', 'receivable_collect', 'payable_issue', 'expense', 'receivable_issue', 'payable_pay', 'asset_purchase', 'transfer',
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

test('one intent opens the operation popover once despite URL-backed callback identity changes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.setContent('<div id="root"></div>')
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: `
    window.FinTrackCategoryKeys = {
      INCOME_RECEIVABLE_COLLECTION: 'income_receivable_collection', INCOME_PAYABLE_ISSUE: 'income_payable_issue',
      EXPENSE_PAYABLE_PAYMENT: 'expense_payable_payment', EXPENSE_ASSET: 'expense_asset',
      EXPENSE_RECEIVABLE_ISSUE: 'expense_receivable_issue',
    };
    window.operationStyles = {
      operationPopover: 'operation-popover', operationPopoverHeading: 'operation-popover-heading',
      operationSelector: 'operation-selector', operationGroups: 'operation-groups', operationGroup: 'operation-group',
      operationGroupHeading: 'operation-group-heading', operationGroupItems: 'operation-group-items',
      operation: 'operation', operationIcon: 'operation-icon', operationIncome: 'operation-income',
      operationExpense: 'operation-expense', operationTransfer: 'operation-transfer', operationAsset: 'operation-asset',
    };
    window.popoverMetrics = { show: 0, hide: 0, animate: 0, visibleFrames: 0 };
    const show = HTMLElement.prototype.showPopover;
    const hide = HTMLElement.prototype.hidePopover;
    HTMLElement.prototype.showPopover = function () { window.popoverMetrics.show += 1; return show.call(this); };
    HTMLElement.prototype.hidePopover = function () { window.popoverMetrics.hide += 1; return hide.call(this); };
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) { window.popoverMetrics.animate += 1; return animate.apply(this, args); };
  ` })
  await page.addScriptTag({ content: operationIconSource() })
  await page.addScriptTag({ content: operationSource() })
  await page.addScriptTag({ content: `
    function Harness() {
      const [open, setOpen] = React.useState(false);
      const [urlRevision, setUrlRevision] = React.useState(0);
      const anchorRef = React.useRef(null);
      React.useEffect(() => {
        if (!open) return;
        queueMicrotask(() => setUrlRevision(value => value + 1));
      }, [open]);
      const onClose = React.useCallback(() => setOpen(false), [urlRevision]);
      return React.createElement(React.Fragment, null,
        React.createElement('button', { id: 'new', ref: anchorRef, onClick: () => setOpen(true) }, 'Nuevo movimiento'),
        React.createElement(window.FinTrackOperationPopover, {
          anchorRef, menuId: 'operation-menu', open, onClose, onSelect: () => setOpen(false),
        }));
    }
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
  ` })
  const menu = page.getByRole('menu', { name: 'Registrar una operación' })
  const trigger = page.getByRole('button', { name: 'Nuevo movimiento' })
  for (let cycle = 1; cycle <= 5; cycle += 1) {
    await trigger.click()
    await expect(menu).toBeVisible()
    await expect.poll(() => page.evaluate(() => window.popoverMetrics.show)).toBe(cycle)
    await expect.poll(() => page.evaluate(() => window.popoverMetrics.animate)).toBe(cycle)
    if (cycle < 5) {
      await menu.getByRole('menuitem').first().focus()
      await page.keyboard.press('Escape')
      await expect(menu).toBeHidden()
      await expect.poll(() => page.evaluate(() => window.popoverMetrics.hide)).toBe(cycle)
    }
  }
  await menu.getByRole('menuitem').first().focus()
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  const metrics = await page.evaluate(() => ({ ...window.popoverMetrics }))
  console.log('URL callback refresh popover metrics after fix:', JSON.stringify(metrics))
  expect(metrics).toMatchObject({ show: 5, hide: 5, animate: 5 })
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
  expect(integratedBox!.width).toBeGreaterThanOrEqual(320)
  expect(integratedBox!.width).toBeLessThanOrEqual(356)
  expect(await integratedMenu.evaluate(element => element.scrollHeight)).toBe(await integratedMenu.evaluate(element => element.clientHeight))
  const desktopColumns = await integratedMenu.locator('.operation-groups').evaluate(element => getComputedStyle(element).gridTemplateColumns)
  expect(desktopColumns.split(' ').length).toBe(1)
  expect(await integratedMenu.locator('.operation strong').first().evaluate(element => getComputedStyle(element).fontSize)).toBe('12.5px')
  expect(await integratedMenu.locator('.operation small').first().evaluate(element => getComputedStyle(element).fontSize)).toBe('11.5px')
  expect(await integratedMenu.evaluate(element => getComputedStyle(element).overflowY)).toBe('auto')
  expect(await integratedMenu.evaluate(element => Number.parseFloat(getComputedStyle(element).maxHeight))).toBeLessThanOrEqual(776)
  expect(await integratedMenu.locator('.operation').first().evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(54)
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
  expect(await integratedMenu.evaluate(element => element.scrollHeight)).toBe(await integratedMenu.evaluate(element => element.clientHeight))

  await page.setViewportSize({ width: 390, height: 480 })
  await expect(integratedMenu).toBeHidden()
  await integratedTrigger.click()
  await expect(integratedMenu).toBeVisible()
  expect(await integratedMenu.evaluate(element => element.scrollHeight)).toBeGreaterThan(await integratedMenu.evaluate(element => element.clientHeight))
  const compactViewportBox = await integratedMenu.boundingBox()
  expect(compactViewportBox).not.toBeNull()
  expect(compactViewportBox!.y).toBeGreaterThanOrEqual(0)
  expect(compactViewportBox!.y + compactViewportBox!.height).toBeLessThanOrEqual(480)

  await page.setViewportSize({ width: 390, height: 844 })
  await integratedTrigger.click()
  await expect(integratedMenu).toBeVisible()
  const outputDir = process.env.OPERATION_MENU_COMPARISON_DIR
  if (outputDir) {
    await integratedMenu.screenshot({ path: join(outputDir, 'fintrack-operation-menu.png'), animations: 'disabled' })
  }
})

test('transaction rows classify operations from the paginated API persisted-field shape', async ({ page }) => {
  await mount(page)
  const resolvedTypes = await page.evaluate(() => {
    const resolve = (window as Window & {
      FinTrackResolveTransactionIconType: (transaction: Record<string, unknown>) => string
    }).FinTrackResolveTransactionIconType
    // These are representative rows from GET /api/transactions after
    // normalizeTransactionRow: raw persisted columns and PostgREST relations
    // survive its `...row` spread, while account/date aliases are added.
    const apiRows = [
      { type: 'INCOME', sub_type: null, category: { system_key: 'income_salary' }, description: 'ordinary' },
      { type: 'INCOME', sub_type: null, category: { system_key: 'income_receivable_collection' }, description: 'ordinary' },
      { type: 'INCOME', sub_type: null, category: { system_key: 'income_payable_issue' }, linked_payable: [{ id: 'payable-1' }], description: 'ordinary' },
      { type: 'EXPENSE', sub_type: null, category: { system_key: 'expense_food' }, description: 'ordinary' },
      { type: 'EXPENSE', sub_type: null, category: { system_key: 'expense_receivable_issue' }, linked_receivable: [{ id: 'receivable-1' }], description: 'ordinary' },
      { type: 'EXPENSE', sub_type: 'PAYABLE_PAYMENT', category: { system_key: 'expense_payable_payment' }, description: 'ordinary' },
      { type: 'EXPENSE', sub_type: 'ASSET_PURCHASE', category: { system_key: 'expense_asset' }, linked_asset: { id: 'asset-1' }, description: 'ordinary' },
      { type: 'TRANSFER', sub_type: null, category: null, description: 'ordinary' },
    ]
    return apiRows.map(resolve)
  })
  expect(resolvedTypes).toEqual([
    'income', 'receivable_collect', 'payable_issue', 'expense',
    'receivable_issue', 'payable_pay', 'asset_purchase', 'transfer',
  ])

  const collectionAndPaymentTypes = await page.evaluate(() => {
    const resolve = (window as Window & {
      FinTrackResolveTransactionIconType: (transaction: Record<string, unknown>) => string
    }).FinTrackResolveTransactionIconType
    return [
      resolve({ type: 'INCOME', sub_type: null, category: { system_key: 'income_receivable_collection' } }),
      resolve({ type: 'EXPENSE', sub_type: null, category: { system_key: 'expense_payable_payment' } }),
    ]
  })
  expect(collectionAndPaymentTypes).toEqual(['receivable_collect', 'payable_pay'])

  const legacyFlagsIgnored = await page.evaluate(() => {
    const resolve = (window as Window & {
      FinTrackResolveTransactionIconType: (transaction: Record<string, unknown>) => string
    }).FinTrackResolveTransactionIconType
    return [
      resolve({ type: 'INCOME', hasReceivable: true }),
      resolve({ type: 'EXPENSE', hasPayable: true }),
    ]
  })
  expect(legacyFlagsIgnored).toEqual(['income', 'expense'])

  const repositorySource = readFileSync(join(process.cwd(), 'modules/transactions/transaction.repository.ts'), 'utf8')
  expect(repositorySource).toContain('category:categories(id, name, icon, color, system_key)')
  expect(repositorySource).toContain('linked_asset:assets(id)')
  expect(repositorySource).toContain('linked_receivable:accounts_receivable(id)')
  expect(repositorySource).toContain('linked_payable:accounts_payable(id)')
  expect(repositorySource).toContain('.select(`\n        *,')
  const serviceSource = readFileSync(join(process.cwd(), 'modules/transactions/transaction.service.ts'), 'utf8')
  expect(serviceSource).toContain('return this.txRepo.findMany(userId, filters)')
  const apiSource = readFileSync(join(process.cwd(), 'app/api/transactions/route.ts'), 'utf8')
  expect(apiSource).toContain('...row,')

  const cssSource = readFileSync(join(process.cwd(), 'components/tables/TransactionsRound07.module.css'), 'utf8')
  expect(cssSource).toContain('width: min(356px, calc(100vw - 24px))')
  expect(cssSource).toContain('min-width: min(320px, calc(100vw - 24px))')
  expect(cssSource).toContain('max-height: calc(100dvh - 24px)')
  expect(cssSource).toContain('overflow-y: auto')
  expect(cssSource).toContain('min-height: 54px')
  expect(cssSource).toContain('gap: 5px')
  expect(cssSource).toContain('--operation-accent: var(--ft-success')
  expect(cssSource).toContain('--operation-accent: var(--ft-danger')
  expect(cssSource).toContain('--operation-accent: var(--ft-info')
  const tableSource = readFileSync(join(process.cwd(), 'components/tables/TransactionTable.tsx'), 'utf8')
  expect(tableSource).toContain('OperationTypeIcon operationType={operationType}')
  expect(tableSource).toContain('resolveTransactionOperationIconType(transaction)')
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
    FinTrackResolveTransactionIconType: (transaction: Record<string, unknown>) => string
    selectedOperationTypes: string[]
    popoverMetrics: { show: number; hide: number; animate: number; visibleFrames: number }
  }
}
