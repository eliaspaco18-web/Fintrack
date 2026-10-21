import { expect, test } from '@playwright/test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

const reactPath = join(process.cwd(), 'node_modules/react/umd/react.development.js')
const reactDomPath = join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js')

function cssModuleMap(css: string, sourcePath: string, prefix: string) {
  const names = new Set(readFileSync(join(process.cwd(), sourcePath), 'utf8').match(/\.([A-Za-z][\w-]*)/g)?.map(name => name.slice(1)) ?? [])
  return Object.fromEntries(Array.from(names, name => [name, css.match(new RegExp(`\\.(${prefix}_${name}__[\\w-]+)`))?.[1] ?? name]))
}

function compileModule(path: string, moduleId: string, exportNames: string[]) {
  const sourceFile = ts.createSourceFile(join(process.cwd(), path), readFileSync(join(process.cwd(), path), 'utf8'), ts.ScriptTarget.Latest, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const removals: Array<{ start: number; end: number }> = []
  const bindings: string[] = []
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    removals.push({ start: statement.getStart(sourceFile), end: statement.end })
    if (!statement.importClause || statement.importClause.isTypeOnly) continue
    const specifier = (statement.moduleSpecifier as ts.StringLiteral).text
    const local = `__payablesImport${bindings.length}`
    bindings.push(`const ${local}=window.__payablesModules[${JSON.stringify(specifier)}]||{};`)
    const clause = statement.importClause
    if (clause.name) bindings.push(`const ${clause.name.text}=${local}.default;`)
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) clause.namedBindings.elements.filter(item => !item.isTypeOnly).forEach(item => {
      const imported = item.propertyName?.text ?? item.name.text
      bindings.push(`const ${item.name.text}=${local}[${JSON.stringify(imported)}];`)
    })
  }
  let source = sourceFile.text
  removals.sort((a, b) => b.start - a.start).forEach(range => { source = `${source.slice(0, range.start)}${source.slice(range.end)}` })
  source = source.replace(/^'use client'\s*/, '').replace(/\bexport\s+(?=(?:async\s+)?(?:function|const|class|interface|type)\b)/g, '')
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React } }).outputText.replace(/^export\s*\{\s*\};?\s*$/gm, '')
  return `(()=>{const React=window.React;${bindings.join('\n')}\n${compiled}\nwindow.__payablesModules[${JSON.stringify(moduleId)}]={...(window.__payablesModules[${JSON.stringify(moduleId)}]||{}),${exportNames.join(',')}};})();`
}

test('real payables workspace mirrors the shared list geometry and opens its real workbench without a footer', async ({ page }) => {
  const cssRoot = join(process.cwd(), '.next/static/css')
  const css = readdirSync(cssRoot).filter(file => file.endsWith('.css')).sort().map(file => readFileSync(join(cssRoot, file), 'utf8')).join('\n')
  const receivablesCss = cssModuleMap(css, 'components/receivables/ReceivablesManager.module.css', 'ReceivablesManager')
  const movementCss = cssModuleMap(css, 'components/tables/TransactionsRound07.module.css', 'TransactionsRound07')
  const workspaceCss = cssModuleMap(css, 'components/payables/PayablesWorkspace.module.css', 'PayablesWorkspace')
  const detailCss = cssModuleMap(css, 'components/payables/CreditorDetail.module.css', 'CreditorDetail')
  const datePickerCss = cssModuleMap(css, 'components/forms/TransactionForm/IncomeDatePicker.module.css', 'IncomeDatePicker')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.setContent('<main data-ft-v3 class="ft-shell-content"><div id="root"></div></main>')
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: `window.React=React;window.__payablesModules={react:React,'react-dom':{createPortal:ReactDOM.createPortal}};
    window.__payablesModules['@/components/receivables/ReceivablesManager.module.css']={default:${JSON.stringify(receivablesCss)}};
    window.__payablesModules['@/components/tables/TransactionsRound07.module.css']={default:${JSON.stringify(movementCss)}};
    window.__payablesModules['./IncomeDatePicker.module.css']={default:${JSON.stringify(datePickerCss)}};
    window.__payablesModules['./PayablesWorkspace.module.css']={default:${JSON.stringify(workspaceCss)}};
    window.__payablesModules['./CreditorDetail.module.css']={default:${JSON.stringify(detailCss)}};
    const currencySummaries=[{currency:'PEN',total:2000,settled:800,pending:1200,recordCount:2,openRecordCount:1},{currency:'USD',total:500,settled:125,pending:375,recordCount:1,openRecordCount:1}];
    window.__payablesCreditors=[{id:'creditor-1',name:'Estudio Norte',initial_debt:0,relationship:'Proveedor de servicios',is_active:true,total_owed:2500,total_paid:925,pending_amount:1575,progress_pct:37,all_paid:false,count_pending:2,payables_count:3,currency_summaries:currencySummaries,unverified_currency_records:0,unverified_open_currency_records:0,has_unverified_initial_debt:false}];
    window.__payablesRows=[{id:'obligation-1',transaction_id:'tx-obligation',creditor_id:'creditor-1',creditor_name:'Estudio Norte',concept:'Servicio mensual',amount:2000,paid_amount:800,currency:'PEN',issue_date:'2026-10-02',due_date:'2026-10-28',notes:null,attachment_url:null,status:'PARTIAL',source_account:{id:'account-1',name:'Cuenta principal'}},{id:'obligation-2',transaction_id:null,creditor_id:'creditor-1',creditor_name:'Estudio Norte',concept:'Licencia anual',amount:500,paid_amount:125,currency:'USD',issue_date:'2026-10-03',due_date:null,notes:null,attachment_url:null,status:'PARTIAL'}];
    window.__payablesLedger=[{id:'tx-obligation',type:'EXPENSE',amount:2000,currency:'PEN',description:'Servicio mensual',notes:null,transaction_date:'2026-10-02',created_at:'2026-10-02T12:00:00Z',source_account:{id:'account-1',name:'Cuenta principal'},category:{id:'category-1',name:'Servicios'}},{id:'tx-payment',type:'EXPENSE',amount:800,currency:'PEN',description:'Pago parcial',notes:'Transferencia',transaction_date:'2026-10-09',created_at:'2026-10-09T12:00:00Z',source_account:{id:'account-1',name:'Cuenta principal'},category:{id:'category-2',name:'Pago de obligación'}},{id:'tx-loan',type:'INCOME',amount:500,currency:'USD',description:'Préstamo recibido',notes:null,transaction_date:'2026-10-03',created_at:'2026-10-03T12:00:00Z',source_account:{id:'account-1',name:'Cuenta principal'},category:{id:'category-3',name:'Préstamo'}}];
    window.fetch=async url=>{const path=String(url);let data=[];if(path==='/api/creditors')data=window.__payablesCreditors;else if(path==='/api/payables')data=window.__payablesRows;else if(path.includes('/api/payables?creditor_id='))data=window.__payablesRows;else if(path.includes('/ledger'))data=window.__payablesLedger;else if(path.includes('/api/accounts'))data=[{id:'account-1',name:'Cuenta principal'}];return {ok:true,status:200,json:async()=>({ok:true,data})};};
    window.__payablesRouter={replace:()=>{window.__payablesReplaced=true}};window.__payablesSearchParams=new URLSearchParams();` })
  await page.addScriptTag({ content: `window.__payablesModules['next/navigation']={usePathname:()=>'/payables',useRouter:()=>window.__payablesRouter,useSearchParams:()=>window.__payablesSearchParams};
    window.__payablesModules['next/link']={default:({href,children,...props})=>React.createElement('a',{...props,href},children)};
    window.__payablesModules['@/lib/toast/toast']={useToast:()=>({toast:{success:()=>{},error:()=>{},warning:()=>{}}})};
    window.__payablesModules['@/lib/api/error-message']={getApiErrorMessage:(_json,fallback)=>fallback};
    window.__payablesModules['@/lib/client/fetch-with-timeout']={fetchWithTimeout:(url,init)=>window.fetch(url,init)};
    window.__payablesModules['@/lib/contracts/ui.contracts']={formatCurrency:(amount,currency)=>currency==='USD'?'$ '+Number(amount).toFixed(2):'S/ '+Number(amount).toFixed(2)};
    window.__payablesModules['@/components/finance']={PageLayout:({children,className})=>React.createElement('div',{className:'mx-auto flex w-full max-w-[1440px] flex-col gap-4 pb-10 '+className},children),DataSearchField:({value,onChange,placeholder,className,...props})=>React.createElement('div',{className},React.createElement('svg',{width:13,height:13,viewBox:'0 0 24 24','aria-hidden':true}),React.createElement('input',{...props,type:'search',value,placeholder,onChange:event=>onChange(event.target.value)})),DataErrorBanner:({message})=>React.createElement('p',{role:'alert'},message),EmptyState:({title,description})=>React.createElement('div',null,React.createElement('strong',null,title),React.createElement('p',null,description)),ConfirmDialog:()=>null};
    window.__payablesModules['@/components/forms/primitives']={FormActions:({secondaryAction,primaryAction})=>React.createElement('div',{className:'flex justify-end gap-2'},secondaryAction,primaryAction)};
    window.__payablesModules['@/components/ui/accessibility']={FocusTrap:({children,className,active})=>React.createElement('div',{className,'data-focus-trap-active':active},children)};
    window.__payablesModules['@/lib/ui/use-v3-workbench-presence']={useV3WorkbenchPresence:(open)=>({phase:open?'open':'closed',mounted:open,frameRef:()=>{},veilRef:()=>{},bodyRef:()=>{}})};
    window.__payablesModules['@/lib/ui/v3-modal-background']={acquireV3ModalBackground:()=>()=>{}};
    window.__payablesModules['@/components/ui/AnchoredActionMenu']={AnchoredActionMenu:({label,triggerContent,className})=>React.createElement('button',{type:'button','aria-label':label,className},triggerContent)};
    window.__payablesModules['./CreditorForm']={CreditorForm:()=>React.createElement('form',{id:'creditor-form','data-testid':'creditor-form'})};
    window.__payablesModules['./PayableForm']={PayableForm:()=>React.createElement('form',{id:'payable-form','data-testid':'payable-form'})};` })
  await page.addScriptTag({ content: compileModule('modules/obligations/obligation-currency-presentation.ts', '@/modules/obligations/obligation-currency-presentation', ['combineObligationCurrencyBreakdowns','formatObligationCurrencySummaries','getObligationSettlementState','resolveVerifiedObligationCurrency','summarizeObligationLedgerCurrencies','formatVerifiedObligationAmount','obligationProgress']) })
  await page.addScriptTag({ content: compileModule('modules/payables/payables-list-presentation.ts', '@/modules/payables/payables-list-presentation', ['getPayablePaymentProgress','countPayablesDueWithinDays','isValidIsoDate']) })
  await page.addScriptTag({ content: compileModule('modules/payables/payables-history-presentation.ts', '@/modules/payables/payables-history-presentation', ['buildPayableFinancialHistory']) })
  await page.addScriptTag({ content: compileModule('modules/transactions/income-date.ts', '@/modules/transactions/income-date', ['calendarMonthDays','formatIsoDateForDisplay','moveCalendarMonth','parseDisplayDateToIso','parseIsoCalendarDate','toIsoCalendarDate']) })
  await page.addScriptTag({ content: compileModule('components/ui/Button.tsx', '@/components/ui/Button', ['Button','buttonClassName']) })
  await page.addScriptTag({ content: compileModule('components/ui/CreateModuleButton.tsx', '@/components/ui/CreateModuleButton', ['CreateModuleButton']) })
  await page.addScriptTag({ content: compileModule('components/ui/AppSelect.tsx', '@/components/ui/AppSelect', ['AppSelect','getTriggerMatchedMenuStyle','resolveAppSelectPortalRoot']) })
  await page.addScriptTag({ content: compileModule('components/forms/TransactionForm/IncomeDatePicker.tsx', '@/components/forms/TransactionForm/IncomeDatePicker', ['IncomeDatePicker']) })
  await page.addScriptTag({ content: compileModule('components/ui/RecordModal.tsx', '@/components/ui/RecordModal', ['RecordModal','RecordModalFooter']) })
  await page.addScriptTag({ content: compileModule('components/payables/CreditorDetail.tsx', './CreditorDetail', ['CreditorDetail']) })
  await page.addScriptTag({ content: compileModule('components/payables/PayablesWorkspace.tsx', '@/components/payables/PayablesWorkspace', ['PayablesWorkspace']) })
  await page.addScriptTag({ content: `ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(window.__payablesModules['@/components/payables/PayablesWorkspace'].PayablesWorkspace));` })

  await expect(page.getByTestId('payables-register')).toBeVisible()
  await expect(page.getByTestId('payable-creditor-row-creditor-1')).toBeVisible()
  await expect(page.getByTestId('payables-progress-creditor-1').getByRole('progressbar')).toHaveCount(2)
  await expect(page.getByTestId('payables-payment-btn')).toHaveAttribute('href', '/transactions?new=transaction&module=payable&type=EXPENSE')
  await page.setViewportSize({ width: 1440, height: 900 })
  const desktop = await page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector(selector)!
      const box = element.getBoundingClientRect()
      return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height), right: Math.round(box.right) }
    }
    const selectors = ['[data-ft-route-heading]', '[data-testid="payables-payment-btn"]', '[aria-label="Resumen de cuentas por pagar"]', '[data-testid="payables-status-tabs"]', '[data-testid="payables-filter-toolbar"]', '[data-testid="payables-register"]']
    const overview = document.querySelector('[aria-label="Resumen de cuentas por pagar"]')!
    const tabs = document.querySelector('[data-testid="payables-status-tabs"]')!
    return { elements: selectors.map(rect), scrollWidth: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth, summaryBorder: getComputedStyle(overview).borderBottomWidth, tabBorder: getComputedStyle(tabs).borderBottomWidth, primaryHeight: Math.round(document.querySelector('[data-testid="payables-payment-btn"]')!.getBoundingClientRect().height), secondaryHeight: Math.round(document.querySelector('[data-testid="payables-new-creditor-btn"]')!.getBoundingClientRect().height) }
  })
  console.info('Payables desktop geometry:', JSON.stringify(desktop))
  expect(desktop.scrollWidth).toBeLessThanOrEqual(desktop.viewport)
  expect(desktop.summaryBorder).toBe('1px')
  expect(desktop.tabBorder).toBe('1px')
  expect(desktop.primaryHeight).toBe(desktop.secondaryHeight)
  expect(desktop.elements[2]!.width).toBe(desktop.elements[3]!.width)
  expect(desktop.elements[3]!.width).toBe(desktop.elements[4]!.width)

  await page.getByTestId('payables-new-btn').click()
  const obligationModal = page.getByTestId('payables-new-obligation-modal')
  await expect(obligationModal).toBeVisible()
  const obligationBody = obligationModal.locator('[data-record-modal-body="true"]')
  const obligationFooter = obligationBody.locator('xpath=following-sibling::div[1]')
  await expect(obligationFooter.getByTestId('payable-save-btn')).toBeVisible()
  await expect(obligationBody.getByTestId('payable-save-btn')).toHaveCount(0)
  await obligationFooter.getByRole('button', { name: 'Cancelar' }).click()
  await expect(obligationModal).toHaveCount(0)

  await page.getByTestId('payables-new-creditor-btn').click()
  const creditorModal = page.getByTestId('payables-creditor-modal')
  await expect(creditorModal).toBeVisible()
  const creditorBody = creditorModal.locator('[data-record-modal-body="true"]')
  const creditorFooter = creditorBody.locator('xpath=following-sibling::div[1]')
  await expect(creditorFooter.getByTestId('creditor-save-btn')).toBeVisible()
  await expect(creditorBody.getByTestId('creditor-save-btn')).toHaveCount(0)
  await creditorFooter.getByRole('button', { name: 'Cancelar' }).click()
  await expect(creditorModal).toHaveCount(0)

  for (const width of [390, 834, 1710]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    const responsive = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, list: document.querySelector('[data-testid="payables-register"]')!.getBoundingClientRect().width }))
    expect(responsive.scroll).toBeLessThanOrEqual(responsive.viewport)
    expect(responsive.list).toBeGreaterThan(0)
    if (width === 390) await expect(page.getByTestId('payable-creditor-mobile-creditor-1')).toBeVisible()
  }

  await page.getByRole('button', { name: 'Ver cuenta' }).click()
  const detail = page.getByTestId('payables-creditor-detail-modal')
  await expect(detail).toBeVisible()
  await expect(page.getByTestId('payables-detail-summary')).toBeVisible()
  await expect(page.getByTestId('payables-detail-filter-toolbar')).toBeVisible()
  await expect(page.getByTestId('payables-history-row-ledger:tx-obligation')).toHaveCount(1)
  await expect(page.getByTestId('payables-history-row-payable:obligation-1')).toHaveCount(0)
  await expect(detail.locator('[data-record-modal-body="true"]').locator('xpath=following-sibling::div[1]')).toHaveCount(0)
  const detailGeometry = await page.evaluate(() => {
    const dialog = document.querySelector('[data-testid="payables-creditor-detail-modal"]')!
    const wrapper = dialog.closest('.ft-v3-workbench-wrapper')!
    const body = dialog.querySelector('[data-record-modal-body="true"]')!
    const history = dialog.querySelector('[data-testid="payables-history-filter-toolbar"]') ?? dialog.querySelector('[data-testid="payables-detail-filter-toolbar"]')!
    return { panelWidth: Math.round(wrapper.getBoundingClientRect().width), bodyHeight: Math.round(body.getBoundingClientRect().height), historyY: Math.round(history.getBoundingClientRect().y), hasFooter: body.nextElementSibling !== null, scrollWidth: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }
  })
  expect(detailGeometry.panelWidth).toBeGreaterThan(1000)
  expect(detailGeometry.hasFooter).toBe(false)
  expect(detailGeometry.scrollWidth).toBeLessThanOrEqual(detailGeometry.viewport)
  for (const width of [1440, 834, 390, 1710]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    const responsiveDetail = await page.evaluate(() => {
      const wrapper = document.querySelector('[data-testid="payables-creditor-detail-modal"]')!.closest('.ft-v3-workbench-wrapper')!
      const dialog = document.querySelector('[data-testid="payables-creditor-detail-modal"]')!
      const body = dialog.querySelector('[data-record-modal-body="true"]')!
      return {
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth,
        wrapper: Math.round(wrapper.getBoundingClientRect().width),
        dialogScroll: dialog.scrollWidth,
        dialogClient: dialog.clientWidth,
        bodyScroll: body.scrollWidth,
        bodyClient: body.clientWidth,
      }
    })
    expect(responsiveDetail.document).toBeLessThanOrEqual(responsiveDetail.viewport)
    expect(responsiveDetail.wrapper).toBeLessThanOrEqual(responsiveDetail.viewport)
    expect(responsiveDetail.dialogScroll).toBeLessThanOrEqual(responsiveDetail.dialogClient)
    expect(responsiveDetail.bodyScroll).toBeLessThanOrEqual(responsiveDetail.bodyClient)
    if (width === 390) expect(responsiveDetail.wrapper).toBe(374)
  }
  await page.getByRole('button', { name: 'Cerrar panel' }).click()
})
