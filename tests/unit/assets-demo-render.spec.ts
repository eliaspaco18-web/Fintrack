import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

declare global {
  interface Window {
    React: any
    ReactDOM: any
    __assetModules: Record<string, any>
    __assetExports: Record<string, any>
    __assetHookEnabled: boolean | null
    __assetApiRequests: string[]
    __assetFixtures: any[]
    __assetTypes: Array<{ id: string; name: string }>
    __assetRoot?: any
  }
}

const reactPath = join(process.cwd(), 'node_modules/react/umd/react.development.js')
const reactDomPath = join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js')

function compileComponent(file: string, name: string, exports: string[] = [name]): string {
  const filePath = join(process.cwd(), file)
  const sourceFile = ts.createSourceFile(filePath, readFileSync(filePath, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const removals: Array<{ start: number; end: number }> = []
  const bindings: string[] = []
  sourceFile.statements.forEach(statement => {
    if (!ts.isImportDeclaration(statement)) return
    removals.push({ start: statement.getStart(sourceFile), end: statement.end })
    if (statement.importClause?.isTypeOnly) return
    const specifier = (statement.moduleSpecifier as ts.StringLiteral).text
    const moduleName = `__module${bindings.length}`
    bindings.push(`const ${moduleName} = window.__assetModules[${JSON.stringify(specifier)}];`)
    const clause = statement.importClause
    if (!clause) return
    if (clause.name) bindings.push(`const ${clause.name.text} = ${moduleName}.default;`)
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      clause.namedBindings.elements.filter(item => !item.isTypeOnly).forEach(item => {
        bindings.push(`const ${item.name.text} = ${moduleName}[${JSON.stringify(item.propertyName?.text ?? item.name.text)}];`)
      })
    }
  })
  let source = readFileSync(filePath, 'utf8')
  removals.sort((a, b) => b.start - a.start).forEach(range => { source = `${source.slice(0, range.start)}${source.slice(range.end)}` })
  source = source.replace(/^'use client'\s*/, '').replace(/\bexport\s+(?=(?:async\s+)?(?:function|const|class|interface|type)\b)/g, '')
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React } }).outputText
  const reactBinding = bindings.some(binding => /const React\s*=/.test(binding)) ? '' : 'const React = window.React;'
  const expose = exports.map(exportName => `${JSON.stringify(exportName)}: ${exportName}`).join(', ')
  return `(() => { ${bindings.join('\n')}\n${reactBinding}\n${compiled}\nwindow.__assetExports[${JSON.stringify(name)}] = { ${expose} }; })()`
}

function cssRule(source: string, selector: string): string {
  const start = source.indexOf(selector)
  if (start < 0) throw new Error(`Could not find CSS rule ${selector}`)
  const open = source.indexOf('{', start)
  let depth = 0
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] === '}' && --depth === 0) return source.slice(start, index + 1)
  }
  throw new Error(`Could not parse CSS rule ${selector}`)
}

async function mountAssetsDemo(page: Page) {
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('data:text/html,<html><body><div id="root"></div></body></html>')
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: `
    window.__assetModules = {}; window.__assetExports = {}; window.__assetApiRequests = []; window.__assetHookEnabled = null;
    const React = window.React; const noop = () => {};
    const proxy = new Proxy({}, { get: (_target, key) => String(key) });
    window.__assetModules['react'] = { default: React, ...React };
    window.__assetModules['next/navigation'] = { useRouter: () => ({ refresh: noop }) };
    window.__assetModules['swr'] = { mutate: async () => undefined };
    window.__assetModules['@/lib/toast/toast'] = { useToast: () => ({ toast: { success: noop, error: noop } }) };
    window.__assetModules['@/lib/hooks/useModules'] = { useAssets: (_filters, enabled = true) => { window.__assetHookEnabled = enabled; return { assets: [], isLoading: false, error: null, refetch: async () => [] }; } };
    window.__assetModules['@/lib/contracts/ui.contracts'] = { formatCurrency: (amount, currency) => (currency === 'USD' ? '$' : 'S/') + Number(amount).toFixed(2), formatDateLabel: value => String(value) };
    window.__assetModules['@/components/ui/AnchoredActionMenu'] = { AnchoredActionMenu: () => null };
    window.__assetModules['@/components/ui/AppSelect'] = { AppSelect: ({ options, value, onChange, testId }) => React.createElement('select', { 'data-testid': testId, value, onChange: event => onChange(event.target.value) }, options.map(option => React.createElement('option', { key: option.value, value: option.value }, option.label))) };
    window.__assetModules['@/components/ui/Button'] = { Button: ({ children, testId, onClick, ...props }) => React.createElement('button', { ...props, 'data-testid': testId, onClick }, children) };
    window.__assetModules['@/components/ui/CreateModuleButton'] = { CreateModuleButton: () => React.createElement('button', null, 'Registrar activo') };
    window.__assetModules['@/components/ui/NumericInput'] = { NumericInput: () => React.createElement('input') };
    window.__assetModules['@/components/ui/RecordModal'] = { RecordModal: ({ open, children, title, testId }) => open ? React.createElement('div', { role: 'dialog', 'aria-label': title, 'data-testid': testId }, children) : null };
    window.__assetModules['@/components/forms/primitives'] = { FormActions: ({ children, primaryAction, secondaryAction }) => React.createElement('div', null, children, secondaryAction, primaryAction), FormField: ({ children }) => React.createElement('div', null, children), FormSection: ({ children }) => React.createElement('section', null, children) };
    window.__assetModules['@/components/finance'] = {
      ConfirmDialog: () => null, DataErrorBanner: () => null,
      DataSearchField: ({ value, onChange, testId, ...props }) => React.createElement('input', { ...props, value, 'data-testid': testId, onChange: event => onChange(event.target.value) }),
      EmptyState: ({ title, action }) => React.createElement('div', null, title, action ? React.createElement('button', { onClick: action.onClick }, action.label) : null),
      PageLayout: ({ children, className }) => React.createElement('main', { className }, children),
    };
    window.__assetModules['@/lib/api/error-message'] = { getApiErrorMessage: (_json, fallback) => fallback };
    window.__assetModules['@/lib/utils/numeric-input'] = { parseNumericInput: value => Number(value), roundToDecimals: value => value };
    window.__assetModules['@/components/tables/TransactionsRound07.module.css'] = { default: proxy };
    window.__assetModules['./AssetsListPanel.module.css'] = { default: proxy };
    window.__assetModules['next/link'] = { default: ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children) };
    window.fetch = async (input) => { window.__assetApiRequests.push(String(input)); throw new Error('Unexpected API request in demo harness'); };
  ` })
  await page.addScriptTag({ content: compileComponent('modules/assets/asset-presentation.ts', 'asset-presentation', ['getAssetStatusPresentation', 'getAssetPurchaseValue', 'getAssetTypePresentation', 'getRecordedAssetValue', 'matchesAssetStatusFilter', 'summarizeActiveAssetValues']) })
  await page.addScriptTag({ content: `window.__assetModules['@/modules/assets/asset-presentation'] = window.__assetExports['asset-presentation'];` })
  await page.addScriptTag({ content: compileComponent('modules/assets/demo-assets.ts', 'demo-assets', ['isAssetsDemoAllowed', 'ASSETS_DEMO_FIXTURES', 'ASSETS_DEMO_TYPES']) })
  await page.addScriptTag({ content: `window.__assetModules['@/modules/assets/demo-assets'] = window.__assetExports['demo-assets']; window.__assetFixtures = window.__assetExports['demo-assets'].ASSETS_DEMO_FIXTURES; window.__assetTypes = window.__assetExports['demo-assets'].ASSETS_DEMO_TYPES;` })
  await page.addScriptTag({ content: compileComponent('components/assets/AssetRecordContent.tsx', 'AssetRecordContent') })
  await page.addScriptTag({ content: `window.__assetModules['@/components/assets/AssetRecordContent'] = window.__assetExports.AssetRecordContent;` })
  await page.addScriptTag({ content: compileComponent('components/assets/AssetsListPanel.tsx', 'AssetsListPanel') })
  await page.addScriptTag({ content: `window.__assetModules['@/components/assets/AssetsListPanel'] = window.__assetExports.AssetsListPanel; const root = window.ReactDOM.createRoot(document.getElementById('root')); window.__assetRoot = root; root.render(window.React.createElement(window.__assetExports.AssetsListPanel.AssetsListPanel, { onCreate: () => {}, demoMode: true, demoAssets: window.__assetFixtures, demoTypes: window.__assetTypes }));` })

  const sharedCss = readFileSync(join(process.cwd(), 'components/tables/TransactionsRound07.module.css'), 'utf8')
  const localCss = readFileSync(join(process.cwd(), 'components/assets/AssetsListPanel.module.css'), 'utf8')
  await page.addStyleTag({ content: [
    ':root { --ft-r07-line:#dce1e5; --ft-primary:#155e59; --ft-text-strong:#242a30; --ft-text-muted:#59636d; --ft-border:#dce1e5; --ft-surface:#fff; --ft-surface-muted:#f2f4f5; --ft-primary-soft:#e8f1ee; --ft-warning:#7c601f; --ft-warning-soft:#f6efdc; --ft-danger:#ad4545; --ft-danger-soft:#f9eeee; } body { font-family:Manrope,system-ui,sans-serif; margin:24px; }',
    cssRule(sharedCss, '.tabs {'), cssRule(sharedCss, '.tabs button {'),
    cssRule(localCss, '.tabs {'), cssRule(localCss, '.tab {'), cssRule(localCss, '.tab:hover {'),
    cssRule(localCss, ".tab[data-active='true'] {"), cssRule(localCss, ".tab[data-active='true']::after {"),
  ].join('\n') })
  await expect(page.getByTestId('assets-demo-banner')).toBeVisible().catch(() => {
    throw new Error(`AssetsListPanel demo did not mount: ${pageErrors.join(' | ') || 'no browser exception captured'}`)
  })
}

test('real AssetsListPanel demo uses separated tabs, full-width divider and no data API or mutation actions', async ({ page }) => {
  await mountAssetsDemo(page)
  expect(await page.evaluate(() => window.__assetHookEnabled)).toBe(false)
  expect(await page.evaluate(() => window.__assetApiRequests)).toEqual([])
  await expect(page.getByTestId('assets-create-button')).toHaveCount(0)
  await expect(page.getByTestId('asset-edit-demo-asset-macbook')).toHaveCount(0)
  await expect(page.getByTestId('asset-delete-demo-asset-macbook')).toHaveCount(0)

  for (const width of [390, 834, 1440, 1710]) {
    await page.setViewportSize({ width, height: 1000 })
    const nav = page.getByTestId('assets-status-tabs')
    await expect(nav).toHaveCSS('display', 'flex')
    await expect(nav).toHaveCSS('gap', '24px')
    const geometry = await nav.evaluate(element => {
      const navRect = element.getBoundingClientRect()
      const buttons = [...element.querySelectorAll('button')].map(button => button.getBoundingClientRect())
      const style = getComputedStyle(element)
      return { navWidth: navRect.width, borderBottomWidth: style.borderBottomWidth, firstGap: buttons.at(1)!.left - buttons.at(0)!.right, documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }
    })
    expect(geometry.borderBottomWidth).toBe('1px')
    expect(geometry.firstGap).toBeGreaterThanOrEqual(24)
    expect(geometry.documentOverflow).toBeLessThanOrEqual(1)
    expect(Math.abs(geometry.navWidth - (width - 48))).toBeLessThanOrEqual(1)
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.screenshot({ path: '/tmp/fintrack-assets-r2-tabs-chromium.png', fullPage: true })

  await page.getByRole('button', { name: 'Todos' }).click()
  await expect(page.locator('[data-testid^="asset-row-demo-asset-"]')).toHaveCount(6)
  await page.getByTestId('asset-view-action-demo-asset-macbook').click()
  await expect(page.getByTestId('assets-detail-modal')).toBeVisible()
  await expect(page.getByText('Registro ficticio de demostración.', { exact: false })).toBeVisible()
  expect(await page.evaluate(() => window.__assetApiRequests)).toEqual([])
})
