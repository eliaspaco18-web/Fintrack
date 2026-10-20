import { expect, test, type Page } from '@playwright/test'
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

async function mountRealCreditModals(page: Page, type: 'card' | 'loan', mode: 'create' | 'edit') {
  const runtimeErrors: string[] = []
  page.on('pageerror', error => runtimeErrors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.setContent('<div class="fin-shell" data-ft-v3-shell><div id="root"></div></div>')
  await page.addScriptTag({ content: "if (!crypto.randomUUID) Object.defineProperty(crypto, 'randomUUID', { value: () => 'credits-test-id' })" })
  const cssPath = join(process.cwd(), '.next/static/css')
  const css = readdirSync(cssPath).filter(file => file.endsWith('.css')).sort().map(file => readFileSync(join(cssPath, file), 'utf8')).join('\n')
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
    window.__creditsModules['@/components/ui/AppSelect'] = { AppSelect: ({options=[], value='', onChange, ariaLabel, disabled, className, ...props}) => React.createElement('select', { value, onChange: event => onChange?.(event.target.value), 'aria-label': ariaLabel, disabled, className, ...props }, options.map(option => React.createElement('option', { key: option.value, value: option.value }, option.label))) };
    window.__creditsModules['@/components/ui/NumericInput'] = { NumericInput: ({value='', onValueChange, disabled, ...props}) => React.createElement('input', { value: String(value ?? ''), onChange: event => onValueChange?.(event.target.value), disabled, ...props }) };
    window.__creditsModules['@/components/forms/primitives'] = {
      FormActions: ({primaryAction, secondaryAction}) => React.createElement('div', null, secondaryAction, primaryAction),
      FormField: ({label, labelAdornment, children, error}) => React.createElement('div', null, React.createElement('label', null, label, labelAdornment), children, error ? React.createElement('span', null, error) : null),
      FormSection: ({title, description, children}) => React.createElement('section', null, React.createElement('h3', null, title), description ? React.createElement('p', null, description) : null, children),
    };
    window.__creditsModules['@/components/credits/CreditInfoHint'] = { CreditInfoHint: ({label, children}) => React.createElement('span', { title: label }, children) };
    window.__creditsModules['@/components/forms/TransactionForm/IncomeDatePicker'] = { IncomeDatePicker: props => React.createElement('input', { type: 'date', ...props }) };
    window.__creditsModules['@/components/credits/credits-schedule.constants'] = {
      SCHEDULE_MONTHS: Array.from({length:12}, (_, index) => ({ value: String(index + 1).padStart(2, '0'), label: String(index + 1) })),
      CREDIT_CARD_DATE_INPUT_MIN_WIDTH: 120, BANK_LOAN_DATE_INPUT_MIN_WIDTH: 120,
      formatBillingCycleLabel: (month, year) => month + '/' + year,
      formatDuplicateCycleMessage: () => '', formatScheduleDateLabel: value => value,
    };
    window.__creditsModules['@/lib/credits/billing-cycle-years'] = { getBillingCycleYearOptions: () => [{value:'2026',label:'2026'}] };
    window.__creditsModules['@/lib/api/error-message'] = { getApiErrorMessage: (_json, fallback) => fallback };
    window.__creditsModules['@/lib/utils/numeric-input'] = { parseNumericInput: value => Number.parseFloat(String(value ?? '')) || 0, roundToDecimals: (value, decimals=2) => Number(Number(value).toFixed(decimals)) };
    window.__creditsModules['@/lib/contracts/ui.contracts'] = { formatNumber: value => Number(value ?? 0).toFixed(2), formatCurrency: value => String(value) };
    window.__creditsModules['@/modules/attachments/attachment-integrity'] = { ATTACHMENT_UPDATE_BLOCKED_MESSAGE: 'blocked' };
    window.__creditsModules['@/modules/attachments/attachment-client'] = { requestAttachmentUpload: async () => ({ok:true}) };
    window.__creditsModules['@/modules/credits/billing-cycle-integrity'] = { getBillingCycleDateIssue: () => null, getBillingCyclesSubmissionIssue: () => null };
    window.__creditsModules['@/modules/credits/exchange-rate-integrity'] = { resolveCreditExchangeRateInput: () => ({ok:true, value:1}) };
    window.__creditsModules['@/modules/loans/loan-schedule-integrity'] = { resizeScheduleRows: (rows, count, buildRow) => Array.from({length:count}, (_, index) => rows[index] || buildRow(index)) };
    window.__creditsModules['@/modules/loans/loan-type'] = { LOAN_TYPE_VALUES: ['CONSUMPTION'], getLoanTypeLabel: value => value };
    window.__creditsModules['@/components/credits/CreditsWorkbench.module.css'] = { default: { creditFormOverlay:'credit-form-overlay', creditScheduleOverlay:'credit-schedule-overlay' } };
    window.fetch = async (input) => {
      const path = String(input);
      const bank = {id:'bank-1',name:'Banco de prueba',short_name:'Banco',is_active:true};
      const cycle = {id:'cycle-1',billing_month:10,billing_year:2026,consumption_from:'2026-10-01',consumption_to:'2026-10-31',payment_date:'2026-11-10',total_to_pay:25,total_to_pay_pen:25,total_to_pay_usd:0,movement_summary:null,can_delete:true,statement_url:null};
      let data = [];
      if (path === '/api/bank-entities') data = [bank];
      else if (path === '/api/accounts') data = [{id:'account-1',name:'Cuenta de prueba',type:'CHECKING',currency:'PEN',is_active:true}];
      else if (path === '/api/credits/card-1/billing-cycles') data = [cycle];
      else if (path === '/api/credits/loan-1') data = {credit:{account_id:'account-1',name:'Préstamo de prueba'},loan:{bank_entity_id:'bank-1',loan_type:'CONSUMPTION',name:'Préstamo de prueba',start_date:'2026-01-01',total_installments:1},disbursement:{transaction_date:'2026-01-01',description:'',exchange_rate:null},installments:[{id:'installment-1',due_date:'2026-02-01',principal_amount:100,interest_amount:0,insurance_amount:0,other_charges:0}],permissions:{can_edit_loan_finances:true}};
      return {ok:true,status:200,json:async()=>({ok:true,data})};
    };
  })();` })

  await page.addScriptTag({ content: compileFocusTrap() })
  await page.addScriptTag({ content: compilePresenceHook() })
  await page.addScriptTag({ content: compileBackgroundManager() })
  await page.addScriptTag({ content: compileComponent('components/ui/RecordModal.tsx', '@/components/ui/RecordModal', ['RecordModal', 'RecordModalFooter']) })
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
        ? React.createElement(window.__creditsModules['@/components/credits/CreditCardForm'].CreditCardForm, {mode,credit:mode === 'edit' ? card : null,onSuccess:()=>{},onCancel:()=>setParentOpen(false),onNestedModalOpenChange:setNestedOpen})
        : React.createElement(window.__creditsModules['@/components/credits/BankLoanForm'].BankLoanForm, {mode,creditId:mode === 'edit' ? 'loan-1' : undefined,onSuccess:()=>{},onCancel:()=>setParentOpen(false),onNestedModalOpenChange:setNestedOpen});
      return React.createElement(React.Fragment, null,
        React.createElement('button',{id:'outside-focus'},'Outside'),
        React.createElement(window.__creditsModules['@/components/ui/RecordModal'].RecordModal,{open:parentOpen,onClose:()=>{window.__modalCloseCounts.parent++;setParentOpen(false)},title:type === 'card'?'Parent card':'Parent loan',focusTrapActive:!nestedOpen,preserveFocusOnResume:true,presentation:'workbench',testId:'parent-workbench'},body),
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

for (const type of ['card', 'loan'] as const) {
  for (const mode of ['create', 'edit'] as const) {
    test(`${mode} ${type} form suspends lower workbenches until nested close completes`, async ({ page }) => {
      await mountRealCreditModals(page, type, mode)
      const trigger = page.locator(type === 'card' ? '#credit-card-schedule-trigger' : '#bank-loan-schedule-trigger')
      await trigger.click()
      const schedule = page.getByRole('dialog', { name: type === 'card' ? 'Cronograma completo de la tarjeta' : 'Cronograma completo del préstamo' })
      await expect(schedule).toBeVisible()
      await expect(page.locator('#nested-state')).toHaveText('true')
      await expect.poll(() => activeTrapCount(page)).toBe(1)
      await expect(page.locator('[data-ft-workbench-overlay]')).toHaveCount(2)

      if (type === 'card') {
        const movementTrigger = page.getByRole('button', { name: /Ver movimientos de/ }).first()
        await movementTrigger.click()
        await expect(page.getByRole('dialog', { name: /Movimientos de/ })).toBeVisible()
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

      await trigger.click()
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
