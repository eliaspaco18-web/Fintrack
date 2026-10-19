import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import * as ts from 'typescript'

declare global {
  interface Window {
    __budgetModules: Record<string, any>
    __budgetExports: Record<string, any>
    __budgetRoot?: { render: (node: unknown) => void }
    __budgetPeriodValue?: string
    __budgetActionInvocations?: number
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
    if (!ts.isImportDeclaration(statement)) return
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

async function installHarness(page: Page) {
  await page.setContent('<main class="fin-shell" data-ft-v3-shell><div id="root"></div></main>')
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })

  const cssDirectory = join(process.cwd(), '.next/static/css')
  const compiledCss = readdirSync(cssDirectory, { recursive: true })
    .map(String)
    .filter(file => file.endsWith('.css'))
    .map(file => readFileSync(join(cssDirectory, file), 'utf8'))
    .join('\n')
  const moduleCss = [
    'components/management/BudgetsManager.module.css',
    'components/management/BudgetMonthPicker.module.css',
    'components/tables/TransactionsRound07.module.css',
  ].map(path => sourceOf(path).replace(/:global\(([^()]*)\)/g, '$1')).join('\n')
  await page.addStyleTag({ content: `*{box-sizing:border-box}html,body{margin:0;min-height:100%;font:13px Manrope,system-ui,sans-serif}button{font-family:inherit} :root{--ft-surface:#fff;--ft-surface-muted:#f4f6f7;--ft-border:#dce1e5;--ft-text-strong:#242a30;--ft-text-muted:#59636d;--ft-text-subtle:#7b858d;--ft-primary:#18764f;--ft-primary-border:#b8d7c9;--ft-primary-soft:#e8f2ec;--ft-text-on-primary:#fff;--ft-r07-surface:#fff;--ft-r07-line:#dce1e5;--ft-r07-ink:#242a30;--ft-r07-muted:#59636d;--ft-r07-hover:#f5f6f7;--ft-radius-control:10px;--ft-shadow-md:0 8px 24px rgb(36 42 48 / 12%);--ft-z-tooltip:180} ${compiledCss}\n${moduleCss}\n.clipHarness{height:84px;overflow:hidden;border:1px solid #ddd;position:relative;padding:10px}.testHost{display:flex;gap:8px;align-items:center;padding:18px}.headerPeriodControl{width:184px}` })
  await page.addScriptTag({ content: `(() => {
    window.__budgetModules = {};
    window.__budgetExports = {};
    const React = window.React;
    const ReactDOM = window.ReactDOM;
    const classProxy = new Proxy({}, { get: (_target, key) => String(key) });
    window.__budgetModules['react'] = { default: React, ...React };
    window.__budgetModules['react-dom'] = { default: ReactDOM, createPortal: ReactDOM.createPortal };
    window.__budgetModules['next/link'] = { default: ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children) };
    window.__budgetModules['./BudgetMonthPicker.module.css'] = { default: classProxy };
    window.__budgetModules['./BudgetsManager.module.css'] = { default: classProxy };
    window.__budgetModules['@/components/ui/Button'] = {};
    window.__budgetModules['@/components/management/BudgetsManager.module.css'] = { default: classProxy };
  })();` })
  await page.addScriptTag({ content: compileComponent('components/ui/Button.tsx', 'Button') })
  await page.addScriptTag({ content: `window.__budgetModules['@/components/ui/Button'] = { Button: window.__budgetExports.Button };` })
  await page.addScriptTag({ content: compileComponent('components/management/BudgetMonthPicker.tsx', 'BudgetMonthPicker') })
  await page.addScriptTag({ content: compileComponent('components/management/BudgetViewPeriodAction.tsx', 'BudgetViewPeriodAction') })
}

test('month picker renders a 12-month calendar, navigates years, selects a month and restores focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installHarness(page)
  await page.addScriptTag({ content: `(() => {
    const React = window.React;
    const { BudgetMonthPicker } = window.__budgetExports;
    function Host() {
      const [value, setValue] = React.useState('2026-10');
      window.__budgetPeriodValue = value;
      return React.createElement('div', { className: 'headerPeriodControl', style: { width: '184px' } }, React.createElement(BudgetMonthPicker, { value, onChange: setValue }));
    }
    window.__budgetRoot = window.ReactDOM.createRoot(document.getElementById('root'));
    window.__budgetRoot.render(React.createElement(Host));
  })();` })

  const trigger = page.getByTestId('budgets-header-period-select')
  await expect(trigger).toContainText('octubre de 2026')
  const triggerRect = await trigger.boundingBox()
  expect(triggerRect?.width).toBe(184)
  expect(await trigger.locator('span').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await trigger.click()
  const panel = page.getByTestId('budget-month-picker-panel')
  await expect(panel).toBeVisible()
  await expect(panel.getByRole('button')).toHaveCount(14)
  await expect(panel.getByRole('group', { name: 'Meses de 2026' }).getByRole('button')).toHaveCount(12)
  await expect(panel.locator('[data-calendar-grid]')).toHaveCount(0)
  await expect(panel.getByRole('searchbox')).toHaveCount(0)
  await panel.getByRole('button', { name: 'Año siguiente' }).click()
  await expect(panel.getByRole('heading', { name: '2027' })).toBeVisible()
  await expect(panel.getByRole('group', { name: 'Meses de 2027' }).getByRole('button')).toHaveCount(12)
  await panel.getByRole('button', { name: 'diciembre 2027' }).click()
  await expect(panel).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => window.__budgetPeriodValue)).toBe('2027-12')
  await expect(trigger).toContainText('diciembre de 2027')
  await expect(trigger).toBeFocused()

  for (const width of [390, 834, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await trigger.click()
    const bounds = await panel.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 0.5)
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
  }
})

test('period action help is transient for mouse and keyboard and rendered outside clipped table ancestors', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installHarness(page)
  await page.addScriptTag({ content: `(() => {
    const React = window.React;
    const { BudgetViewPeriodAction } = window.__budgetExports;
    window.__budgetRoot = window.ReactDOM.createRoot(document.getElementById('root'));
    window.__budgetRoot.render(React.createElement('div', { className: 'clipHarness' },
      React.createElement(BudgetViewPeriodAction, { testId: 'budget-view-action', onClick: () => { window.__budgetActionInvocations = (window.__budgetActionInvocations || 0) + 1; } })));
  })();` })

  const button = page.getByTestId('budget-view-action')
  const tooltip = page.getByRole('tooltip')
  await button.hover()
  await expect(tooltip).toHaveAttribute('data-visible', 'true')
  expect(await tooltip.evaluate(element => element.parentElement === document.body)).toBe(true)
  const bounds = await tooltip.boundingBox()
  expect(bounds).not.toBeNull()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390)
  await page.mouse.move(5, 5)
  await expect(tooltip).toHaveAttribute('data-visible', 'false')

  await button.hover()
  await button.click()
  await expect.poll(() => page.evaluate(() => window.__budgetActionInvocations)).toBe(1)
  await expect(tooltip).toHaveAttribute('data-visible', 'false')
  await page.mouse.move(5, 5)
  await button.evaluate((element) => (element as HTMLButtonElement).blur())
  await page.keyboard.press('Tab')
  await expect(button).toBeFocused()
  await expect(tooltip).toHaveAttribute('data-visible', 'true')
  await page.keyboard.press('Escape')
  await expect(tooltip).toHaveAttribute('data-visible', 'false')
  expect(await tooltip.evaluate(element => element.parentElement === document.body)).toBe(true)
})

test('month picker renders the real tokenized trigger in light and dark theme', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installHarness(page)
  await page.addStyleTag({ content: `html { --ft-r07-surface: #fff; --ft-r07-line: #dce1e5; --ft-r07-ink: #242a30; } html[data-theme='dark'] { --ft-r07-surface: #202327; --ft-r07-line: #3b444a; --ft-r07-ink: #edf0f2; }` })
  await page.addScriptTag({ content: `(() => {
    const React = window.React;
    const { BudgetMonthPicker } = window.__budgetExports;
    window.__budgetRoot = window.ReactDOM.createRoot(document.getElementById('root'));
    window.__budgetRoot.render(React.createElement('div', { className: 'headerPeriodControl' }, React.createElement(BudgetMonthPicker, { value: '2026-10', onChange: () => {} })));
  })();` })

  const trigger = page.getByTestId('budgets-header-period-select')
  await expect(trigger).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(trigger).toHaveCSS('font-family', /Manrope/)
  await page.locator('html').evaluate(element => element.setAttribute('data-theme', 'dark'))
  await expect(trigger).toHaveCSS('background-color', 'rgb(32, 35, 39)')
  await expect(trigger).toHaveCSS('color', 'rgb(237, 240, 242)')
})

test('budget tabs reserve the same 20px rhythm before filters as the approved accounts module', async ({ page }) => {
  await installHarness(page)
  await page.locator('#root').evaluate(root => {
    root.innerHTML = `<div class="budgetControls"><div class="budgetPeriodNavigation"><nav class="budgetTabs tabs"><button class="budgetTab">Este período</button></nav></div><div class="controls budgetFilterToolbar" data-testid="budgets-filter-toolbar"></div></div>`
  })

  const spacing = await page.evaluate(() => {
    const tabs = document.querySelector('.budgetTabs')!.getBoundingClientRect()
    const toolbar = document.querySelector('[data-testid="budgets-filter-toolbar"]')!.getBoundingClientRect()
    return toolbar.top - tabs.bottom
  })
  expect(spacing).toBe(20)
})
