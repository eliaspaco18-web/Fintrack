import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import * as ts from 'typescript'

declare global {
  interface Window {
    __budgetModules: Record<string, any>
    __budgetExports: Record<string, any>
    __budgetRoot?: { render: (node: unknown) => void }
    __budgetCloseFrames?: Array<{ phase: string; opacity: number; veilOpacity: number; width: number; height: number } | { gone: true }>
  }
}

const reactPath = join(process.cwd(), 'node_modules/react/umd/react.development.js')
const reactDomPath = join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js')
const sourceOf = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

function compileComponent(path: string, exportName: string): string {
  const filePath = join(process.cwd(), path)
  const sourceFile = ts.createSourceFile(filePath, sourceOf(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const removals: Array<{ start: number; end: number }> = []
  const bindings: string[] = []

  sourceFile.statements.forEach(statement => {
    if (ts.isImportDeclaration(statement)) {
      removals.push({ start: statement.getStart(sourceFile), end: statement.end })
      if (statement.importClause?.isTypeOnly) return
      const specifier = (statement.moduleSpecifier as ts.StringLiteral).text
      const moduleName = `__budgetImport${bindings.length}`
      bindings.push(`const ${moduleName} = window.__budgetModules[${JSON.stringify(specifier)}];`)
      const clause = statement.importClause
      if (!clause) return
      if (clause.name) bindings.push(`const ${clause.name.text} = ${moduleName}.default;`)
      if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
        bindings.push(`const ${clause.namedBindings.name.text} = ${moduleName};`)
      } else if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        clause.namedBindings.elements.filter(item => !item.isTypeOnly).forEach(item => {
          const imported = item.propertyName?.text ?? item.name.text
          bindings.push(`const ${item.name.text} = ${moduleName}[${JSON.stringify(imported)}];`)
        })
      }
    }
    if (ts.isExportDeclaration(statement)) removals.push({ start: statement.getStart(sourceFile), end: statement.end })
  })

  let source = sourceFile.text
  removals.sort((a, b) => b.start - a.start).forEach(range => {
    source = `${source.slice(0, range.start)}${source.slice(range.end)}`
  })
  source = source
    .replace(/^'use client'\s*/, '')
    .replace(/\bexport\s+(?=(?:async\s+)?(?:function|const|class|interface|type)\b)/g, '')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React },
  }).outputText
  const reactBinding = bindings.some(binding => /const React\s*=/.test(binding)) ? '' : 'const React = window.React;'
  return `(() => { ${bindings.join('\n')}\n${reactBinding}\n${compiled}\nwindow.__budgetExports[${JSON.stringify(exportName)}] = ${exportName};\n})();`
}

async function installReactHarness(page: Page) {
  page.on('pageerror', error => console.error('[budget-geometry pageerror]', error.message))
  page.on('console', message => {
    if (message.type() === 'error') console.error('[budget-geometry console]', message.text())
  })
  await page.setContent('<div class="fin-shell" data-ft-v3-shell></div><div id="root"></div>')
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })

  const cssDirectory = join(process.cwd(), '.next/static/css')
  const compiledCss = readdirSync(cssDirectory, { recursive: true })
    .map(String)
    .filter(file => file.endsWith('.css'))
    .map(file => readFileSync(join(cssDirectory, file), 'utf8'))
    .join('\n')
  const movementCss = sourceOf('components/tables/TransactionsRound07.module.css').replace(/:global\(([^()]*)\)/g, '$1')
  const budgetsCss = sourceOf('components/management/BudgetsManager.module.css').replace(/:global\(([^()]*)\)/g, '$1')
  const detailCss = sourceOf('components/management/BudgetDetail.module.css').replace(/:global\(([^()]*)\)/g, '$1')
  await page.addStyleTag({ content: `${compiledCss}\n${movementCss}\n${budgetsCss}\n${detailCss}` })

  await page.addScriptTag({ content: `(() => {
    window.__budgetModules = {};
    window.__budgetExports = {};
    const React = window.React;
    const ReactDOM = window.ReactDOM;
    const classProxy = new Proxy({}, { get: (_target, key) => String(key) });
    window.__budgetModules['react'] = { default: React, ...React };
    window.__budgetModules['react-dom'] = { default: ReactDOM, createPortal: ReactDOM.createPortal };
    window.__budgetModules['next/link'] = { default: ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children) };
    window.__budgetModules['@/components/ui/accessibility'] = {
      FocusTrap: ({ children, className }) => React.createElement('div', { className }, children),
    };
    window.__budgetModules['@/lib/ui/v3-modal-background'] = { acquireV3ModalBackground: () => () => {} };
    window.__budgetModules['@/components/finance'] = {
      ConfirmDialog: ({ open, title, onCancel, onConfirm }) => open ? React.createElement('div', { role: 'alertdialog', 'aria-label': title },
        React.createElement('p', null, title),
        React.createElement('button', { type: 'button', onClick: onCancel }, 'Cancelar'),
        React.createElement('button', { type: 'button', onClick: onConfirm }, 'Descartar cambio')) : null,
    };
    window.__budgetModules['@/lib/api/error-message'] = { getApiErrorMessage: (_json, fallback) => fallback };
    window.__budgetModules['@/modules/budgets/budget-action-scope'] = { createBudgetRecordActionScope: () => ({}) };
    window.__budgetModules['@/lib/budgets/presentation'] = {
      formatBudgetCurrency: (value, currency) => new Intl.NumberFormat('es-PE', { style: 'currency', currency }).format(value),
    };
    window.__budgetModules['@/components/ui/AppSelect'] = {
      AppSelect: ({ value, options = [], onChange, className, compact: _compact, searchable: _searchable, ...props }) => React.createElement('select', {
        value, onChange: event => onChange(event.target.value), className, ...props,
      }, options.map(option => React.createElement('option', { key: option.value, value: option.value }, option.label)),
      ),
    };
    window.__budgetModules['@/components/management/BudgetDetail.module.css'] = { default: classProxy };
    window.__budgetModules['@/lib/budgets/period-record'] = {
      mergeBudgetPeriodItems: (periods, budget) => periods?.length ? periods : [budget],
      resolveBudgetPeriodAmountUrl: period => '/mock/amount/' + period.id,
      resolveBudgetPeriodTransactionsUrl: period => '/mock/transactions/' + period.id,
    };
    window.fetch = async () => ({ ok: true, json: async () => ({ ok: true, data: [{
      id: 'tx-fixture', date: '2026-10-15', portfolio: 'Cuenta operativa', recipient: 'Proveedor',
      description: 'Movimiento de prueba sintético', amount: 125, currency: 'PEN', exchange_rate: null,
    }] }) });
})();` })

  await page.addScriptTag({ content: compileComponent('components/ui/Button.tsx', 'Button') })
  await page.addScriptTag({ content: `window.__budgetModules['@/components/ui/Button'] = { Button: window.__budgetExports.Button };` })
  await page.addScriptTag({ content: compileComponent('components/ui/CreateModuleButton.tsx', 'CreateModuleButton') })
  await page.addScriptTag({ content: `window.__budgetModules['@/components/ui/CreateModuleButton'] = { CreateModuleButton: window.__budgetExports.CreateModuleButton };` })
  await page.addScriptTag({ content: compileComponent('lib/ui/use-v3-workbench-presence.ts', 'useV3WorkbenchPresence') })
  await page.addScriptTag({ content: `window.__budgetModules['@/lib/ui/use-v3-workbench-presence'] = { useV3WorkbenchPresence: window.__budgetExports.useV3WorkbenchPresence };` })
  await page.addScriptTag({ content: compileComponent('components/ui/RecordModal.tsx', 'RecordModal') })
  await page.addScriptTag({ content: `window.__budgetModules['@/components/ui/RecordModal'] = { RecordModal: window.__budgetExports.RecordModal };` })
  await page.addScriptTag({ content: compileComponent('components/management/BudgetDetail.tsx', 'BudgetDetail') })
}

test('the three module CTAs use the real shared button and approved V3 geometry', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installReactHarness(page)
  const portfolioSource = sourceOf('components/management/PortfolioManager.tsx')
  const movementSource = sourceOf('components/transactions/TransactionsWorkspace.tsx')
  const budgetSource = sourceOf('components/management/BudgetsManager.tsx')
  expect(portfolioSource).toContain('className={`${styles.v3ModulePrimaryAction} w-full sm:w-auto`}')
  expect(movementSource).toContain('className={`${styles.v3ModulePrimaryAction} w-full sm:w-auto`}')
  expect(budgetSource).toContain('className={`${movementPageStyles.v3ModulePrimaryAction} w-full sm:w-auto`}')

  await page.addScriptTag({ content: `(() => {
    const React = window.React;
    const ReactDOM = window.ReactDOM;
    const CreateModuleButton = window.__budgetExports.CreateModuleButton;
    function Header({ kind, title, label }) {
      const period = kind === 'budgets'
        ? React.createElement('div', { className: 'headerPeriodControl' }, React.createElement('button', { className: 'headerPeriodTrigger' }, 'Octubre 2026'))
        : kind === 'transactions' ? React.createElement('span', { className: 'monthScope' }, 'Octubre 2026') : null;
      return React.createElement('main', { className: 'ft-shell-content v3ModuleContent' },
        React.createElement('section', { className: 'pageOverview' },
          React.createElement('header', { className: 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between' },
            React.createElement('div', { className: 'min-w-0' },
              React.createElement('h1', { className: 'font-display text-[26px] font-semibold leading-8 tracking-[-0.035em] text-[var(--ft-text-strong)]' }, title),
              React.createElement('p', { className: 'mt-0.5 max-w-2xl text-[12px] leading-5 text-[var(--ft-text-muted)]' }, 'Descripción del módulo.')),
            React.createElement('div', { className: 'budgetHeaderActions' }, period,
              React.createElement(CreateModuleButton, { label, className: 'v3ModulePrimaryAction w-full sm:w-auto', testId: kind + '-cta' })))));
    }
    const root = window.ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(React.Fragment, null,
      React.createElement(Header, { kind: 'accounts', title: 'Cuentas', label: 'Añadir cuenta' }),
      React.createElement(Header, { kind: 'transactions', title: 'Movimientos', label: 'Nuevo movimiento' }),
      React.createElement(Header, { kind: 'budgets', title: 'Presupuestos', label: 'Crear presupuesto' })));
})();` })

  const ctas = page.locator('.module-create-btn')
  await expect(ctas).toHaveCount(3)
  const metrics = await ctas.evaluateAll(buttons => buttons.map(button => {
      const rect = button.getBoundingClientRect()
      const titleRect = button.closest('.pageOverview')!.querySelector('h1')!.getBoundingClientRect()
    const style = getComputedStyle(button)
      return { topFromTitle: rect.top - titleRect.top, right: rect.right, height: rect.height, font: style.fontFamily, weight: style.fontWeight, radius: style.borderRadius }
  }))
  expect(metrics.map(metric => metric.height)).toEqual([36, 36, 36])
  expect(metrics[0]!.topFromTitle).toBe(metrics[1]!.topFromTitle)
  expect(metrics[1]!.topFromTitle).toBe(metrics[2]!.topFromTitle)
  expect(metrics[0]!.right).toBe(metrics[1]!.right)
  expect(metrics[1]!.right).toBe(metrics[2]!.right)
  expect(metrics.every(metric => metric.font.toLowerCase().includes('manrope'))).toBe(true)
  expect(new Set(metrics.map(metric => metric.weight)).size).toBe(1)
  expect(new Set(metrics.map(metric => metric.radius)).size).toBe(1)
  const period = await page.locator('.headerPeriodControl').boundingBox()
  const budgetCta = await page.getByTestId('budgets-cta').boundingBox()
  expect(period).not.toBeNull()
  expect(budgetCta).not.toBeNull()
  expect(budgetCta!.x - (period!.x + period!.width)).toBe(8)
})

test('the real RecordModal wrapper expands for budget detail and keeps its content and close lifecycle stable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await installReactHarness(page)
  const source = sourceOf('components/management/BudgetDetail.tsx')
  expect(source).toContain('overlayClassName={styles.detailOverlay}')

  await page.addScriptTag({ content: `(() => {
    const React = window.React;
    const ReactDOM = window.ReactDOM;
    window.__budgetModules['@/components/finance'] = window.__budgetModules['@/components/finance'];
    window.__budgetModules['@/components/management/BudgetDetail.module.css'] = { default: new Proxy({}, { get: (_target, key) => String(key) }) };
    const budget = {
      id: 'period-2026-10', budget_period_id: 'period-2026-10', series_id: 'series-1', name: 'Presupuesto de prueba',
      description: null, category_id: 'category-1', currency: 'PEN', period_type: 'MONTHLY',
      start_date: '2026-10-01', end_date: '2026-10-31', period_start: '2026-10-01', period_end: '2026-10-31',
      amount: 1000, spent_amount: 350, remaining_amount: 650, progress_percent: 35, over_limit: false,
      is_active: true, category: { name: 'Hogar' },
    };
    function Host() {
      const [open, setOpen] = React.useState(true);
      return React.createElement(window.__budgetExports.BudgetDetail, {
        open, budget, periods: [budget], onClose: () => setOpen(false), onExitComplete: () => { window.__budgetExitComplete = true; },
      });
    }
    window.__budgetRoot = ReactDOM.createRoot(document.getElementById('root'));
    window.__budgetRoot.render(React.createElement(Host));
    window.__budgetCloseFrames = [];
})();` })

  const dialog = page.getByTestId('budget-detail-workbench')
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('.periodRail')).toBeVisible()
  await expect(dialog.locator('.detailMetrics')).toBeVisible()
  await expect(dialog.locator('.amountForm')).toBeVisible()
  await expect(dialog.locator('.transactionList')).toBeVisible()
  await expect(page.locator('[data-ft-workbench-overlay]')).toHaveAttribute('data-phase', 'open')

  for (const width of [390, 834, 1081, 1200, 1440, 1710]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    const geometry = await page.evaluate(() => {
      const wrapper = document.querySelector<HTMLElement>('.ft-v3-workbench-wrapper')!
      const dialogNode = document.querySelector<HTMLElement>('[data-testid="budget-detail-workbench"]')!
      const bounds = wrapper.getBoundingClientRect()
      const dialogBounds = dialogNode.getBoundingClientRect()
      const parts = ['.periodRail', '.detailOverview', '.amountForm', '.transactionList'].map(selector => {
        const rect = dialogNode.querySelector<HTMLElement>(selector)!.getBoundingClientRect()
        return { left: rect.left, right: rect.right, width: rect.width, height: rect.height }
      })
      return {
        wrapper: { left: bounds.left, right: bounds.right, width: bounds.width, height: bounds.height },
        dialog: { left: dialogBounds.left, right: dialogBounds.right, width: dialogBounds.width },
        documentWidth: document.documentElement.scrollWidth,
        parts,
        columns: getComputedStyle(dialogNode.querySelector<HTMLElement>('.detailLayout')!).gridTemplateColumns,
      }
    })
    expect(geometry.wrapper.width).toBeLessThanOrEqual(width)
    expect(geometry.wrapper.right).toBeLessThanOrEqual(width + 0.5)
    expect(geometry.dialog.width).toBeGreaterThan(width <= 767 ? width - 30 : Math.min(580, width - 50))
    expect(geometry.documentWidth).toBeLessThanOrEqual(width)
    expect(geometry.parts.every(part => part.width > 0 && part.right <= geometry.dialog.right + 1)).toBe(true)
    if (width > 767) expect(geometry.wrapper.width).toBeGreaterThan(580)
    if (width <= 1120) expect(geometry.columns.split(' ').length).toBe(1)
  }

  const amount = page.locator('#budget-period-amount')
  await amount.fill('875')
  await page.getByRole('button', { name: 'Cerrar panel' }).click()
  await expect(page.getByRole('alertdialog', { name: 'Descartar cambio de importe' })).toBeVisible()
  await expect(dialog).toBeVisible()
  await page.evaluate(() => {
    const sample = () => {
      const overlay = document.querySelector<HTMLElement>('[data-ft-workbench-overlay]')
      if (!overlay) {
        window.__budgetCloseFrames!.push({ gone: true })
        return
      }
      const frame = overlay.querySelector<HTMLElement>('[data-ft-workbench]')!
      const veil = overlay.querySelector<HTMLElement>('[data-ft-workbench-veil]')!
      window.__budgetCloseFrames!.push({
        phase: overlay.dataset.phase ?? '', opacity: Number(getComputedStyle(frame).opacity),
        veilOpacity: Number(getComputedStyle(veil).opacity), width: frame.offsetWidth, height: frame.offsetHeight,
      })
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
  await page.getByRole('button', { name: 'Descartar cambio' }).click()
  await expect(dialog).toHaveCount(0, { timeout: 1500 })
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__budgetExitComplete'))).toBe(true)
  const frames = await page.evaluate(() => window.__budgetCloseFrames ?? [])
  const visibleFrames = frames.filter((frame): frame is Exclude<typeof frame, { gone: true }> => !('gone' in frame))
  expect(visibleFrames.some(frame => frame.phase === 'closing')).toBe(true)
  expect(frames.some(frame => 'gone' in frame)).toBe(true)
  expect(visibleFrames.length).toBeGreaterThan(2)
  expect(Math.max(...visibleFrames.map(frame => frame.width)) - Math.min(...visibleFrames.map(frame => frame.width))).toBeLessThan(1)
  expect(Math.max(...visibleFrames.map(frame => frame.height)) - Math.min(...visibleFrames.map(frame => frame.height))).toBeLessThan(1)
  const nearInvisible = visibleFrames.findIndex(frame => frame.opacity <= 0.03)
  expect(nearInvisible).toBeGreaterThanOrEqual(0)
  expect(visibleFrames.slice(nearInvisible).every(frame => frame.opacity <= 0.03 && frame.veilOpacity <= 0.03)).toBe(true)
})
