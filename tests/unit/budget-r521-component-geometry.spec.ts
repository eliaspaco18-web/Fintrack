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
    __budgetRequests?: Array<{ url: string; method?: string; body?: string }>
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
  await page.setContent('<div class="fin-shell" data-ft-v3-shell><main class="v3ModuleContent"><div id="root"></div></main></div>')
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
      FocusTrap: ({ children, className, active }) => React.createElement('div', { className, 'data-focus-trap-active': String(active) }, children),
    };
    window.__budgetModules['@/components/ui/Button'] = { Button: () => null };
    window.__budgetModules['@/components/ui/AppSelect'] = { AppSelect: () => null };
    window.__budgetModules['@/components/ui/ActionIconButton'] = { ActionIconButton: () => null };
    window.__budgetModules['@/components/finance/primitives'] = { EmptyState: () => null };
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
    window.__budgetRequests = [];
    window.fetch = async (url, init) => {
      window.__budgetRequests.push({ url: String(url), method: init?.method, body: init?.body });
      return { ok: true, json: async () => ({ ok: true, data: init?.method === 'PATCH' ? {} : [{
        id: 'tx-fixture', date: '2026-10-15', portfolio: 'Cuenta operativa', recipient: 'Proveedor',
        description: 'Movimiento de prueba sintético', amount: 125, currency: 'PEN', exchange_rate: null,
      }] }) };
    };
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

test('budget search uses a single framed control with the focus ring on its wrapper', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installReactHarness(page)
  await page.addScriptTag({ content: compileComponent('components/finance/data-table.tsx', 'DataSearchField') })
  await page.addScriptTag({ content: `(() => {
    const React = window.React;
    const ReactDOM = window.ReactDOM;
    const DataSearchField = window.__budgetExports.DataSearchField;
    window.__budgetRoot = ReactDOM.createRoot(document.getElementById('root'));
    window.__budgetRoot.render(React.createElement('div', { className: 'controls portfolioFilterBar budgetFilterToolbar', 'data-testid': 'budgets-filter-toolbar' },
      React.createElement('div', { className: 'controlsMain budgetFilterMain' },
        React.createElement(DataSearchField, {
          value: '', onChange: () => {}, placeholder: 'Buscar presupuestos',
          'aria-label': 'Buscar presupuestos', 'data-testid': 'budgets-search-input',
          className: 'searchControl budgetSearchControl',
        }))));
  })();` })

  const input = page.getByTestId('budgets-search-input')
  const wrapper = page.locator('.controlsMain > .searchControl')
  await expect(input).toBeVisible()
  for (const width of [390, 834, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    await input.focus()
    const styles = await page.evaluate(() => {
      const wrapper = document.querySelector<HTMLElement>('.controlsMain > .searchControl')!
      const input = document.querySelector<HTMLInputElement>('[data-testid="budgets-search-input"]')!
      const wrapperStyle = getComputedStyle(wrapper)
      const inputStyle = getComputedStyle(input)
      const wrapperRect = wrapper.getBoundingClientRect()
      const inputRect = input.getBoundingClientRect()
      return {
        wrapper: { border: wrapperStyle.borderWidth, radius: wrapperStyle.borderRadius, outline: wrapperStyle.outlineWidth, width: wrapperRect.width, height: wrapperRect.height, right: wrapperRect.right },
        input: { border: inputStyle.borderWidth, radius: inputStyle.borderRadius, background: inputStyle.backgroundColor, shadow: inputStyle.boxShadow, outline: inputStyle.outlineWidth, left: inputRect.left, right: inputRect.right },
      }
    })
    expect(styles.wrapper.border).toBe('1px')
    expect(styles.wrapper.radius).toBe('10px')
    expect(styles.wrapper.outline).toBe('2px')
    expect(styles.input.border).toBe('0px')
    expect(styles.input.radius).toBe('0px')
    expect(styles.input.background).toBe('rgba(0, 0, 0, 0)')
    expect(styles.input.shadow).toBe('none')
    expect(styles.input.outline).toBe('0px')
    const wrapperBox = await wrapper.boundingBox()
    expect(wrapperBox).not.toBeNull()
    expect(styles.input.left).toBeGreaterThanOrEqual(wrapperBox!.x)
    expect(styles.input.right).toBeLessThanOrEqual(wrapperBox!.x + wrapperBox!.width)
    expect(styles.wrapper.right).toBeLessThanOrEqual(width)
    if (width <= 767) expect(styles.wrapper.height).toBe(44)
  }
})

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
  expect(source).toContain('footer={onContinueNextPeriod ? (')
  expect(source).toContain('testId="budget-detail-next-period"')
  expect(source).toContain('testId="budget-period-editor-workbench"')
  expect(source).not.toContain('className={styles.amountForm}')
  const managerSource = sourceOf('components/management/BudgetsManager.tsx')
  expect(managerSource).toContain("formMode === 'continuation'\n              ? 'Crear siguiente período'")
  expect(managerSource).toContain("isContinuationMode ? 'w-[calc(100vw-32px)] max-w-[580px]'")
  expect(managerSource).toContain('openNewPeriod(detailBudget)')
  expect(managerSource).toContain('overlayClassName={isContinuationMode ? styles.continuationOverlay : undefined}')

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
    const nextBudget = {
      ...budget,
      id: 'period-2026-11', budget_period_id: 'period-2026-11',
      start_date: '2026-11-01', end_date: '2026-11-30', period_start: '2026-11-01', period_end: '2026-11-30',
      amount: 9876543210.99, spent_amount: 11234567890.87, remaining_amount: -1358024679.88,
      progress_percent: 114, over_limit: true,
    };
    function Host() {
      const [open, setOpen] = React.useState(true);
      const [mounted, setMounted] = React.useState(true);
      const [continuationOpen, setContinuationOpen] = React.useState(false);
      window.__reopenBudgetDetail = () => { setMounted(true); setOpen(true); };
      if (!mounted) return null;
      return React.createElement(React.Fragment, null,
        React.createElement(window.__budgetExports.BudgetDetail, {
          open, budget, periods: [budget, nextBudget], suspendFocusTrap: continuationOpen, onClose: () => setOpen(false), onExitComplete: () => { window.__budgetExitComplete = true; setMounted(false); },
          onContinueNextPeriod: () => { window.__budgetContinueCalled = true; setContinuationOpen(true); },
        }),
        React.createElement(window.__budgetExports.RecordModal, {
          open: continuationOpen, onClose: () => setContinuationOpen(false), presentation: 'workbench',
          overlayClassName: 'continuationOverlay', widthClassName: 'w-[calc(100vw-32px)] max-w-[580px]',
          title: 'Crear siguiente período', testId: 'budget-continuation-workbench',
        }, React.createElement('p', null, 'Edición compacta del nuevo período')),
      );
    }
    window.__budgetRoot = ReactDOM.createRoot(document.getElementById('root'));
    window.__budgetRoot.render(React.createElement(Host));
    window.__budgetCloseFrames = [];
})();` })

  const dialog = page.getByTestId('budget-detail-workbench')
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('.periodRail')).toBeVisible()
  await expect(dialog.locator('.detailMetrics')).toBeVisible()
  await expect(dialog.locator('.amountForm')).toHaveCount(0)
  await expect(dialog.locator('[data-testid^="budget-edit-period-"]')).toHaveCount(2)
  await expect(dialog.locator('.transactionList')).toBeVisible()
  await expect(page.locator('[data-ft-workbench-overlay]')).toHaveAttribute('data-phase', 'open')

  for (const width of [390, 834, 1081, 1200, 1440, 1710]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    const geometry = await page.evaluate(() => {
      const dialogNode = document.querySelector<HTMLElement>('[data-testid="budget-detail-workbench"]')!
      const wrapper = dialogNode.closest<HTMLElement>('.ft-v3-workbench-wrapper')!
      const bounds = wrapper.getBoundingClientRect()
      const dialogBounds = dialogNode.getBoundingClientRect()
      const parts = ['.periodRail', '.detailOverview', '.detailMetrics', '.transactionList'].map(selector => {
        const rect = dialogNode.querySelector<HTMLElement>(selector)!.getBoundingClientRect()
        return { left: rect.left, right: rect.right, width: rect.width, height: rect.height }
      })
      return {
        wrapper: { left: bounds.left, right: bounds.right, width: bounds.width, height: bounds.height },
        dialog: { left: dialogBounds.left, right: dialogBounds.right, width: dialogBounds.width },
        body: (() => { const rect = dialogNode.querySelector<HTMLElement>('[data-record-modal-body]')!.getBoundingClientRect(); return { top: rect.top, bottom: rect.bottom, height: rect.height } })(),
        layout: (() => { const rect = dialogNode.querySelector<HTMLElement>('.detailLayout')!.getBoundingClientRect(); return { top: rect.top, bottom: rect.bottom, height: rect.height } })(),
        detailMainBottom: dialogNode.querySelector<HTMLElement>('.detailMain')!.getBoundingClientRect().bottom,
        overviewHeight: dialogNode.querySelector<HTMLElement>('.detailOverview')!.getBoundingClientRect().height,
        transactionToolbarOffset: dialogNode.querySelector<HTMLElement>('.transactionToolbar')!.getBoundingClientRect().top - dialogNode.querySelector<HTMLElement>('[data-record-modal-body]')!.getBoundingClientRect().top,
        transactionListHeight: dialogNode.querySelector<HTMLElement>('.transactionList')!.getBoundingClientRect().height,
        summaryOverflow: (() => {
          const overview = dialogNode.querySelector<HTMLElement>('.detailOverview')!
          return overview.scrollWidth > overview.clientWidth || [...overview.querySelectorAll<HTMLElement>('.detailMetricValue')].some(value => value.scrollWidth > value.clientWidth + 1)
        })(),
        periodRailWidth: dialogNode.querySelector<HTMLElement>('.periodRail')!.getBoundingClientRect().width,
        periodCard: (() => {
          const card = dialogNode.querySelector<HTMLElement>('.periodOption')!
          const range = card.querySelector<HTMLElement>('.periodOptionRange')!
          const status = card.querySelector<HTMLElement>('.periodOptionStatus')!
          const edit = card.querySelector<HTMLElement>('.periodEditButton')!
          return {
            width: card.getBoundingClientRect().width,
            rangeClientWidth: range.clientWidth,
            rangeScrollWidth: range.scrollWidth,
            statusVisible: status.getBoundingClientRect().width > 0,
            editVisible: edit.getBoundingClientRect().width > 0,
            selectedBackground: getComputedStyle(card).backgroundColor,
          }
        })(),
        footer: (() => { const rect = dialogNode.lastElementChild!.getBoundingClientRect(); return { top: rect.top, bottom: rect.bottom, height: rect.height } })(),
        documentWidth: document.documentElement.scrollWidth,
        parts,
        display: getComputedStyle(dialogNode.querySelector<HTMLElement>('.detailLayout')!).display,
        columns: getComputedStyle(dialogNode.querySelector<HTMLElement>('.detailLayout')!).gridTemplateColumns,
      }
    })
    if (width === 1440) console.log('[r5.8 detail geometry]', JSON.stringify({ overviewHeight: geometry.overviewHeight, transactionToolbarOffset: geometry.transactionToolbarOffset, transactionListHeight: geometry.transactionListHeight, wrapperHeight: geometry.wrapper.height }))
    expect(geometry.wrapper.width).toBeLessThanOrEqual(width)
    expect(geometry.wrapper.right).toBeLessThanOrEqual(width + 0.5)
    expect(geometry.dialog.width).toBeGreaterThan(width <= 767 ? width - 30 : Math.min(580, width - 50))
    expect(geometry.documentWidth).toBeLessThanOrEqual(width)
    expect(geometry.summaryOverflow).toBe(false)
    expect(geometry.parts.every(part => part.width > 0 && part.right <= geometry.dialog.right + 1)).toBe(true)
    expect(geometry.periodCard.statusVisible).toBe(true)
    expect(geometry.periodCard.editVisible).toBe(true)
    expect(geometry.periodCard.rangeScrollWidth).toBeLessThanOrEqual(geometry.periodCard.rangeClientWidth + 1)
    expect(geometry.periodRailWidth).toBeGreaterThan(0)
    if (width > 767) {
      expect(geometry.wrapper.width).toBeGreaterThan(580)
      expect(geometry.wrapper.left).toBeGreaterThanOrEqual(11)
      expect(geometry.wrapper.right).toBeCloseTo(width - 12, 0)
      expect(geometry.wrapper.height).toBeCloseTo(876, 0)
      expect(Math.abs(geometry.layout.bottom - geometry.body.bottom)).toBeLessThanOrEqual(2)
      expect(Math.abs(geometry.detailMainBottom - geometry.layout.bottom)).toBeLessThanOrEqual(2)
      expect(geometry.footer.height).toBeGreaterThan(0)
    }
    if (width >= 1200) {
      expect(geometry.periodRailWidth).toBeGreaterThanOrEqual(318)
      expect(geometry.overviewHeight).toBeLessThanOrEqual(150)
      expect(geometry.transactionListHeight).toBeGreaterThan(260)
    }
    if (width <= 767) expect(geometry.display).toBe('flex')
    else if (width <= 1120) expect(geometry.columns).not.toContain('318px')
  }

  for (const width of [390, 834, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    await dialog.getByTestId('budget-select-period-period-2026-11').click()
    await expect(dialog.locator('.detailMetricValueDanger')).toContainText('1,358,024,679.88')
    await expect(dialog.locator('.selectedStatusDescription')).toContainText('supera el límite')
    const overLimitGeometry = await dialog.locator('.detailOverview').evaluate(node => {
      const overview = node as HTMLElement
      const values = [...overview.querySelectorAll<HTMLElement>('.detailMetricValue')]
      return {
        clientWidth: overview.clientWidth,
        scrollWidth: overview.scrollWidth,
        values: values.map(value => ({ clientWidth: value.clientWidth, scrollWidth: value.scrollWidth })),
      }
    })
    expect(overLimitGeometry.scrollWidth).toBeLessThanOrEqual(overLimitGeometry.clientWidth + 1)
    expect(overLimitGeometry.values.every(value => value.scrollWidth <= value.clientWidth + 1)).toBe(true)
    await dialog.getByTestId('budget-select-period-period-2026-10').click()
  }

  await dialog.getByTestId('budget-edit-period-period-2026-10').click()
  const editor = page.getByTestId('budget-period-editor-workbench')
  await expect(editor).toBeVisible()
  await expect(dialog.locator('#budget-period-amount')).toHaveCount(0)
  await expect(editor.locator('#budget-period-amount')).toHaveValue('1000.00')
  const editOverlays = await page.locator('[data-ft-workbench-overlay]').evaluateAll(nodes => nodes.map(node => ({
    testId: node.querySelector('[data-testid]')?.getAttribute('data-testid'),
    zIndex: Number(getComputedStyle(node).zIndex),
  })))
  expect(editOverlays.find(item => item.testId === 'budget-detail-workbench')?.zIndex).toBeLessThan(
    editOverlays.find(item => item.testId === 'budget-period-editor-workbench')?.zIndex ?? 0,
  )
  await editor.locator('#budget-period-amount').fill('875')
  await editor.getByRole('button', { name: 'Cerrar panel' }).click()
  await expect(page.getByRole('alertdialog', { name: 'Descartar cambio de importe' })).toBeVisible()
  await expect(dialog).toBeVisible()
  await page.getByRole('button', { name: 'Descartar cambio' }).click()
  await expect(editor).toHaveCount(0, { timeout: 1500 })
  await expect(dialog).toBeVisible()

  await dialog.getByTestId('budget-edit-period-period-2026-10').click()
  await expect(editor).toBeVisible()
  await editor.locator('#budget-period-amount').fill('875')
  await editor.getByTestId('budget-period-save-button').click()
  await expect(editor).toHaveCount(0, { timeout: 1500 })
  const requests = await page.evaluate(() => window.__budgetRequests)
  expect(requests?.some(request => request.url === '/mock/amount/period-2026-10' && request.method === 'PATCH' && request.body === '{"amount":875}')).toBe(true)
  await expect(dialog).toBeVisible()

  await page.evaluate(() => {
    const sample = () => {
      const overlay = document.querySelector<HTMLElement>('[data-ft-workbench-overlay]:has([data-testid="budget-detail-workbench"])')
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
  await dialog.getByRole('button', { name: 'Cerrar panel' }).click()
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

  await page.evaluate(() => (window as any).__reopenBudgetDetail())
  await expect(dialog).toBeVisible()
  await page.getByTestId('budget-detail-next-period').click()
  await expect.poll(() => page.evaluate(() => (window as any).__budgetContinueCalled)).toBe(true)
  const continuation = page.getByTestId('budget-continuation-workbench')
  await expect(continuation).toBeVisible()
  await expect(dialog).toBeVisible()
  const stacked = await page.locator('[data-ft-workbench-overlay]').evaluateAll(nodes => nodes.map(node => ({
    testId: node.querySelector('[data-testid]')?.getAttribute('data-testid'),
    zIndex: Number(getComputedStyle(node).zIndex),
    blur: getComputedStyle(node.querySelector('[data-ft-workbench-veil]')!).backdropFilter,
  })))
  const detailStack = stacked.find(item => item.testId === 'budget-detail-workbench')
  const continuationStack = stacked.find(item => item.testId === 'budget-continuation-workbench')
  expect(detailStack).toBeDefined()
  expect(continuationStack?.zIndex).toBeGreaterThan(detailStack?.zIndex ?? 0)
  expect(continuationStack?.blur).toContain('blur(3px)')
  expect(dialog.locator('xpath=ancestor::*[@data-focus-trap-active="false"]')).toHaveCount(1)
  await continuation.getByRole('button', { name: 'Cerrar panel' }).click()
  await expect(continuation).toHaveCount(0, { timeout: 1500 })
  await expect(dialog).toBeVisible()
})
