import { expect, test, type Locator, type Page } from '@playwright/test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

type RuntimeModule = { default?: unknown; [key: string]: unknown }

const reactPath = join(process.cwd(), 'node_modules/react/umd/react.development.js')
const reactDomPath = join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js')

function compileComponent(path: string, moduleId: string, exportNames: string[]) {
  const filePath = join(process.cwd(), path)
  const sourceFile = ts.createSourceFile(filePath, readFileSync(filePath, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const removals: Array<{ start: number; end: number }> = []
  const bindings: string[] = []

  sourceFile.statements.forEach(statement => {
    if (!ts.isImportDeclaration(statement)) return
    removals.push({ start: statement.getStart(sourceFile), end: statement.end })
    if (statement.importClause?.isTypeOnly) return

    const specifier = (statement.moduleSpecifier as ts.StringLiteral).text
    const localModule = `__creditsImport${bindings.length}`
    bindings.push(`const ${localModule} = window.__creditsModules[${JSON.stringify(specifier)}] || {};`)
    const clause = statement.importClause
    if (!clause) return
    if (clause.name) bindings.push(`const ${clause.name.text} = ${localModule}.default;`)
    if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
      bindings.push(`const ${clause.namedBindings.name.text} = ${localModule};`)
    } else if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      clause.namedBindings.elements.filter(item => !item.isTypeOnly).forEach(item => {
        const imported = item.propertyName?.text ?? item.name.text
        bindings.push(`const ${item.name.text} = ${localModule}[${JSON.stringify(imported)}];`)
      })
    }
  })

  let source = sourceFile.text
  removals.sort((a, b) => b.start - a.start).forEach(range => {
    source = `${source.slice(0, range.start)}${source.slice(range.end)}`
  })
  source = source.replace(/^'use client'\s*/, '').replace(/\bexport\s+(?=(?:async\s+)?(?:function|const|class|interface|type)\b)/g, '')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React },
  }).outputText.replace(/^export\s*\{\s*\};?\s*$/gm, '')
  const exports = exportNames.map(name => `${JSON.stringify(name)}: ${name}`).join(', ')
  return `(() => { const React = window.React; ${bindings.join('\n')}\n${compiled}\nwindow.__creditsModules[${JSON.stringify(moduleId)}] = { ...(window.__creditsModules[${JSON.stringify(moduleId)}] || {}), ${exports} }; })();`
}

function compileFocusTrap() {
  const source = readFileSync(join(process.cwd(), 'components/ui/accessibility.tsx'), 'utf8')
  const fragment = source.slice(source.indexOf('const FOCUSABLE ='), source.indexOf('// ─── KEYBOARD SHORTCUTS'))
    .replace('export function FocusTrap', 'function FocusTrap')
  const compiled = ts.transpileModule(`const { useEffect, useRef } = window.React;\n${fragment}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React },
  }).outputText.replace(/^export\s*\{\s*\};?\s*$/gm, '')
  return `(() => { const React = window.React; ${compiled}\nwindow.__creditsModules['@/components/ui/accessibility'] = { FocusTrap }; })();`
}

function compilePresenceHook() {
  const source = readFileSync(join(process.cwd(), 'lib/ui/use-v3-workbench-presence.ts'), 'utf8')
    .replace(/^'use client'\s*/, '')
    .replace(/import\s*\{[\s\S]*?\}\s*from 'react'/, 'const { useEffect, useLayoutEffect, useRef, useState } = window.React;')
    .replace(/export function /g, 'function ')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText.replace(/^export\s*\{\s*\};?\s*$/gm, '')
  return `(() => { ${compiled}\nwindow.__creditsModules['@/lib/ui/use-v3-workbench-presence'] = { useV3WorkbenchPresence }; })();`
}

function compileBackgroundManager() {
  const source = readFileSync(join(process.cwd(), 'lib/ui/v3-modal-background.ts'), 'utf8')
    .replace(/export function /g, 'function ')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText.replace(/^export\s*\{\s*\};?\s*$/gm, '')
  return `(() => { ${compiled}\nwindow.__creditsModules['@/lib/ui/v3-modal-background'] = { acquireV3ModalBackground }; })();`
}

function compileIncomeDateHelpers() {
  const source = readFileSync(join(process.cwd(), 'modules/transactions/income-date.ts'), 'utf8')
    .replace(/export function /g, 'function ')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText.replace(/^export\s*\{\s*\};?\s*$/gm, '')
  return `(() => { ${compiled}\nwindow.__creditsModules['@/modules/transactions/income-date'] = { calendarMonthDays, formatIsoDateForDisplay, moveCalendarMonth, parseDisplayDateToIso, parseIsoCalendarDate, toIsoCalendarDate }; })();`
}

async function mountRealCreditModals(
  page: Page,
  type: 'card' | 'loan',
  mode: 'create' | 'edit',
  viewport = { width: 1440, height: 900 },
  statementUrl: string | null = null,
  longAmounts = false,
) {
  const runtimeErrors: string[] = []
  page.on('pageerror', error => runtimeErrors.push(error.message))
  await page.setViewportSize(viewport)
  await page.setContent('<div class="fin-shell" data-ft-v3-shell><div id="root"></div></div>')
  await page.addScriptTag({ content: "let creditFixtureId = 0; Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: () => creditFixtureId++ === 0 ? 'credits-test-id' : `credits-test-id-${creditFixtureId}` })" })
  const cssPath = join(process.cwd(), '.next/static/css')
  const css = readdirSync(cssPath).filter(file => file.endsWith('.css')).sort().map(file => readFileSync(join(cssPath, file), 'utf8')).join('\n')
  const moduleClass = (localName: string, modulePrefix?: string) => css.match(new RegExp(
    modulePrefix
      ? `\\.(${modulePrefix}_${localName}__[\\w-]+)`
      : `\\.([\\w-]*${localName}__[\\w-]+)`,
  ))?.[1] ?? localName
  const footerClassName = moduleClass('operationFormActions')
  const creditFormOverlayClass = moduleClass('creditFormOverlay')
  const creditScheduleOverlayClass = moduleClass('creditScheduleOverlay')
  const creditCardScheduleOverlayClass = moduleClass('creditCardScheduleOverlay')
  const creditsTableHeaderClasses = Object.fromEntries([
    'creditsTableHead', 'creditsTableHeaderTableCell', 'creditsTableHeaderGridCell',
    'creditsTableHeaderLeft', 'creditsTableHeaderCenter', 'creditsTableHeaderRight',
  ].map(name => [name, moduleClass(name)]))
  const scheduleClasses = Object.fromEntries([
    'scheduleEditor', 'scheduleHeader', 'scheduleHeading', 'scheduleTitle', 'scheduleSubtitle', 'scheduleTotals',
    'cycleList', 'cycleTable', 'cycleHeader', 'cycleHeaderRow', 'cycleRows', 'cycleRow', 'cycleCell', 'cellLabel',
    'periodCell', 'periodFields', 'periodControls', 'monthSelect', 'yearSelect', 'cycleIssue', 'amountCell',
    'statementControl', 'statementButtons', 'statementStatus', 'iconButton', 'disabledIconButton', 'deleteButton',
    'cycleActions', 'registeredTotals', 'duplicateNotice',
  ].map(name => [name, moduleClass(name, 'CreditCardScheduleModal')]))
  const datePickerClasses = Object.fromEntries([
    'picker', 'input', 'trigger', 'error', 'popover', 'header', 'selectors', 'arrow', 'weekdays', 'days', 'week', 'day', 'footer',
  ].map(name => [name, moduleClass(name, 'IncomeDatePicker')]))
  await page.addStyleTag({ content: `${css}\n.app-modal-overlay{position:fixed;inset:0;display:flex;justify-content:flex-end;align-items:center;background:rgba(0,0,0,.24)}.ft-v3-workbench-wrapper{position:relative;z-index:1;width:min(580px,calc(100vw - 24px));height:calc(100dvh - 24px);margin:12px}.ft-v3-workbench-veil{position:absolute;inset:0}.app-modal-overlay [role=dialog]{height:100%;background:white}.app-modal-overlay [data-record-modal-body]{overflow:auto;flex:1;min-height:0}` })
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: `(() => {
    window.__creditsModules = {};
    window.__activeFocusTraps = new Set();
    window.__modalCloseCounts = { parent: 0 };
    const originalAdd = document.addEventListener.bind(document);
    const originalRemove = document.removeEventListener.bind(document);
    document.addEventListener = function(type, listener, options) {
      if (type === 'keydown') window.__activeFocusTraps.add(listener);
      return originalAdd(type, listener, options);
    };
    document.removeEventListener = function(type, listener, options) {
      if (type === 'keydown') window.__activeFocusTraps.delete(listener);
      return originalRemove(type, listener, options);
    };
    window.__creditsModules['react'] = { ...React };
    window.__creditsModules['react-dom'] = { createPortal: ReactDOM.createPortal };
    window.__creditsModules['@/components/ui/Button'] = { Button: ({children, type='button', onClick, disabled, id, ariaLabel, className, title, ...props}) => React.createElement('button', { type, onClick, disabled, id, 'aria-label': ariaLabel, className, title, ...props }, children) };
    window.__creditsModules['@/components/ui/NumericInput'] = { NumericInput: ({value='', onValueChange, disabled, ...props}) => React.createElement('input', { value: String(value ?? ''), onChange: event => onValueChange?.(event.target.value), disabled, ...props }) };
    window.__creditsModules['@/components/forms/TransactionForm/IncomeTransactionForm.module.css'] = { default: { operationFormActions: ${JSON.stringify(footerClassName)} } };
    window.__creditsModules['@/components/forms/primitives'] = {
      FormActions: ({primaryAction, secondaryAction, className}) => React.createElement('div', { className }, secondaryAction, primaryAction),
      FormField: ({label, labelAdornment, children, error}) => React.createElement('div', null, React.createElement('label', null, label, labelAdornment), children, error ? React.createElement('span', null, error) : null),
      FormSection: ({title, description, children}) => React.createElement('section', null, React.createElement('h3', null, title), description ? React.createElement('p', null, description) : null, children),
    };
    window.__creditsModules['@/components/credits/CreditInfoHint'] = { CreditInfoHint: ({label, children}) => React.createElement('span', { title: label }, children) };
    window.__creditsModules['@/components/credits/credits-schedule.constants'] = {
      SCHEDULE_MONTHS: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map((label,index) => ({ value: String(index + 1).padStart(2, '0'), label })),
      CREDIT_CARD_DATE_INPUT_MIN_WIDTH: 120, BANK_LOAN_DATE_INPUT_MIN_WIDTH: 120,
      formatBillingCycleLabel: (month, year) => month + '/' + year,
      formatDuplicateCycleMessage: () => '', formatScheduleDateLabel: value => value,
    };
    window.__creditsModules['@/lib/credits/billing-cycle-years'] = { getBillingCycleYearOptions: () => [{value:'2026',label:'2026'}] };
    window.__creditsModules['@/lib/api/error-message'] = { getApiErrorMessage: (_json, fallback) => fallback };
    window.__creditsModules['@/lib/utils/numeric-input'] = { parseNumericInput: value => Number.parseFloat(String(value ?? '')) || 0, roundToDecimals: (value, decimals=2) => Number(Number(value).toFixed(decimals)) };
    window.__creditsModules['@/lib/contracts/ui.contracts'] = { formatNumber: value => Number(value ?? 0).toFixed(2), formatCurrency: value => String(value) };
    window.__creditsModules['@/modules/attachments/attachment-integrity'] = { ATTACHMENT_UPDATE_BLOCKED_MESSAGE: 'blocked' };
    window.__attachmentCalls = [];
    window.__creditsModules['@/modules/attachments/attachment-client'] = {
      getAttachmentAvailabilityOutcome: result => ({kind:result.availability,message:null}),
      requestAttachmentUpload: async (endpoint, file) => {
        window.__attachmentCalls.push({endpoint,name:file.name,size:file.size});
        return {path:'credits/cycles/statement.pdf',file_name:file.name,file_size:file.size,content_type:file.type || 'application/pdf',signed_url:'https://example.test/statement',availability:'AVAILABLE'};
      },
    };
    window.__creditsModules['@/modules/credits/billing-cycle-integrity'] = { getBillingCycleDateIssue: () => null, getBillingCyclesSubmissionIssue: () => null };
    window.__creditsModules['@/modules/credits/exchange-rate-integrity'] = { resolveCreditExchangeRateInput: () => ({ok:true, value:1}) };
    window.__creditsModules['@/modules/loans/loan-schedule-integrity'] = { resizeScheduleRows: (rows, count, buildRow) => Array.from({length:count}, (_, index) => rows[index] || buildRow(index)) };
    window.__creditsModules['@/modules/loans/loan-type'] = { LOAN_TYPE_VALUES: ['CONSUMPTION'], getLoanTypeLabel: value => value };
    window.__creditsModules['@/components/credits/CreditsWorkbench.module.css'] = { default: { creditFormOverlay:${JSON.stringify(creditFormOverlayClass)}, creditScheduleOverlay:${JSON.stringify(creditScheduleOverlayClass)}, creditCardScheduleOverlay:${JSON.stringify(creditCardScheduleOverlayClass)} } };
    window.__creditsModules['@/components/credits/CreditsTableHeader.module.css'] = { default: ${JSON.stringify(creditsTableHeaderClasses)} };
    window.__creditsModules['@/components/credits/CreditCardScheduleModal.module.css'] = { default: ${JSON.stringify(scheduleClasses)} };
    window.__creditRequests = [];
    window.__creditSaved = null;
    window.__creditCycleStatementUrl = ${JSON.stringify(statementUrl)};
    window.__openedStatement = null;
    window.fetch = async (input, init = {}) => {
      const path = String(input);
      window.__creditRequests.push({path,method:init.method || 'GET'});
      const bank = {id:'bank-1',name:'Banco de prueba',short_name:'Banco',is_active:true};
      const cycle = {id:'cycle-1',billing_month:10,billing_year:2026,consumption_from:'2026-10-01',consumption_to:'2026-10-31',payment_date:'2026-11-10',total_to_pay:${longAmounts ? 1234567890.23 : 25},total_to_pay_pen:${longAmounts ? 1234567890.23 : 25},total_to_pay_usd:${longAmounts ? 987654321.09 : 0},movement_summary:null,can_delete:true,statement_url:window.__creditCycleStatementUrl};
      let data = [];
      if (path === '/api/bank-entities') data = [bank];
      else if (path === '/api/accounts') data = [{id:'account-1',name:'Cuenta de prueba',type:'CHECKING',currency:'PEN',is_active:true}];
      else if (path === '/api/credits/card-1/billing-cycles') data = [cycle];
      else if (path === '/api/credits/card-1/billing-cycles/cycle-1/statement') data = {signed_url:'https://example.test/signed-statement'};
      else if (path === '/api/credits' && init.method === 'POST') data = {credit:{id:'created-card-1'}};
      else if (path === '/api/credits/created-card-1/billing-cycles' && init.method === 'POST') data = {id:'created-cycle-1'};
      else if (path === '/api/credits/loan-1') data = {credit:{account_id:'account-1',name:'Préstamo de prueba'},loan:{bank_entity_id:'bank-1',loan_type:'CONSUMPTION',name:'Préstamo de prueba',start_date:'2026-01-01',total_installments:1},disbursement:{transaction_date:'2026-01-01',description:'',exchange_rate:null},installments:[{id:'installment-1',due_date:'2026-02-01',principal_amount:100,interest_amount:0,insurance_amount:0,other_charges:0}],permissions:{can_edit_loan_finances:true}};
      return {ok:true,status:200,json:async()=>({ok:true,data})};
    };
  })();` })

  await page.addScriptTag({ content: compileFocusTrap() })
  await page.addScriptTag({ content: compilePresenceHook() })
  await page.addScriptTag({ content: compileBackgroundManager() })
  await page.addScriptTag({ content: compileIncomeDateHelpers() })
  await page.addScriptTag({ content: compileComponent('components/ui/AppSelect.tsx', '@/components/ui/AppSelect', ['AppSelect']) })
  await page.addScriptTag({ content: `window.__creditsModules['./IncomeDatePicker.module.css'] = { default: ${JSON.stringify(datePickerClasses)} };` })
  await page.addScriptTag({ content: compileComponent('components/forms/TransactionForm/IncomeDatePicker.tsx', '@/components/forms/TransactionForm/IncomeDatePicker', ['IncomeDatePicker']) })
  await page.addScriptTag({ content: compileComponent('components/ui/RecordModal.tsx', '@/components/ui/RecordModal', ['RecordModal', 'RecordModalFooter']) })
  await page.addScriptTag({ content: compileComponent('components/credits/CreditScheduleDateField.tsx', '@/components/credits/CreditScheduleDateField', ['CreditScheduleDateField']) })
  await page.addScriptTag({ content: compileComponent('components/credits/CreditCardScheduleModal.tsx', '@/components/credits/CreditCardScheduleModal', ['CreditCardScheduleModal', 'CreditCardScheduleEditor']) })
  await page.addScriptTag({ content: compileComponent('components/credits/BankLoanScheduleModal.tsx', '@/components/credits/BankLoanScheduleModal', ['BankLoanScheduleModal']) })
  await page.addScriptTag({ content: compileComponent('components/credits/CreditCardForm.tsx', '@/components/credits/CreditCardForm', ['CreditCardForm']) })
  await page.addScriptTag({ content: compileComponent('components/credits/BankLoanForm.tsx', '@/components/credits/BankLoanForm', ['BankLoanForm']) })
  await page.addScriptTag({ content: `(() => {
    function Host() {
      const [parentOpen, setParentOpen] = React.useState(true);
      const [nestedOpen, setNestedOpen] = React.useState(false);
      const type = ${JSON.stringify(type)};
      const mode = ${JSON.stringify(mode)};
      const card = {id:'card-1',name:'Tarjeta de prueba',currency:'PEN',credit_limit:1000,used_amount:50,used_amount_pen:50,used_amount_usd:0,initial_used_amount_pen:50,initial_used_amount_usd:0,bank_entity_id:'bank-1',credit_type:'CREDIT_CARD'};
      const body = type === 'card'
        ? React.createElement(window.__creditsModules['@/components/credits/CreditCardForm'].CreditCardForm, {mode,credit:mode === 'edit' ? card : null,onSuccess:(...args)=>{window.__creditSaved=args},onCancel:()=>setParentOpen(false),onNestedModalOpenChange:setNestedOpen})
        : React.createElement(window.__creditsModules['@/components/credits/BankLoanForm'].BankLoanForm, {mode,creditId:mode === 'edit' ? 'loan-1' : undefined,onSuccess:()=>{},onCancel:()=>setParentOpen(false),onNestedModalOpenChange:setNestedOpen});
      return React.createElement(React.Fragment, null,
        React.createElement('button',{id:'outside-focus'},'Outside'),
        React.createElement(window.__creditsModules['@/components/ui/RecordModal'].RecordModal,{open:parentOpen,onClose:()=>{window.__modalCloseCounts.parent++;setParentOpen(false)},title:type === 'card'?'Parent card':'Parent loan',focusTrapActive:!nestedOpen,preserveFocusOnResume:true,presentation:'workbench',overlayClassName:window.__creditsModules['@/components/credits/CreditsWorkbench.module.css'].default.creditFormOverlay,testId:'parent-workbench'},body),
        React.createElement('output',{id:'nested-state'},String(nestedOpen)));
    }
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Host));
  })();` })
  const runtimeState = await page.locator('#root').innerHTML()
  await expect(page.getByTestId('parent-workbench'), `${runtimeErrors.join('\n')}\n${runtimeState.slice(0, 1200)}`).toBeVisible()
  const triggerId = type === 'card' ? 'credit-card-schedule-trigger' : 'bank-loan-schedule-trigger'
  await expect(page.locator(`#${triggerId}`)).toBeEnabled()
}

async function activeTrapCount(page: Page) {
  return page.evaluate(() => (window as unknown as { __activeFocusTraps: Set<unknown> }).__activeFocusTraps.size)
}

async function readCreditHeaderStyles(locator: Locator) {
  return locator.evaluateAll(elements => elements.map(element => {
    const style = getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    return {
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight,
      letterSpacing: style.letterSpacing,
      color: style.color,
      textTransform: style.textTransform,
      textAlign: style.textAlign,
      height: rect.height,
    }
  }))
}

function expectCreditsHeaderStyles(headers: Awaited<ReturnType<typeof readCreditHeaderStyles>>, alignment?: 'left' | 'center' | 'right') {
  expect(headers.length).toBeGreaterThan(0)
  for (const header of headers) {
    expect(header.fontFamily).toContain('Manrope')
    expect(header.fontSize).toBe('10px')
    expect(header.fontWeight).toBe('600')
    expect(header.lineHeight).toBe('16px')
    expect(Number.parseFloat(header.letterSpacing)).toBeGreaterThan(0)
    expect(header.color).not.toBe('')
    expect(header.textTransform).toBe('uppercase')
    expect(Math.abs(header.height - 38)).toBeLessThanOrEqual(1)
    if (alignment) expect(header.textAlign).toBe(alignment)
  }
}

for (const type of ['card', 'loan'] as const) {
  for (const mode of ['create', 'edit'] as const) {
    test(`${mode} ${type} form suspends lower workbenches until nested close completes`, async ({ page }) => {
      await mountRealCreditModals(page, type, mode)
      const trigger = page.locator(type === 'card' ? '#credit-card-schedule-trigger' : '#bank-loan-schedule-trigger')
      await trigger.focus()
      await trigger.evaluate((element: HTMLButtonElement) => element.click())
      const schedule = page.getByRole('dialog', { name: type === 'card' ? 'Cronograma completo de la tarjeta' : 'Cronograma completo del préstamo' })
      await expect(schedule).toBeVisible()
      await expect(page.locator('#nested-state')).toHaveText('true')
      await expect.poll(() => activeTrapCount(page)).toBe(1)
      await expect(page.locator('[data-ft-workbench-overlay]')).toHaveCount(2)
      await page.waitForTimeout(240)

      if (type === 'card') {
        expectCreditsHeaderStyles(await readCreditHeaderStyles(schedule.locator('[role="columnheader"]')), 'center')
      } else {
        expectCreditsHeaderStyles(await readCreditHeaderStyles(schedule.locator('thead th')))
      }

      if (type === 'card') {
        const movementTrigger = page.getByRole('button', { name: /Ver movimientos de/ }).first()
        await movementTrigger.click()
        const movementDialog = page.getByRole('dialog', { name: /Movimientos de/ })
        await expect(movementDialog).toBeVisible()
        expectCreditsHeaderStyles(await readCreditHeaderStyles(movementDialog.locator('thead th')))
        await expect.poll(() => activeTrapCount(page)).toBe(1)
        await expect(page.locator('[data-ft-workbench-overlay]')).toHaveCount(3)
        await page.keyboard.press('Escape')
        await expect(page.getByRole('dialog', { name: /Movimientos de/ })).toHaveCount(0)
        await expect(schedule).toBeVisible()
        await expect.poll(() => activeTrapCount(page)).toBe(1)
        await expect(movementTrigger).toBeFocused()
        await expect(page.locator('#nested-state')).toHaveText('true')
      }

      await page.keyboard.press('Escape')
      await expect(schedule).toHaveCount(0)
      await expect(page.getByTestId('parent-workbench')).toBeVisible()
      await expect(page.locator('#nested-state')).toHaveText('false')
      await expect.poll(() => activeTrapCount(page)).toBe(1)
      await expect(trigger).toBeFocused()

      await trigger.evaluate((element: HTMLButtonElement) => element.click())
      await expect(schedule).toBeVisible()
      await expect.poll(() => activeTrapCount(page)).toBe(1)
      await page.mouse.click(8, 8)
      await expect(schedule).toHaveCount(0)
      await expect(page.getByTestId('parent-workbench')).toBeVisible()
      await expect.poll(() => activeTrapCount(page)).toBe(1)
      await expect(trigger).toBeFocused()

      await page.getByRole('button', { name: 'Cerrar panel' }).first().click()
      await expect(page.getByTestId('parent-workbench')).toHaveCount(0)
      await expect.poll(() => activeTrapCount(page)).toBe(0)
      expect(await page.locator('[data-ft-workbench-overlay]').count()).toBe(0)
    })
  }
}

test('new card can stage a statement and uploads it after the persisted billing cycle exists', async ({ page }) => {
  await mountRealCreditModals(page, 'card', 'create')
  await page.getByTestId('credit-card-name-input').fill('Tarjeta sintética')
  await page.getByTestId('credit-card-limit-input').fill('5000')
  await page.getByRole('button', { name: 'Revisar ciclos' }).click()

  const uploadInput = page.getByTestId('billing-cycle-statement-upload-credits-test-id')
  await uploadInput.setInputFiles({
    name: 'estado-cuenta.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('synthetic statement'),
  })
  const stagedStatementStatus = page.locator('[aria-live="polite"]:visible').filter({ hasText: 'Pendiente' })
  await expect(stagedStatementStatus).toBeVisible()
  await expect(stagedStatementStatus).toHaveAttribute('title', 'Listo al guardar: estado-cuenta.pdf')
  await page.getByRole('button', { name: 'Listo' }).click()
  await expect(page.getByRole('dialog', { name: 'Cronograma completo de la tarjeta' })).toBeHidden()
  await page.getByRole('button', { name: 'Crear tarjeta' }).click()

  await expect.poll(() => page.evaluate(() => (window as unknown as { __creditSaved: string[] | null }).__creditSaved)).toEqual([
    'Tarjeta sintética', undefined, 'created-card-1',
  ])
  await expect.poll(() => page.evaluate(() => (window as unknown as { __attachmentCalls: Array<{ endpoint: string; name: string; size: number }> }).__attachmentCalls)).toEqual([
    { endpoint: '/api/credits/created-card-1/billing-cycles/created-cycle-1/statement', name: 'estado-cuenta.pdf', size: 19 },
  ])
  expect(await page.evaluate(() => (window as unknown as { __creditRequests: Array<{ path: string; method: string }> }).__creditRequests))
    .toContainEqual({ path: '/api/credits/created-card-1/billing-cycles', method: 'POST' })
})

test('edit card opens and replaces a saved billing-cycle statement through its record-scoped endpoint', async ({ page }) => {
  await mountRealCreditModals(page, 'card', 'edit', undefined, 'credits/card-1/cycles/cycle-1/statement.pdf')
  await page.evaluate(() => {
    const state = window as unknown as { __openedStatement: string | null }
    window.open = ((url?: string | URL | null) => { state.__openedStatement = String(url); return null }) as typeof window.open
  })
  await page.getByRole('button', { name: 'Revisar ciclos' }).click()
  const schedule = page.getByRole('dialog', { name: 'Cronograma completo de la tarjeta' })
  const row = page.getByTestId('credit-cycle-row-cycle-1')
  await expect(row.getByText('Estado adjunto')).toBeVisible()
  await row.getByRole('button', { name: 'Abrir estado de cuenta de 10/2026' }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __openedStatement: string | null }).__openedStatement))
    .toBe('https://example.test/signed-statement')

  const replaceInput = row.getByTestId('billing-cycle-statement-upload-cycle-1')
  await replaceInput.setInputFiles({ name: 'estado-reemplazo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('synthetic replacement') })
  await expect(row.getByText('Estado adjunto')).toBeVisible()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __attachmentCalls: Array<{endpoint:string;name:string}> }).__attachmentCalls.at(-1)))
    .toMatchObject({ endpoint:'/api/credits/card-1/billing-cycles/cycle-1/statement', name:'estado-reemplazo.pdf' })
  await expect(schedule).toBeVisible()
})

for (const width of [390, 834, 1440, 1710]) {
  for (const cycleCount of [1, 6, 12]) {
    test(`card schedule keeps every cycle readable without horizontal overflow at ${width}px (${cycleCount} cycles)`, async ({ page }) => {
      await mountRealCreditModals(page, 'card', 'edit', { width, height: width < 500 ? 850 : 900 }, null, true)
      await page.getByRole('button', { name: 'Revisar ciclos' }).click()
      const schedule = page.getByRole('dialog', { name: 'Cronograma completo de la tarjeta' })
      await expect(schedule).toBeVisible()
      await expect(page.getByTestId('credit-card-schedule-cycles').locator('[data-testid^="credit-cycle-row-"]')).toHaveCount(1)
      await page.waitForTimeout(300)
      for (let index = 1; index < cycleCount; index += 1) await schedule.getByRole('button', { name: 'Agregar ciclo' }).click()

      const cycles = page.getByTestId('credit-card-schedule-cycles')
      const table = page.getByTestId('credit-card-schedule-table')
      const rows = page.locator('[data-testid^="credit-cycle-row-"]')
      await expect(rows).toHaveCount(cycleCount)
      await expect(table.locator('[role="columnheader"]')).toHaveCount(8)
      await expect(table).toContainText('Consumo desde')
      await expect(table).toContainText('Consumo hasta')
      await expect(table).toContainText('Fecha de pago')
      await expect(rows.first().locator('[role="cell"]')).toHaveCount(8)
      await expect(rows.first().locator('label[aria-label^="Adjuntar estado de cuenta"]')).toBeVisible()
      const firstCycle = rows.first()
      const monthTrigger = firstCycle.locator('[data-testid^="credit-cycle-month-"]')
      const yearTrigger = firstCycle.locator('[data-testid^="credit-cycle-year-"]')
      await expect(monthTrigger).toBeVisible()
      await expect(yearTrigger).toBeVisible()
      await expect(monthTrigger).toContainText('Octubre')
      await expect(yearTrigger).toContainText('2026')
      await expect(firstCycle.locator('input[placeholder="DD/MM/AAAA"]').first()).toHaveValue(/^\d{2}\/10\/2026$/)

      const measurement = await table.evaluate(element => {
        const rect = element.getBoundingClientRect()
        const rows = Array.from(element.querySelectorAll<HTMLElement>('[data-testid^="credit-cycle-row-"]'))
        const rectOf = (item: Element) => {
          const box = item.getBoundingClientRect()
          return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height }
        }
        const rowDetails = rows.map(row => {
          const cells = Array.from(row.querySelectorAll<HTMLElement>('[role="cell"]'))
          const controls = Array.from(row.querySelectorAll<HTMLElement>('select, input:not([type="file"]), button'))
          const labels = Array.from(row.querySelectorAll<HTMLElement>('[class*="cellLabel"]')).map(label => ({
            text: label.textContent?.trim(), client: label.clientWidth, scroll: label.scrollWidth,
          }))
          const amounts = Array.from(row.querySelectorAll<HTMLElement>('[class*="amountCell"] strong')).map(amount => ({
            text: amount.textContent?.trim(), client: amount.clientWidth, scroll: amount.scrollWidth,
          }))
          return {
            row: rectOf(row), cells: cells.map(rectOf),
            columns: getComputedStyle(row).gridTemplateColumns.split(' ').filter(Boolean),
            controls: controls.map(rectOf), labels, amounts,
            text: row.innerText,
            badOverlap: controls.some((control, index) => controls.slice(index + 1).some(other => {
              const a = control.getBoundingClientRect(), b = other.getBoundingClientRect()
              return a.width > 0 && b.width > 0 && a.left < b.right - 2 && a.right > b.left + 2 && a.top < b.bottom - 2 && a.bottom > b.top + 2
            })),
          }
        })
        const header = element.querySelector<HTMLElement>('[role="row"]')
        const headerCells = Array.from(header?.querySelectorAll<HTMLElement>('[role="columnheader"]') ?? [])
        const periodText = Array.from(rows[0]?.querySelectorAll<HTMLElement>('.app-select-trigger-label') ?? []).map(label => ({ text: label.textContent?.trim(), client: label.clientWidth, scroll: label.scrollWidth }))
        const registeredTotals = Array.from(element.closest<HTMLElement>('[data-testid="credit-card-schedule-table-scroll"]')
          ?.parentElement?.querySelectorAll<HTMLElement>('[data-testid="credit-card-schedule-grand-totals"] strong') ?? [])
          .map(amount => ({ client: amount.clientWidth, scroll: amount.scrollWidth, text: amount.textContent?.trim() }))
        const overlay = element.closest<HTMLElement>('.app-modal-overlay')
        const scrollContainer = element.closest<HTMLElement>('[data-testid="credit-card-schedule-table-scroll"]')
        const workbench = overlay?.querySelector<HTMLElement>('.ft-v3-workbench-wrapper')
        const panel = overlay?.querySelector<HTMLElement>('[data-ft-workbench]')
        const body = panel?.querySelector<HTMLElement>('[data-record-modal-body]')
        const footer = panel?.lastElementChild instanceof HTMLElement ? panel.lastElementChild : null
        const measureRect = (node: HTMLElement | null | undefined) => {
          if (!node) return null
          const box = node.getBoundingClientRect()
          return { top: box.top, bottom: box.bottom, left: box.left, right: box.right, width: box.width, height: box.height }
        }
        return {
          viewport: window.innerWidth,
          viewportHeight: window.innerHeight,
          clientWidth: scrollContainer?.clientWidth ?? element.clientWidth,
          scrollWidth: scrollContainer?.scrollWidth ?? element.scrollWidth,
          right: rect.right, rows: rowDetails,
          headerVisible: Boolean(header && getComputedStyle(header).display !== 'none'),
          headers: headerCells.map(rectOf),
          periodText,
          registeredTotals,
          wrapper: measureRect(workbench), panel: measureRect(panel), body: measureRect(body), footer: measureRect(footer),
          cycleList: measureRect(scrollContainer),
          documentWidth: document.documentElement.scrollWidth,
          listHeight: scrollContainer?.clientHeight ?? 0, listScrollHeight: scrollContainer?.scrollHeight ?? 0,
        }
      })
      expect(measurement.viewport).toBe(width)
      expect(measurement.right).toBeLessThanOrEqual(width)
      expect(measurement.scrollWidth).toBeLessThanOrEqual(measurement.clientWidth + 1)
      expect(measurement.documentWidth).toBeLessThanOrEqual(width)
      expect(measurement.rows).toHaveLength(cycleCount)
      const viewportHeight = measurement.viewportHeight
      const expectedWorkbenchHeight = viewportHeight - (width < 768 ? 16 : 24)
      console.log(`Credit schedule workbench ${width}px`, JSON.stringify({ viewportHeight, wrapper: measurement.wrapper, panel: measurement.panel, body: measurement.body, footer: measurement.footer, cycleList: measurement.cycleList }))
      expect(measurement.wrapper?.height).toBeCloseTo(expectedWorkbenchHeight, 0)
      expect(measurement.panel?.height).toBeCloseTo(expectedWorkbenchHeight, 0)
      expect(measurement.wrapper?.top).toBeGreaterThanOrEqual(width < 768 ? 7 : 11)
      expect(measurement.wrapper?.bottom).toBeLessThanOrEqual(viewportHeight - (width < 768 ? 7 : 11))
      expect(measurement.body?.bottom).toBeLessThanOrEqual((measurement.footer?.top ?? 0) + 1)
      expect(Math.abs((measurement.footer?.bottom ?? 0) - (measurement.panel?.bottom ?? 0))).toBeLessThanOrEqual(2)
      expect(measurement.cycleList?.bottom).toBeLessThanOrEqual((measurement.footer?.top ?? 0) + 1)
      measurement.rows.forEach((row, rowIndex) => {
        expect(row.row.width).toBeGreaterThan(width < 500 ? 300 : 500)
        expect(row.cells).toHaveLength(8)
        expect(row.badOverlap).toBe(false)
        expect(row.controls.every(control => control.width > 0 && control.right <= measurement.right + 1)).toBe(true)
        expect(row.labels.every(label => label.client === 0 || label.scroll <= label.client + 1)).toBe(true)
        expect(row.amounts.every(amount => amount.scroll <= amount.client + 1)).toBe(true)
        if (rowIndex === 0) expect(measurement.periodText.every(label => label.scroll <= label.client + 1)).toBe(true)
        expect(row.amounts.map(amount => amount.text)).toEqual(rowIndex === 0
          ? ['1234567890.23', '987654321.09']
          : ['0.00', '0.00'])
        expect(row.text).toContain('Octubre')
        expect(row.text).toContain('2026')
      })
      if (cycleCount === 1) {
        if ([390, 1440].includes(width)) {
          await page.screenshot({ path: `/tmp/fintrack-credits-r5-schedule-${width}.png`, fullPage: true })
        }
        const componentGeometry = await firstCycle.evaluate(element => {
          const month = element.querySelector<HTMLElement>('[data-testid^="credit-cycle-month-"]')!
          const year = element.querySelector<HTMLElement>('[data-testid^="credit-cycle-year-"]')!
          const date = element.querySelector<HTMLElement>('input[placeholder="DD/MM/AAAA"]')!
          const rect = (item: HTMLElement) => ({ width: item.getBoundingClientRect().width, left: item.getBoundingClientRect().left, right: item.getBoundingClientRect().right })
          const table = element.closest('[role="table"]')!
          const headerCells = Array.from(table.querySelectorAll<HTMLElement>('[role="columnheader"]'))
          const cells = Array.from(element.querySelectorAll<HTMLElement>('[role="cell"]'))
          return {
            month: rect(month), year: rect(year), date: rect(date), rowHeight: element.getBoundingClientRect().height,
            desktopSingleRow: getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length === 8,
            headerVisible: Boolean(headerCells.length && getComputedStyle(headerCells[0]!.parentElement!).display !== 'none'),
            headerCellWidths: headerCells.map(header => header.getBoundingClientRect().width),
            rowCellWidths: cells.map(cell => cell.getBoundingClientRect().width),
            visibleCellLabels: Array.from(element.querySelectorAll<HTMLElement>('[class*="cellLabel"]')).map(label => getComputedStyle(label).display !== 'none'),
          }
        })
        console.log(`Credit schedule ${width}px actual controls`, JSON.stringify(componentGeometry))
        if (width >= 1440) {
          expect(componentGeometry.desktopSingleRow).toBe(true)
          expect(componentGeometry.headerVisible).toBe(true)
          expect(componentGeometry.headerCellWidths).toHaveLength(8)
          expect(componentGeometry.rowHeight).toBeLessThanOrEqual(56)
          componentGeometry.rowCellWidths.forEach((cellWidth, index) => expect(Math.abs(cellWidth - componentGeometry.headerCellWidths[index]!)).toBeLessThanOrEqual(2))
        } else if (width === 834) {
          expect(componentGeometry.desktopSingleRow).toBe(false)
          expect(componentGeometry.visibleCellLabels.every(Boolean)).toBe(true)
        } else if (width === 390) {
          expect(componentGeometry.visibleCellLabels.every(Boolean)).toBe(true)
        }
        const dateTrigger = firstCycle.getByRole('button', { name: 'Abrir calendario' }).first()
        await dateTrigger.click()
        const calendar = page.getByRole('dialog', { name: 'Seleccionar fecha' })
        await expect(calendar).toBeVisible()
        const calendarGeometry = await calendar.evaluate(element => ({ left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right, width: element.getBoundingClientRect().width, viewport: window.innerWidth }))
        expect(calendarGeometry.left).toBeGreaterThanOrEqual(0)
        expect(calendarGeometry.right).toBeLessThanOrEqual(width)
        expect(calendarGeometry.width).toBeGreaterThan(250)
        await page.keyboard.press('Escape')
        await expect(calendar).toHaveCount(0)

        await monthTrigger.click()
        const monthMenu = page.getByRole('dialog', { name: 'Mes del periodo' })
        await expect(monthMenu).toBeVisible()
        await monthMenu.evaluate(async element => {
          await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => undefined)))
        })
        const monthMenuGeometry = await monthMenu.evaluate(element => ({
          width: element.getBoundingClientRect().width,
          triggerWidth: document.querySelector<HTMLElement>('[data-testid^="credit-cycle-month-"]')!.getBoundingClientRect().width,
          right: element.getBoundingClientRect().right,
          viewport: window.innerWidth,
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
        }))
        expect(Math.abs(monthMenuGeometry.width - monthMenuGeometry.triggerWidth)).toBeLessThanOrEqual(2)
        expect(monthMenuGeometry.right).toBeLessThanOrEqual(width)
        expect(monthMenuGeometry.scrollWidth).toBeLessThanOrEqual(monthMenuGeometry.clientWidth + 1)
        await page.keyboard.press('Escape')
        await expect(monthMenu).toHaveCount(0)
        await expect(monthTrigger).toBeFocused()
      }
      expect(measurement.registeredTotals.every(amount => amount.scroll <= amount.client + 1)).toBe(true)
      if (cycleCount > 6) expect(measurement.listScrollHeight).toBeGreaterThan(measurement.listHeight)
      await expect(rows.first().getByRole('button', { name: 'Ver movimientos de 10/2026' })).toBeVisible()
    })
  }
}

test('duplicate billing periods keep their inline warning when the tabular layout is used', async ({ page }) => {
  await mountRealCreditModals(page, 'card', 'create', { width: 1440, height: 900 })
  await page.getByRole('button', { name: 'Revisar ciclos' }).click()
  const schedule = page.getByRole('dialog', { name: 'Cronograma completo de la tarjeta' })
  await schedule.getByRole('button', { name: 'Agregar ciclo' }).click()
  const monthTriggers = page.getByRole('button', { name: 'Mes del periodo' })
  await expect(monthTriggers).toHaveCount(2)
  await monthTriggers.nth(1).click()
  await page.getByRole('option', { name: 'Octubre' }).click()
  await expect(schedule.getByText('Periodo duplicado.').first()).toBeVisible()
  await expect(schedule.locator('[role="row"]')).toHaveCount(3)
})

test('bank loan form keeps schedule content scrollable above the shared anchored action footer', async ({ page }) => {
  await mountRealCreditModals(page, 'loan', 'create', { width: 834, height: 700 })
  const form = page.getByTestId('bank-loan-form')
  const content = page.getByTestId('bank-loan-form-content')
  const footer = form.locator('[class*="operationFormActions"]')
  await expect(form.locator('button[type="submit"]')).toBeVisible()
  await expect(content).toBeVisible()
  await expect(footer).toBeVisible()
  const layout = await page.evaluate(() => {
    const form = document.querySelector<HTMLElement>('[data-testid="bank-loan-form"]')!
    const content = document.querySelector<HTMLElement>('[data-testid="bank-loan-form-content"]')!
    const footer = form.querySelector<HTMLElement>('[class*="operationFormActions"]')!
    const body = form.closest('[data-record-modal-body]')!
    const formRect = form.getBoundingClientRect()
    const contentRect = content.getBoundingClientRect()
    const footerRect = footer.getBoundingClientRect()
    const bodyRect = body.getBoundingClientRect()
    return {
      contentOverflowY: getComputedStyle(content).overflowY,
      contentScrollHeight: content.scrollHeight,
      contentClientHeight: content.clientHeight,
      footerClass: footer.className,
      footerBottom: footerRect.bottom,
      bodyBottom: bodyRect.bottom,
      formBottom: formRect.bottom,
      contentBottom: contentRect.bottom,
    }
  })
  expect(layout.contentOverflowY).toBe('auto')
  expect(layout.contentScrollHeight).toBeGreaterThan(layout.contentClientHeight)
  expect(layout.footerClass).toContain('operationFormActions')
  expect(layout.footerBottom).toBeLessThanOrEqual(layout.bodyBottom + 3)
  expect(layout.contentBottom).toBeLessThanOrEqual(layout.footerBottom + 1)
})

test('every active credits register table opts into the shared table-header contract', () => {
  const sources = [
    'components/credits/CreditsListPanel.tsx',
    'components/credits/CreditCardScheduleModal.tsx',
    'components/credits/BankLoanScheduleModal.tsx',
    'components/credits/LoanDetailsModal.tsx',
  ].map(path => readFileSync(join(process.cwd(), path), 'utf8'))

  for (const source of sources) {
    expect(source).toContain('@/components/credits/CreditsTableHeader.module.css')
    expect(source).toContain('creditsTableHead')
  }
  expect(sources[0]).toContain('creditsTableHeaderGridCell')
  expect(sources[1]).toContain('creditsTableHeaderTableCell')
  expect(sources[1]).toContain('creditsTableHeaderGridCell')
  expect(sources[2]).toContain('creditsTableHeaderTableCell')
  expect(sources[3]).toContain('creditsTableHeaderTableCell')
})

test('credits create and edit parents wire nested workbench state to the actual RecordModal focus trap', () => {
  const workspace = readFileSync(join(process.cwd(), 'components/credits/CreditsWorkspace.tsx'), 'utf8')
  const list = readFileSync(join(process.cwd(), 'components/credits/CreditsListPanel.tsx'), 'utf8')
  const cardSchedule = readFileSync(join(process.cwd(), 'components/credits/CreditCardScheduleModal.tsx'), 'utf8')
  expect(workspace).toContain('focusTrapActive={!isNestedModalOpen}')
  expect(workspace).toContain('onNestedModalOpenChange={setIsNestedModalOpen}')
  expect(list).toContain('focusTrapActive={!isNestedEditModalOpen}')
  expect(list).toContain('onNestedModalOpenChange={setIsNestedEditModalOpen}')
  expect(cardSchedule).not.toContain('useEffect(() => {\n    onMovementModalOpenChange?.(Boolean(movementCycle))')
})
