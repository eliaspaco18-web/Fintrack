import { expect, test } from '@playwright/test'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { deriveCreditDisplayType, type CreditListItem } from '@/lib/credits/display-type'
import { summarizeCredits } from '@/lib/credits/overview'
import type { Credit } from '@/types/database.types'
import type { Page } from '@playwright/test'
import * as ts from 'typescript'

function compileCreditsModule(relativePath: string, moduleId: string, exportNames: string[]) {
  const path = resolve(process.cwd(), relativePath)
  const sourceFile = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const bindings: string[] = []
  const removals: Array<{ start: number; end: number }> = []
  sourceFile.statements.forEach(statement => {
    if (!ts.isImportDeclaration(statement)) return
    removals.push({ start: statement.getStart(sourceFile), end: statement.end })
    if (statement.importClause?.isTypeOnly) return
    const specifier = (statement.moduleSpecifier as ts.StringLiteral).text
    const local = `__creditsModuleImport${bindings.length}`
    bindings.push(`const ${local} = window.__creditsListModules[${JSON.stringify(specifier)}] || {};`)
    const clause = statement.importClause
    if (!clause) return
    if (clause.name) bindings.push(`const ${clause.name.text} = ${local}.default;`)
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      clause.namedBindings.elements.filter(item => !item.isTypeOnly).forEach(item => {
        const imported = item.propertyName?.text ?? item.name.text
        bindings.push(`const ${item.name.text} = ${local}[${JSON.stringify(imported)}];`)
      })
    }
  })
  let source = sourceFile.text
  removals.sort((a, b) => b.start - a.start).forEach(range => { source = `${source.slice(0, range.start)}${source.slice(range.end)}` })
  source = source.replace(/^'use client'\s*/, '').replace(/\bexport\s+(?=(?:async\s+)?(?:function|const|class|interface|type)\b)/g, '')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React },
  }).outputText.replace(/^export\s*\{\s*\};?\s*$/gm, '')
  const exports = exportNames.map(name => `${JSON.stringify(name)}:${name}`).join(',')
  return `(() => { const React = window.React; ${bindings.join('\n')}\n${compiled}\nwindow.__creditsListModules[${JSON.stringify(moduleId)}] = {${exports}}; })();`
}

const compileCreditsListPanel = () => compileCreditsModule('components/credits/CreditsListPanel.tsx', '@/components/credits/CreditsListPanel', ['CreditsListPanel'])

async function mountRealCreditsList(page: Page, count: number, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport)
  await page.setContent('<div class="fin-shell" data-ft-v3-shell data-ft-v3><div id="root"></div></div>')
  const cssPath = resolve(process.cwd(), '.next/static/css')
  const cssFiles = readdirSync(cssPath).filter(file => file.endsWith('.css')).sort()
  if (!cssFiles.length) throw new Error('The compiled FinTrack V3 stylesheet is required for the real component harness.')
  const css = cssFiles.map(file => readFileSync(resolve(cssPath, file), 'utf8')).join('\n')
  const classMap = (file: string) => {
    const source = readFileSync(resolve(process.cwd(), file), 'utf8')
    return Object.fromEntries(Array.from(source.matchAll(/styles\.([\w]+)/g), match => match[1]).map(name => [name, css.match(new RegExp(`\\.CreditsListPanel_${name}__[\\w-]+`))?.[0]?.slice(1) ?? name]))
  }
  const moduleClasses = classMap('components/credits/CreditsListPanel.tsx')
  const pageClasses = Object.fromEntries(['pageOverview', 'v3ModulePrimaryAction', 'summary', 'summaryItem', 'summaryValue', 'tabs', 'controls', 'portfolioFilterBar', 'portfolioControls', 'controlsMain', 'searchControl', 'controlsActions'].map(name => [name, css.match(new RegExp(`\\.TransactionsRound07_${name}__[\\w-]+`))?.[0]?.slice(1) ?? name]))
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ path: resolve(process.cwd(), 'node_modules/react/umd/react.development.js') })
  await page.addScriptTag({ path: resolve(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js') })
  await page.addScriptTag({ content: `(() => {
    const React = window.React;
    window.__creditsListModules = {};
    const record = (id, type, currency) => ({id,user_id:'synthetic',account_id:null,bank_entity_id:'bank-1',transaction_id:null,credit_type:type,name:(type==='CREDIT_CARD'?'Tarjeta':type==='LOAN'?'Préstamo':'Línea')+' '+id,currency,credit_limit:currency==='PEN'?1200:300,credit_limit_pen:currency==='PEN'?1200:0,credit_limit_usd:currency==='USD'?300:0,used_amount:currency==='PEN'?800:120,used_amount_pen:currency==='PEN'?800:0,used_amount_usd:currency==='USD'?120:0,initial_used_amount_pen:0,initial_used_amount_usd:0,available_amount:400,interest_rate:0,closing_day:20,payment_day:type==='CREDIT_CARD'?14:null,status:'ACTIVE',notes:null,created_at:'2026-01-01T00:00:00Z',updated_at:'2026-01-01T00:00:00Z',display_type:type==='CREDIT_CARD'?'CARD':type==='LOAN'?'LOAN':'LINE',has_loan:type==='LOAN',bank_entity:{id:'bank-1',name:'Banco Andino Round 07',short_name:'Banco Andino'},account:{id:'account-1',name:'Cuenta principal'}});
    window.__creditsListFixtures = Array.from({length:${count}}, (_, index) => record('item-'+index, index % 3 === 0 ? 'CREDIT_CARD' : index % 3 === 1 ? 'LINE_OF_CREDIT' : 'LOAN', index % 2 === 0 ? 'PEN' : 'USD'));
    const cls = ${JSON.stringify(moduleClasses)};
    const el = (tag, props, children) => React.createElement(tag, props, children);
    window.__creditsListModules['react'] = React;
    window.__creditsListModules['react-dom'] = {createPortal:ReactDOM.createPortal};
    window.__creditsListModules['next/navigation'] = { useRouter: () => ({refresh(){}}) };
    window.__creditsListModules['swr'] = { mutate: async () => {} };
    window.__creditsListModules['@/lib/credits/display-type'] = { getCreditDisplayLabel: type => ({CARD:'Tarjeta',LOAN:'Préstamo',LINE:'Línea'})[type], getCreditDisplayTone: () => 'muted' };
    window.__creditsListModules['@/lib/toast/toast'] = { useToast: () => ({toast:{success(){},error(){}}}) };
    window.__creditsListModules['@/lib/hooks/useModules'] = { useCredits: () => ({credits:window.__creditsListFixtures,isLoading:false,error:null,refetch:async()=>{}}) };
    window.__creditsListModules['@/lib/contracts/ui.contracts'] = { formatCurrency: (amount,currency) => currency+' '+Number(amount).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) };
    window.__creditsListModules['@/components/ui/ActionIconButton'] = { ActionIconButton: ({label,testId,href,onClick}) => href ? el('a',{href,'aria-label':label,'data-testid':testId},'◉') : el('button',{type:'button','aria-label':label,'data-testid':testId,onClick},'◉') };
    window.__creditsListModules['@/components/ui/AppSelect'] = { AppSelect: ({ariaLabel,className,value}) => el('button',{type:'button','aria-label':ariaLabel,className},value) };
    window.__creditsListModules['@/components/ui/Button'] = { Button: ({children,...props}) => el('button',props,children) };
    window.__creditsListModules['@/components/ui/CreateModuleButton'] = { CreateModuleButton: ({label,className}) => el('button',{className},label) };
    window.__creditsListModules['@/components/ui/RecordModal'] = { RecordModal: () => null, RecordModalFooter: ({children}) => children };
    window.__creditsListModules['@/components/ui/ViewToggle'] = { ViewToggle: () => el('div',{'data-testid':'view-toggle'},'Lista Tarjetas') };
    window.__creditsListModules['@/components/forms/primitives'] = { FormActions: ({secondaryAction,primaryAction}) => el('div',null,[secondaryAction,primaryAction]), FormField: ({label,children}) => el('label',null,[label,children]), FormSection: ({children}) => el('section',null,children) };
    window.__creditsListModules['@/components/credits/CreditCardForm'] = { CreditCardForm: () => null };
    window.__creditsListModules['@/components/credits/BankLoanForm'] = { BankLoanForm: () => null };
    window.__creditsListModules['@/components/credits/LoanDetailsModal'] = { LoanDetailsModal: () => null };
    window.__creditsListModules['@/components/finance'] = { ConfirmDialog: () => null, DataErrorBanner: () => null, DataSearchField: ({value,onChange,placeholder,...props}) => el('input',{value,placeholder,onChange:event=>onChange(event.target.value),...props}), DataTable: ({children,className}) => el('div',{className},children), EmptyState: () => null, StatusBadge: ({children}) => el('span',null,children) };
    window.__creditsListModules['@/lib/api/error-message'] = { getApiErrorMessage: (_json,fallback) => fallback };
    window.__creditsListModules['@/lib/credits/overview'] = { summarizeCredits: credits => ({activeCount:credits.length,closedCount:0,activeCardCount:credits.filter(c=>c.display_type==='CARD').length,cardDebt:{PEN:800,USD:120},activeCardCurrencyCount:{PEN:1,USD:1},activeLoanCount:credits.filter(c=>c.display_type==='LOAN').length,verifiedLoanCapital:{PEN:0,USD:0},verifiedLoanCountByCurrency:{PEN:0,USD:0},unavailableLoanCapitalCount:0,activeLineCount:credits.filter(c=>c.display_type==='LINE').length}) };
    window.__creditsListModules['@/modules/credits/credit-detail-presentation'] = { getCreditDetailPresentation: credit => ({currency:credit.currency,availability:{status:'AVAILABLE',used:Number(credit.used_amount),limit:Number(credit.credit_limit),amount:Number(credit.available_amount)}}) };
    window.__creditsListModules['@/types/database.types'] = {};
    window.__creditsListModules['@/components/tables/TransactionsRound07.module.css'] = {default:${JSON.stringify(pageClasses)}};
    window.__creditsListModules['./CreditsListPanel.module.css'] = {default:cls};
    window.__creditsListModules['./CreditsWorkbench.module.css'] = {default:{}};
    window.fetch = async () => ({ok:true,json:async()=>({ok:true,data:[{id:'bank-1',name:'Banco Andino Round 07',short_name:'Banco Andino'}]})});
  })();` })
  await page.addScriptTag({ content: compileCreditsModule('components/ui/AnchoredActionMenu.tsx', '@/components/ui/AnchoredActionMenu', ['AnchoredActionMenu']) })
  await page.addScriptTag({ content: compileCreditsListPanel() })
  await page.addScriptTag({ content: `(() => { const Component=window.__creditsListModules['@/components/credits/CreditsListPanel'].CreditsListPanel; ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Component,{onCreate(){}})); })();` })
  await expect(page.getByTestId('credits-page-overview')).toBeVisible()
  await expect(page.getByTestId(`credit-row-item-0`)).toBeVisible()
}

function fixture(overrides: Partial<Credit> & Partial<Pick<CreditListItem, 'display_type' | 'has_loan'>> = {}): CreditListItem {
  const credit: Credit = {
    id: 'credit-test', user_id: 'user-test', account_id: null, bank_entity_id: null,
    transaction_id: null, credit_type: 'LINE_OF_CREDIT', name: 'Crédito de prueba',
    currency: 'PEN', credit_limit: 1000, credit_limit_pen: 1000, credit_limit_usd: 0,
    used_amount: 250, used_amount_pen: 250, used_amount_usd: 0,
    initial_used_amount_pen: 250, initial_used_amount_usd: 0, available_amount: 750,
    interest_rate: 0, closing_day: null, payment_day: null, status: 'ACTIVE', notes: null,
    created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
  return { ...credit, display_type: overrides.display_type ?? 'LINE', has_loan: overrides.has_loan ?? false }
}

test('credit classifications keep cards, linked loans and ordinary lines distinct', () => {
  expect(deriveCreditDisplayType({ creditType: 'CREDIT_CARD', hasLoan: true })).toBe('CARD')
  expect(deriveCreditDisplayType({ creditType: 'LINE_OF_CREDIT', hasLoan: true })).toBe('LOAN')
  expect(deriveCreditDisplayType({ creditType: 'LINE_OF_CREDIT', hasLoan: false })).toBe('LINE')
})

test('overview keeps card debt and verified loan capital separate by native currency', () => {
  const result = summarizeCredits([
    fixture({ id: 'card-pen', credit_type: 'CREDIT_CARD', display_type: 'CARD', used_amount: 300, used_amount_pen: 300 }),
    fixture({ id: 'card-usd', credit_type: 'CREDIT_CARD', currency: 'USD', display_type: 'CARD', used_amount: 50, used_amount_pen: 0, used_amount_usd: 50 }),
    fixture({ id: 'loan-pen', display_type: 'LOAN', has_loan: true, credit_limit: 2000, used_amount: 2000 }),
    fixture({ id: 'loan-usd', currency: 'USD', display_type: 'LOAN', has_loan: true, credit_limit: 400, used_amount: 400 }),
    fixture({ id: 'loan-unknown', currency: 'EUR', display_type: 'LOAN', has_loan: false, credit_limit: 9999 }),
    fixture({ id: 'closed-card', credit_type: 'CREDIT_CARD', display_type: 'CARD', status: 'CLOSED', used_amount_pen: 900 }),
  ])

  expect(result).toMatchObject({
    activeCount: 5,
    closedCount: 1,
    activeCardCount: 2,
    cardDebt: { PEN: 300, USD: 50 },
    activeLoanCount: 3,
    verifiedLoanCapital: { PEN: 2000, USD: 400 },
    unavailableLoanCapitalCount: 1,
  })
})

test('credits screen uses approved V3 primitives and responsive list defaults', () => {
  const source = readFileSync(resolve(process.cwd(), 'components/credits/CreditsListPanel.tsx'), 'utf8')
  const css = readFileSync(resolve(process.cwd(), 'components/credits/CreditsListPanel.module.css'), 'utf8')
  const shell = readFileSync(resolve(process.cwd(), 'components/layout/AppShell.tsx'), 'utf8')
  const workspace = readFileSync(resolve(process.cwd(), 'components/credits/CreditsWorkspace.tsx'), 'utf8')
  const loanForm = readFileSync(resolve(process.cwd(), 'components/credits/BankLoanForm.tsx'), 'utf8')
  const cardSchedule = readFileSync(resolve(process.cwd(), 'components/credits/CreditCardScheduleModal.tsx'), 'utf8')
  const loanSchedule = readFileSync(resolve(process.cwd(), 'components/credits/BankLoanScheduleModal.tsx'), 'utf8')
  const cardForm = readFileSync(resolve(process.cwd(), 'components/credits/CreditCardForm.tsx'), 'utf8')
  const workbenchCss = readFileSync(resolve(process.cwd(), 'components/credits/CreditsWorkbench.module.css'), 'utf8')
  const contextualHint = readFileSync(resolve(process.cwd(), 'components/credits/CreditInfoHint.tsx'), 'utf8')

  expect(source).toContain('pageStyles.pageOverview')
  expect(source).toContain('pageStyles.v3ModulePrimaryAction')
  expect(source).toContain('<DataTable density="credit"')
  expect(source).toContain("useState<ViewMode>('list')")
  expect(source).toContain("value: 'BLOCKED', label: 'Bloqueados'")
  expect(source).toContain('setBankFilter')
  expect(source).toContain('typeFilter !== \'all\' && credit.display_type !== typeFilter')
  expect(source).not.toMatch(/--c-[a-z-]+|font-mono/)
  expect(css).toContain('@media (max-width: 980px)')
  expect(css).toContain('prefers-reduced-motion: reduce')
  expect(shell).toContain("pathname === '/credits' || pathname.startsWith('/credits/')")
  expect(workspace).toContain('presentation="workbench"')
  expect(source).toContain('presentation="workbench"')
  expect(loanForm).toContain('<IncomeDatePicker')
  expect(cardSchedule).toContain('workbenchKind="schedule"')
  expect(loanSchedule).toContain('workbenchKind="schedule"')
  expect(source).toContain('pageStyles.controlsMain')
  expect(source).toContain('pageStyles.controlsActions')
  expect(css).toContain('min-height: 36px')
  expect(css).toContain('min-height: 72px')
  expect(css).toContain('minmax(205px, 26fr)')
  expect(css).toContain('minmax(172px, 26fr)')
  expect(css).toContain('minmax(145px, 27fr)')
  expect(cardForm).toContain('<CreditCardScheduleModal')
  expect(cardForm).not.toContain('<CreditCardScheduleEditor')
  expect(workbenchCss).toContain('min(1120px, calc(100vw - 24px))')
  expect(workbenchCss).toContain('min(1240px, calc(100vw - 24px))')
  expect(workbenchCss).toContain('@media (max-width: 767px)')
  expect(contextualHint).toContain('aria-expanded={open && !closing}')
  expect(contextualHint).toContain("event.key === 'Escape'")
  expect(cardForm.match(/matchTriggerWidth/g)).toHaveLength(1)
  expect(loanForm.match(/matchTriggerWidth/g)).toHaveLength(3)
  expect(source.match(/matchTriggerWidth/g)).toHaveLength(3)
  expect(cardSchedule.match(/matchTriggerWidth/g)).toHaveLength(2)
  expect(cardSchedule).toContain('<CreditScheduleDateField')
  expect(loanSchedule).toContain('<CreditScheduleDateField')
})

for (const viewport of [
  { width: 390, height: 844 },
  { width: 834, height: 1112 },
  { width: 1440, height: 1000 },
  { width: 1710, height: 1100 },
]) {
  for (const count of [1, 2, 12]) {
    test(`real CreditsListPanel keeps five columns aligned for ${count} products at ${viewport.width}px`, async ({ page }) => {
      await mountRealCreditsList(page, count, viewport)
      const rows = page.locator('[data-testid^="credit-row-"]')
      await expect(rows).toHaveCount(count)
      const measurements = await page.evaluate(() => {
        const header = document.querySelector<HTMLElement>('[class*="tableHeader"]')
        const row = document.querySelector<HTMLElement>('[data-testid^="credit-row-"]')
        const cells = row ? Array.from(row.children) as HTMLElement[] : []
        const headerCells = header ? Array.from(header.children) as HTMLElement[] : []
        const rect = (element: HTMLElement) => {
          const value = element.getBoundingClientRect()
          return { left:value.left, right:value.right, width:value.width, top:value.top, height:value.height, scrollWidth:element.scrollWidth, clientWidth:element.clientWidth }
        }
        return {
          viewport:window.innerWidth,
          pageWidth:document.querySelector<HTMLElement>('[class*="page"]')?.getBoundingClientRect().width ?? 0,
          headerCells:headerCells.map(rect),
          rowCells:cells.map(rect),
          row:row ? rect(row) : null,
          progress:document.querySelector<HTMLElement>('[role="progressbar"]')?.getAttribute('aria-valuenow') ?? null,
          hasFakeDate:Array.from(document.querySelectorAll('strong')).some(element => /2026-\d{2}-\d{2}/.test(element.textContent ?? '')),
          actionMenu:Array.from(document.querySelectorAll<HTMLElement>('[data-ft-action-menu-trigger]')).find(element => element.getClientRects().length > 0)?.getBoundingClientRect().width ?? 0,
          overlappingCells:cells.flatMap((cell,index) => cells.slice(index + 1).map(other => {
            const a=cell.getBoundingClientRect(), b=other.getBoundingClientRect()
            return a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1
          })).filter(Boolean).length,
          horizontalOverflow:document.documentElement.scrollWidth > document.documentElement.clientWidth,
        }
      })
      if (count === 1) console.log(`[credits-list-geometry] ${viewport.width}px ${JSON.stringify({ row:measurements.row, columns:measurements.rowCells.map(cell => Math.round(cell.width)), actionMenu:measurements.actionMenu, pageWidth:measurements.pageWidth })}`)
      if (count === 1 && [390, 1440].includes(viewport.width)) await page.screenshot({ path: `/tmp/fintrack-credits-r5-list-${viewport.width}.png`, fullPage: true })
      expect(measurements.horizontalOverflow).toBe(false)
      expect(measurements.row).not.toBeNull()
      expect(measurements.row!.right).toBeLessThanOrEqual(viewport.width + 1)
      expect(measurements.hasFakeDate).toBe(false)
      expect(measurements.actionMenu).toBeGreaterThan(0)
      expect(measurements.overlappingCells).toBe(0)
      if (viewport.width > 767) {
        expect(measurements.headerCells).toHaveLength(5)
        expect(measurements.rowCells).toHaveLength(5)
        for (const [index, cell] of measurements.rowCells.entries()) {
          expect(Math.abs(cell.left - measurements.headerCells[index]!.left)).toBeLessThanOrEqual(1)
          expect(Math.abs(cell.width - measurements.headerCells[index]!.width)).toBeLessThanOrEqual(1)
          expect(cell.width).toBeGreaterThan(70)
        }
      }
      if (count >= 1) {
        await expect(page.getByTestId('credit-row-item-0').getByRole('progressbar', { name: /Uso de línea en PEN/ })).toBeVisible()
        await expect(page.getByText('66.7%', { exact: true }).first()).toBeVisible()
        await expect(page.getByTestId('credit-row-item-0').getByText('Día 14')).toBeVisible()
      }
      if (count >= 3) {
        const loanRow = page.getByTestId('credit-row-item-2')
        await expect(loanRow.getByText('Cronograma vinculado')).toBeVisible()
        await expect(loanRow.getByRole('progressbar')).toHaveCount(0)
      }
      const actionTrigger = page.getByRole('button', { name: /acciones de Tarjeta item-0/i }).first()
      await actionTrigger.click()
      const menu = page.getByRole('menu')
      await expect(menu).toBeVisible()
      const menuBox = await menu.boundingBox()
      expect(menuBox).not.toBeNull()
      expect(menuBox!.width).toBeGreaterThanOrEqual(188)
      expect(menuBox!.width).toBeLessThanOrEqual(Math.min(280, viewport.width - 24) + 1)
      expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(viewport.width - 10)
      await page.keyboard.press('Escape')
      await expect(menu).toHaveCount(0)
      await expect(actionTrigger).toBeFocused()
    })
  }
}
