import { expect, test } from '@playwright/test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

const reactPath = join(process.cwd(), 'node_modules/react/umd/react.development.js')
const reactDomPath = join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js')

function compileComponent(path: string, moduleId: string, exportName: string, registryName = '__receivablesModules') {
  const file = join(process.cwd(), path)
  const parsed = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const removals: Array<{ start: number; end: number }> = []
  const bindings: string[] = []
  parsed.statements.forEach(statement => {
    if (!ts.isImportDeclaration(statement)) return
    removals.push({ start: statement.getStart(parsed), end: statement.end })
    if (!statement.importClause || statement.importClause.isTypeOnly) return
    const source = (statement.moduleSpecifier as ts.StringLiteral).text
    const local = `__receivablesImport${bindings.length}`
    bindings.push(`const ${local} = window.${registryName}[${JSON.stringify(source)}] || {};`)
    const clause = statement.importClause
    if (clause.name) bindings.push(`const ${clause.name.text} = ${local}.default;`)
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) clause.namedBindings.elements.filter(item => !item.isTypeOnly).forEach(item => {
      const imported = item.propertyName?.text ?? item.name.text
      bindings.push(`const ${item.name.text} = ${local}[${JSON.stringify(imported)}];`)
    })
  })
  let source = parsed.text
  removals.sort((a, b) => b.start - a.start).forEach(range => { source = `${source.slice(0, range.start)}${source.slice(range.end)}` })
  source = source.replace(/^'use client'\s*/, '').replace(/\bexport\s+(?=(?:async\s+)?(?:function|const|class|interface|type)\b)/g, '')
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React } }).outputText.replace(/^export\s*\{\s*\};?\s*$/gm, '')
  return `(() => { const React = window.React; ${bindings.join('\n')}\n${compiled}\nwindow.${registryName}[${JSON.stringify(moduleId)}] = { ...(window.${registryName}[${JSON.stringify(moduleId)}] || {}), ${exportName} }; })();`
}

function cssModuleMap(css: string, sourcePath: string, prefix: string) {
  const names = new Set(readFileSync(join(process.cwd(), sourcePath), 'utf8').match(/\.([A-Za-z][\w-]*)/g)?.map(name => name.slice(1)) ?? [])
  return Object.fromEntries(Array.from(names, name => [name, css.match(new RegExp(`\\.(${prefix}_${name}__[\\w-]+)`))?.[1] ?? name]))
}

test('real ReceivablesManager shares the V3 header, full-width dividers and external filter row at desktop and mobile', async ({ page }) => {
  page.on('pageerror', error => console.info('Receivables manager browser error:', error.stack ?? error.message))
  const cssRoot = join(process.cwd(), '.next/static/css')
  const css = readdirSync(cssRoot).filter(file => file.endsWith('.css')).sort().map(file => readFileSync(join(cssRoot, file), 'utf8')).join('\n')
  const managerClasses = cssModuleMap(css, 'components/receivables/ReceivablesManager.module.css', 'ReceivablesManager')
  const debtorDetailClasses = cssModuleMap(css, 'components/receivables/DebtorDetail.module.css', 'DebtorDetail')
  const movementClasses = cssModuleMap(css, 'components/tables/TransactionsRound07.module.css', 'TransactionsRound07')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.setContent('<div id="root" data-ft-v3></div>')
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: `window.__receivablesModules={}; window.React=React;
    window.__receivablesModules.react=React; window.__receivablesModules['react-dom']={createPortal:ReactDOM.createPortal};
    window.__receivablesModules['next/navigation']={usePathname:()=>'/receivables',useRouter:()=>({replace:()=>{}}),useSearchParams:()=>new URLSearchParams()};
    window.__receivablesModules['next/link']={default:({href,children,...props})=>React.createElement('a',{...props,href},children)};
    window.__receivablesModules['@/components/ui/AnchoredActionMenu']={AnchoredActionMenu:()=>null};
    window.__receivablesModules['@/components/ui/RecordModal']={RecordModal:({open,testId,footer,footerClassName,children,title})=>open?React.createElement('div',{'data-testid':testId,'data-has-footer':String(Boolean(footer)),'data-has-footer-class':String(Boolean(footerClassName))},React.createElement('h2',null,title),footer,children):null};
    window.__receivablesModules['@/components/finance']={ConfirmDialog:()=>null,DataErrorBanner:()=>null,DataSearchField:({value,onChange,className,...props})=>React.createElement('div',{className},React.createElement('input',{value,onChange:event=>onChange(event.target.value),...props,className:'h-9 w-full rounded-control border border-[var(--ft-border)] bg-[var(--ft-surface)] pl-3 pr-3 text-[13px]'})),EmptyState:({title})=>React.createElement('p',null,title),PageLayout:({children,className})=>React.createElement('main',{className:'ft-shell-content '+className},children)};
    window.__receivablesModules['@/components/finance']={ConfirmDialog:()=>null,DataErrorBanner:()=>null,DataSearchField:({value,onChange,className,...props})=>React.createElement('div',{className},React.createElement('input',{value,onChange:event=>onChange(event.target.value),...props,className:'h-9 w-full rounded-control border border-[var(--ft-border)] bg-[var(--ft-surface)] pl-3 pr-3 text-[13px]'})),EmptyState:({title})=>React.createElement('p',null,title),PageLayout:({children,className})=>React.createElement('main',{className:'ft-shell-content '+className},children)};
    window.__receivablesModules['@/lib/api/error-message']={getApiErrorMessage:(_json,fallback)=>fallback};
    const debtorFixture={id:'debtor-1',name:'Lucía Andina',relationship:'Cliente',initial_debt:0,is_active:true,total_lent:2000,total_collected:800,pending_amount:1200,progress_pct:40,all_collected:false,count_pending:1,receivables_count:1,currency_summaries:[{currency:'PEN',total:2000,settled:800,pending:1200,recordCount:1,openRecordCount:1}],unverified_currency_records:0,unverified_open_currency_records:0,has_unverified_initial_debt:false};
    const receivableFixture={id:'r-1',debtor_id:'debtor-1',amount:2000,collected_amount:800,status:'PARTIAL',due_date:'2026-11-02'};
    window.__receivablesModules['@/lib/client/fetch-with-timeout']={fetchWithTimeout:async url=>({ok:true,json:async()=>({ok:true,data:String(url).includes('/api/debtors')?[debtorFixture]:String(url).includes('/api/receivables')?[receivableFixture]:[]})})};
    window.__receivablesModules['@/lib/toast/toast']={useToast:()=>({toast:{success:()=>{},error:()=>{}}})};
    window.__receivablesModules['@/lib/contracts/ui.contracts']={formatCurrency:(value,currency)=>currency==='USD'?'$'+Number(value).toFixed(2):'S/ '+Number(value).toFixed(2)};
    window.__receivablesModules['@/modules/obligations/obligation-currency-presentation']={combineObligationCurrencyBreakdowns:()=>({summaries:[{currency:'PEN',pending:0,openRecordCount:0}],unverifiedRecordCount:0,unverifiedOpenRecordCount:0})};
    window.__receivablesModules['@/modules/receivables/receivables-list-presentation']={countReceivablesDueWithinDays:()=>0,getDebtorDueSummary:()=>({date:null,overdue:false,openWithDateCount:0,openWithoutDateCount:0}),getReceivablePersonState:()=> 'OPEN',hasVerifiedOpenReceivable:()=>false,getReceivableRecoveryProgress:summaries=>({available:true,items:summaries.map(summary=>({currency:summary.currency,percent:Math.round(summary.settled/summary.total*1000)/10}))})};
    window.__receivablesModules['./DebtorDetail']={DebtorDetail:()=>null};
    window.__receivablesModules['./DebtorDetail.module.css']={default:${JSON.stringify(debtorDetailClasses)}};
    window.__receivablesModules['./DebtorForm']={DebtorForm:()=>null};
    window.__receivablesModules['./ReceivableForm']={ReceivableForm:()=>null};
    window.__receivablesModules['./ReceivablesManager.module.css']={default:${JSON.stringify(managerClasses)}};
    window.__receivablesModules['@/components/tables/TransactionsRound07.module.css']={default:${JSON.stringify(movementClasses)}};` })
  await page.addScriptTag({ content: compileComponent('components/ui/Button.tsx', '@/components/ui/Button', 'Button') })
  await page.addScriptTag({ content: compileComponent('components/ui/AppSelect.tsx', '@/components/ui/AppSelect', 'AppSelect') })
  await page.addScriptTag({ content: compileComponent('components/finance/data-table.tsx', '@/components/finance/data-table', 'DataSearchField') })
  await page.evaluate(() => {
    const finance = (window as any).__receivablesModules['@/components/finance']
    finance.DataSearchField = (window as any).__receivablesModules['@/components/finance/data-table'].DataSearchField
  })
  await page.addScriptTag({ content: compileComponent('components/ui/CreateModuleButton.tsx', '@/components/ui/CreateModuleButton', 'CreateModuleButton') })
  await page.addScriptTag({ content: compileComponent('components/receivables/ReceivablesManager.tsx', '@/components/receivables/ReceivablesManager', 'ReceivablesManager') })
  await page.addScriptTag({ content: `ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(window.__receivablesModules['@/components/receivables/ReceivablesManager'].ReceivablesManager));` })

  await expect(page.getByRole('heading', { name: 'Por cobrar' })).toBeVisible()
  await expect(page.getByTestId('receivables-status-tabs')).toBeVisible()
  await expect(page.getByTestId('receivables-filter-toolbar')).toBeVisible()
  await expect(page.getByTestId('receivables-new-debtor-btn')).toBeVisible()
  await expect(page.getByTestId('receivables-create-button')).toHaveAttribute('href', '/transactions?new=transaction&module=receivable&type=EXPENSE')
  await expect(page.getByTestId('receivables-create-modal')).toHaveCount(0)
  await expect(page.getByText('RECUPERACIÓN')).toBeVisible()
  await expect(page.getByTestId('receivables-recovery-debtor-1').first()).toContainText('40.0%')
  await expect(page.getByTestId('receivables-view-toggle')).toHaveCount(0)
  await page.getByRole('button', { name: 'Ver cuenta' }).first().click()
  const debtorWorkbench = page.getByTestId('receivables-debtor-detail-modal')
  await expect(debtorWorkbench).toBeVisible()
  await expect(debtorWorkbench).toHaveAttribute('data-has-footer', 'false')
  await expect(debtorWorkbench).toHaveAttribute('data-has-footer-class', 'false')
  await expect(debtorWorkbench.getByRole('link', { name: 'Nueva cuenta por cobrar' })).toHaveCount(0)
  const desktop = await page.evaluate(() => {
    const box = (selector: string) => {
      const element = document.querySelector(selector)!
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height), borderBottom: style.borderBottomWidth, font: style.fontFamily }
    }
    const cta = document.querySelector('[data-testid="receivables-create-button"]')!
    const ctaRect = cta.getBoundingClientRect()
    return {
      heading: box('[data-testid="receivables-page-overview"] h1'),
      summary: box('[aria-label="Resumen de cuentas por cobrar"]'),
      tabs: box('[data-testid="receivables-status-tabs"]'),
      toolbar: box('[data-testid="receivables-filter-toolbar"]'),
      content: box('[data-testid="receivables-register"]'),
      cta: { x: Math.round(ctaRect.x), y: Math.round(ctaRect.y), width: Math.round(ctaRect.width), height: Math.round(ctaRect.height), fontFamily: getComputedStyle(cta).fontFamily, fontSize: getComputedStyle(cta).fontSize, fontWeight: getComputedStyle(cta).fontWeight, lineHeight: getComputedStyle(cta).lineHeight, letterSpacing: getComputedStyle(cta).letterSpacing, gap: getComputedStyle(cta).columnGap, paddingLeft: getComputedStyle(cta).paddingLeft },
      secondaryCta: (() => {
        const button = document.querySelector('[data-testid="receivables-new-debtor-btn"]')!
        const rect = button.getBoundingClientRect()
        const label = button.querySelector('span')!
        return {
          x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height),
          iconBeforeLabel: button.children[0]?.tagName.toLowerCase() === 'svg' && button.children[1]?.tagName.toLowerCase() === 'span',
          labelLines: Math.round(label.getBoundingClientRect().height / parseFloat(getComputedStyle(label).lineHeight)),
          fontFamily: getComputedStyle(label).fontFamily,
          fontSize: getComputedStyle(label).fontSize,
          fontWeight: getComputedStyle(label).fontWeight,
          lineHeight: getComputedStyle(label).lineHeight,
          letterSpacing: getComputedStyle(button).letterSpacing,
          gap: getComputedStyle(button).columnGap,
          paddingLeft: getComputedStyle(button).paddingLeft,
        }
      })(),
      toolbarControls: Array.from(document.querySelector('[data-testid="receivables-filter-toolbar"]')!.querySelectorAll(':scope > div > *')).map(element => {
        const rect = element.getBoundingClientRect()
        return { x: Math.round(rect.x), y: Math.round(rect.y), right: Math.round(rect.right), bottom: Math.round(rect.bottom) }
      }),
      searchBorder: getComputedStyle(document.querySelector('[data-testid="receivables-search"]')!).borderWidth,
      searchWrapperBorder: getComputedStyle(document.querySelector('[data-testid="receivables-search"]')!.parentElement!.parentElement!).borderWidth,
      searchIconGap: (() => {
        const input = document.querySelector('[data-testid="receivables-search"]')!.getBoundingClientRect()
        const icon = document.querySelector('[data-testid="receivables-search"]')!.parentElement!.querySelector('svg')!.getBoundingClientRect()
        return Math.round(input.left - icon.right)
      })(),
    }
  })
  console.info('Receivables desktop geometry:', JSON.stringify(desktop))
  expect(desktop.cta.width).toBeLessThan(360)
  expect(desktop.cta.height).toBe(36)
  expect(desktop.secondaryCta.height).toBe(desktop.cta.height)
  expect(desktop.secondaryCta.y).toBe(desktop.cta.y)
  expect(desktop.secondaryCta.iconBeforeLabel).toBe(true)
  expect(desktop.secondaryCta.labelLines).toBe(1)
  expect(desktop.secondaryCta.fontFamily).toBe(desktop.cta.fontFamily)
  expect(desktop.secondaryCta.fontSize).toBe(desktop.cta.fontSize)
  expect(desktop.secondaryCta.fontWeight).toBe(desktop.cta.fontWeight)
  expect(desktop.secondaryCta.paddingLeft).toBe(desktop.cta.paddingLeft)
  expect(desktop.summary.width).toBe(desktop.tabs.width)
  expect(desktop.tabs.width).toBe(desktop.toolbar.width)
  expect(desktop.summary.borderBottom).toBe('1px')
  expect(desktop.tabs.borderBottom).toBe('1px')
  expect(desktop.heading.font.toLowerCase()).toContain('manrope')
  expect(desktop.tabs.y).toBeGreaterThan(desktop.summary.y)
  expect(desktop.toolbar.y).toBeGreaterThan(desktop.tabs.y)
  expect(desktop.content.y).toBeGreaterThan(desktop.toolbar.y)
  expect(desktop.searchBorder).toBe('0px')
  expect(desktop.searchWrapperBorder).toBe('1px')
  expect(desktop.searchIconGap).toBeGreaterThanOrEqual(6)
  expect(desktop.toolbarControls[0]!.right).toBeLessThanOrEqual(desktop.toolbarControls[1]!.x + 1)

  await page.getByTestId('receivables-sort-filter').click()
  await expect(page.locator('.app-select-menu')).toBeVisible()
  const menuGeometry = await page.evaluate(() => {
    const trigger = document.querySelector('[data-testid="receivables-sort-filter"]')!.getBoundingClientRect()
    const menu = document.querySelector('.app-select-menu')!.getBoundingClientRect()
    return { trigger: trigger.width, menu: menu.width, leftDelta: Math.abs(trigger.left - menu.left) }
  })
  expect(Math.abs(menuGeometry.trigger - menuGeometry.menu)).toBeLessThanOrEqual(2)
  expect(menuGeometry.leftDelta).toBeLessThanOrEqual(2)
  await page.keyboard.press('Escape')

  for (const width of [834, 1710]) {
    await page.setViewportSize({ width, height: 900 })
    const responsive = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      toolbar: document.querySelector('[data-testid="receivables-filter-toolbar"]')!.getBoundingClientRect().width,
    }))
    expect(responsive.document).toBeLessThanOrEqual(responsive.viewport)
    expect(responsive.toolbar).toBeGreaterThan(0)
    if (width === 834) {
      await expect(page.locator('[data-testid="receivable-person-mobile-debtor-1"] [data-testid="receivables-recovery-debtor-1"]')).toBeVisible()
    }
  }

  await page.setViewportSize({ width: 390, height: 844 })
  const mobile = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    tabsClient: document.querySelector('[data-testid="receivables-status-tabs"]')!.clientWidth,
    tabsScroll: document.querySelector('[data-testid="receivables-status-tabs"]')!.scrollWidth,
    toolbarClient: document.querySelector('[data-testid="receivables-filter-toolbar"]')!.clientWidth,
    toolbarScroll: document.querySelector('[data-testid="receivables-filter-toolbar"]')!.scrollWidth,
  }))
  console.info('Receivables mobile overflow:', JSON.stringify(mobile))
  expect(mobile.document).toBeLessThanOrEqual(mobile.viewport)
  expect(mobile.tabsScroll).toBeGreaterThanOrEqual(mobile.tabsClient)
  expect(mobile.toolbarScroll).toBeLessThanOrEqual(mobile.toolbarClient)
  await expect(page.locator('[data-testid="receivable-person-mobile-debtor-1"] [data-testid="receivables-recovery-debtor-1"]')).toBeVisible()
  const mobileControls = await page.evaluate(() => Array.from(document.querySelector('[data-testid="receivables-filter-toolbar"]')!.querySelectorAll(':scope > div > *')).map(element => {
    const rect = element.getBoundingClientRect()
    return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom }
  }))
  expect(mobileControls[0]!.bottom).toBeLessThanOrEqual(mobileControls[1]!.y)
})
