import { expect, test } from '@playwright/test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

const reactPath = join(process.cwd(), 'node_modules/react/umd/react.development.js')
const reactDomPath = join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js')

function compileComponent(path: string, moduleId: string, exportName: string) {
  const sourceFile = ts.createSourceFile(join(process.cwd(), path), readFileSync(join(process.cwd(), path), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const removals: Array<{ start: number; end: number }> = []
  const bindings: string[] = []
  sourceFile.statements.forEach(statement => {
    if (!ts.isImportDeclaration(statement)) return
    removals.push({ start: statement.getStart(sourceFile), end: statement.end })
    if (!statement.importClause || statement.importClause.isTypeOnly) return
    const specifier = (statement.moduleSpecifier as ts.StringLiteral).text
    const local = `__receivablesImport${bindings.length}`
    bindings.push(`const ${local} = window.__receivablesModules[${JSON.stringify(specifier)}] || {};`)
    const clause = statement.importClause
    if (clause.name) bindings.push(`const ${clause.name.text} = ${local}.default;`)
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) clause.namedBindings.elements.filter(item => !item.isTypeOnly).forEach(item => {
      const imported = item.propertyName?.text ?? item.name.text
      bindings.push(`const ${item.name.text} = ${local}[${JSON.stringify(imported)}];`)
    })
  })
  let source = sourceFile.text
  removals.sort((a, b) => b.start - a.start).forEach(range => { source = `${source.slice(0, range.start)}${source.slice(range.end)}` })
  source = source.replace(/^'use client'\s*/, '').replace(/\bexport\s+(?=(?:async\s+)?(?:function|const|class|interface|type)\b)/g, '')
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React } }).outputText.replace(/^export\s*\{\s*\};?\s*$/gm, '')
  return `(() => { const React = window.React; ${bindings.join('\n')}\n${compiled}\nwindow.__receivablesModules[${JSON.stringify(moduleId)}] = { ...(window.__receivablesModules[${JSON.stringify(moduleId)}] || {}), ${exportName} }; })();`
}

function cssModuleMap(css: string, sourcePath: string, prefix: string) {
  const names = new Set(readFileSync(join(process.cwd(), sourcePath), 'utf8').match(/\.([A-Za-z][\w-]*)/g)?.map(name => name.slice(1)) ?? [])
  return Object.fromEntries(Array.from(names, name => [name, css.match(new RegExp(`\.(${prefix}_${name}__[\\w-]+)`))?.[1] ?? name]))
}

function compileFocusTrap() {
  const source = readFileSync(join(process.cwd(), 'components/ui/accessibility.tsx'), 'utf8')
  const fragment = source.slice(source.indexOf('const FOCUSABLE ='), source.indexOf('// ─── KEYBOARD SHORTCUTS'))
    .replace('export function FocusTrap', 'function FocusTrap')
  const compiled = ts.transpileModule(`const { useEffect, useRef } = window.React;\n${fragment}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React },
  }).outputText.replace(/^export\s*\{\s*\};?\s*$/gm, '')
  return `(() => { const React = window.React; ${compiled}\nwindow.__receivablesModules['@/components/ui/accessibility'] = { FocusTrap }; })();`
}

function compilePresenceHook() {
  const sourceFile = ts.createSourceFile(join(process.cwd(), 'lib/ui/use-v3-workbench-presence.ts'), readFileSync(join(process.cwd(), 'lib/ui/use-v3-workbench-presence.ts'), 'utf8'), ts.ScriptTarget.Latest, true)
  const importRanges = sourceFile.statements.filter(ts.isImportDeclaration).map(statement => ({ start: statement.getStart(sourceFile), end: statement.end }))
  let source = sourceFile.text.replace(/^'use client'\s*/, '')
  importRanges.sort((a, b) => b.start - a.start).forEach(range => { source = `${source.slice(0, range.start)}${source.slice(range.end)}` })
  source = source.replace(/^export\s+(?=(?:async\s+)?(?:function|const|class|interface|type)\b)/gm, '')
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText.replace(/^export\s*\{\s*\};?\s*$/gm, '')
  return `(() => { const { useEffect, useLayoutEffect, useRef, useState } = window.React; ${compiled}\nwindow.__receivablesModules['@/lib/ui/use-v3-workbench-presence'] = { useV3WorkbenchPresence }; })();`
}

test('real debtor detail renders inside the wide RecordModal workbench with native-currency summary, compact rows, and nested create flow', async ({ page }) => {
  page.on('pageerror', error => console.info('Receivables detail browser error:', error.stack ?? error.message))
  const cssRoot = join(process.cwd(), '.next/static/css')
  const css = readdirSync(cssRoot).filter(file => file.endsWith('.css')).sort().map(file => readFileSync(join(cssRoot, file), 'utf8')).join('\n')
  const detailClasses = cssModuleMap(css, 'components/receivables/DebtorDetail.module.css', 'DebtorDetail')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.setContent('<main data-ft-v3-shell><div id="root"><button id="launch">Ver cuenta</button></div></main>')
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: `window.React=React; window.__receivablesModules={};
    window.__receivablesModules.react=React; window.__receivablesModules['react-dom']={createPortal:ReactDOM.createPortal};
    window.__receivablesModules['@/lib/ui/v3-modal-background']={acquireV3ModalBackground:()=>()=>{}};
    window.__receivablesModules['next/link']={default:({href,children,...props})=>React.createElement('a',{...props,href},children)};
    window.__receivablesModules['@/components/ui/Button']={Button:({children,testId,ariaLabel,leadingIcon,type='button',onClick,form,disabled,className})=>React.createElement('button',{type,onClick,form,disabled,className,'data-testid':testId,'aria-label':ariaLabel},leadingIcon,React.createElement('span',null,children))};
    window.__receivablesModules['@/components/ui/AppSelect']={AppSelect:({value,onChange,options,ariaLabel,className})=>React.createElement('select',{value,onChange:event=>onChange(event.target.value),'aria-label':ariaLabel,className},options.map(option=>React.createElement('option',{key:option.value,value:option.value},option.label)))};
    window.__receivablesModules['@/components/forms/primitives']={FormActions:({secondaryAction,primaryAction})=>React.createElement('div',{className:'flex justify-end gap-2'},secondaryAction,primaryAction)};
    window.__receivablesModules['@/components/finance']={ConfirmDialog:()=>null,DataErrorBanner:({message})=>React.createElement('p',{role:'alert'},message),DataSearchField:({value,onChange,placeholder,ariaLabel,className,...props})=>React.createElement('div',{className},React.createElement('input',{...props,value,onChange:event=>onChange(event.target.value),placeholder,'aria-label':ariaLabel})),EmptyState:({title,description})=>React.createElement('div',null,React.createElement('strong',null,title),React.createElement('p',null,description))};
    window.__receivablesModules['@/components/forms/TransactionForm/IncomeDatePicker']={IncomeDatePicker:({value,onChange,inputLabel,inputTestId})=>React.createElement('label',null,inputLabel,React.createElement('input',{type:'date',value,onChange:event=>onChange(event.target.value),'data-testid':inputTestId}))};
    window.__receivablesModules['@/lib/api/error-message']={getApiErrorMessage:(_json,fallback)=>fallback};
    window.__receivablesModules['@/lib/contracts/ui.contracts']={formatCurrency:(amount,currency)=>currency==='USD'?'$'+Number(amount).toFixed(2):'S/ '+Number(amount).toFixed(2)};
    window.__receivablesModules['@/modules/obligations/obligation-currency-presentation']={formatVerifiedObligationAmount:(amount,currency)=>(currency==='USD'?'$':'S/ ')+Number(amount).toFixed(2),getObligationSettlementState:()=> 'OPEN',resolveVerifiedObligationCurrency:currency=>['PEN','USD'].includes(currency)?currency:null,summarizeObligationLedgerCurrencies:()=>({summaries:[]})};
    window.__receivablesModules['@/modules/receivables/receivables-list-presentation']={getReceivableRecoveryProgress:summaries=>({available:true,items:summaries.map(summary=>({currency:summary.currency,percent:summary.total?Math.round(summary.settled/summary.total*1000)/10:null}))})};
    window.__receivablesModules['./ReceivableForm']={ReceivableForm:()=>React.createElement('form',{id:'receivable-form','data-testid':'receivable-form'},React.createElement('p',null,'Formulario sintético de prueba'))};
    window.__receivablesModules['./DebtorDetail.module.css']={default:${JSON.stringify(detailClasses)}};
    window.__fixtureDebtor={id:'debtor-1',name:'Lucía Andina',relationship:'Cliente recurrente',initial_debt:0,is_active:true,total_lent:1200,total_collected:450,pending_amount:750,progress_pct:37.5,all_collected:false,count_pending:2,receivables_count:2,currency_summaries:[{currency:'PEN',total:1000,settled:400,pending:600},{currency:'USD',total:200,settled:50,pending:150}],unverified_currency_records:0,unverified_open_currency_records:0,has_unverified_initial_debt:false};
    window.fetch=async url=>{
      const data=String(url).includes('/api/receivables?')?[
        {id:'r-pen',transaction_id:'t-2',debtor_id:'debtor-1',debtor_name:'Lucía Andina',concept:'Servicio de consultoría',amount:1000,collected_amount:400,currency:'PEN',issue_date:'2026-09-01',due_date:'2026-10-15',notes:null,attachment_url:null,status:'PARTIAL',source_account:{id:'a-1',name:'Cuenta principal'}},
        {id:'r-usd',transaction_id:null,debtor_id:'debtor-1',debtor_name:'Lucía Andina',concept:'Licencia anual',amount:200,collected_amount:50,currency:'USD',issue_date:'2026-09-04',due_date:null,notes:null,attachment_url:null,status:'PENDING'}
      ]:String(url).includes('/ledger')?[
        {id:'t-1',type:'INCOME',amount:400,currency:'PEN',description:'Primer abono',notes:null,transaction_date:'2026-09-10',created_at:'2026-09-10T12:00:00Z',source_account:{id:'a-1',name:'Cuenta principal'},category:{id:'c-1',name:'Servicios'}},
        {id:'t-2',type:'EXPENSE',amount:200,currency:'USD',description:'Desembolso inicial',notes:null,transaction_date:'2026-09-04',created_at:'2026-09-04T12:00:00Z',source_account:{id:'a-1',name:'Cuenta principal'},category:{id:'c-2',name:'Préstamos'}}
      ]:[{id:'a-1',name:'Cuenta principal'}];
      return {ok:true,json:async()=>({ok:true,data})};
    };` })
  await page.addScriptTag({ content: compileFocusTrap() })
  await page.addScriptTag({ content: compilePresenceHook() })
  await page.addScriptTag({ content: compileComponent('modules/receivables/debtor-financial-history.ts', '@/modules/receivables/debtor-financial-history', 'buildDebtorFinancialHistory') })
  await page.addScriptTag({ content: compileComponent('components/ui/RecordModal.tsx', '@/components/ui/RecordModal', 'RecordModal') })
  await page.addScriptTag({ content: compileComponent('components/receivables/DebtorDetail.tsx', '@/components/receivables/DebtorDetail', 'DebtorDetail') })
  await page.addScriptTag({ content: `function Harness(){
    const [open,setOpen]=React.useState(false); const [nested,setNested]=React.useState(false); const [createAction,setCreateAction]=React.useState(null);
    const Modal=window.__receivablesModules['@/components/ui/RecordModal'].RecordModal;
    const Detail=window.__receivablesModules['@/components/receivables/DebtorDetail'].DebtorDetail;
    const debtor=window.__fixtureDebtor;
    return React.createElement(React.Fragment,null,
      React.createElement('button',{id:'launch',onClick:()=>setOpen(true)},'Ver cuenta'),
      React.createElement(Modal,{open,onClose:()=>setOpen(false),title:debtor.name,subtitle:debtor.relationship,eyebrow:'Detalle de cuenta por cobrar',headerBadge:React.createElement('span',null,'Cobranza abierta'),size:'xl',presentation:'workbench',overlayClassName:${JSON.stringify(detailClasses.detailOverlay||'')},bodyClassName:${JSON.stringify(detailClasses.detailModalBody||'')},footerClassName:${JSON.stringify(detailClasses.detailModalFooter||'')},focusTrapActive:!nested,preserveFocusOnResume:true,preserveFocusOnDeactivate:true,testId:'debtor-detail-workbench',footer:React.createElement('div',{className:${JSON.stringify(detailClasses.detailFooterActions||'')}},React.createElement('button',{type:'button','data-testid':'new-obligation',onClick:()=>createAction?.()},'Nueva cuenta por cobrar'))},
        React.createElement(Detail,{debtor,exchangeRate:3.7,onChanged:()=>{},onNestedModalOpenChange:setNested,onRegisterCreateAction:setCreateAction})));
    }
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));` })

  await page.getByRole('button', { name: 'Ver cuenta' }).click()
  const dialog = page.getByTestId('debtor-detail-workbench')
  await expect(dialog).toBeVisible()
  await dialog.evaluate(element => Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => undefined))))
  await expect(page.getByText('Recuperación documentada')).toBeVisible()
  await expect(page.getByText('Historial financiero')).toBeVisible()
  await expect(page.getByText('Servicio de consultoría')).toBeVisible()
  await expect(page.getByText('Licencia anual')).toBeVisible()
  await expect(page.getByLabel('Recuperación documentada').getByText('S/ 600.00')).toBeVisible()
  await expect(page.getByLabel('Recuperación documentada').getByText('$150.00')).toBeVisible()
  await expect(page.getByTestId('debtor-ledger-row-transaction:t-1')).toBeVisible()
  await expect(page.getByTestId('debtor-ledger-row-obligation:r-pen')).toBeVisible()
  await expect(page.getByTestId('debtor-ledger-row-transaction:t-2')).toHaveCount(0)
  await expect(page.getByTestId('debtor-obligations')).toHaveCount(0)

  const desktop = await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="debtor-detail-workbench"]')!
    const wrapper = modal.parentElement!
    const body = modal.querySelector('[data-record-modal-body="true"]')!
    const footer = body.nextElementSibling!
    const recovery = modal.querySelector('[aria-labelledby="debtor-recovery-title"]')!
    const history = modal.querySelector('[aria-labelledby="debtor-ledger-title"]')!
    const ledgerScroll = modal.querySelector('[class*="ledgerScroll"]')!
    const rect = (element: Element) => { const box = element.getBoundingClientRect(); return {x:Math.round(box.x),y:Math.round(box.y),width:Math.round(box.width),height:Math.round(box.height),right:Math.round(box.right),bottom:Math.round(box.bottom)} }
    return {wrapper:rect(wrapper),modal:rect(modal),body:rect(body),footer:rect(footer),recovery:rect(recovery),history:rect(history),ledger:rect(ledgerScroll),bodyOverflow:getComputedStyle(body).overflowY,bodyDisplay:getComputedStyle(body).display,scrollWidth:modal.scrollWidth,clientWidth:modal.clientWidth,footerOutsideBody:!body.contains(footer)}
  })
  console.info('Receivables workbench geometry 1440:', JSON.stringify(desktop))
  expect(desktop.wrapper.width).toBe(1220)
  expect(desktop.wrapper.right).toBe(1428)
  expect(desktop.bodyDisplay).toBe('flex')
  expect(desktop.bodyOverflow).toBe('hidden')
  expect(desktop.footerOutsideBody).toBe(true)
  expect(desktop.recovery.height).toBeLessThan(150)
  expect(desktop.history.height).toBeGreaterThan(400)
  expect(desktop.ledger.height).toBeGreaterThan(100)
  expect(desktop.scrollWidth).toBeLessThanOrEqual(desktop.clientWidth)

  await page.getByTestId('new-obligation').dispatchEvent('click')
  await expect(page.getByTestId('debtor-detail-receivable-save-btn')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('receivable-form')).toHaveCount(0)
  await expect(dialog).toBeVisible()

  for (const width of [834, 1710, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
    const geometry = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="debtor-detail-workbench"]')!
      const wrapper = modal.parentElement!.getBoundingClientRect()
      return {viewport:document.documentElement.clientWidth,documentWidth:document.documentElement.scrollWidth,wrapperWidth:Math.round(wrapper.width),wrapperLeft:Math.round(wrapper.left),wrapperRight:Math.round(wrapper.right),contentWidth:modal.clientWidth,contentScrollWidth:modal.scrollWidth}
    })
    console.info(`Receivables workbench geometry ${width}:`, JSON.stringify(geometry))
    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewport)
    expect(geometry.wrapperRight).toBeLessThanOrEqual(geometry.viewport)
    expect(geometry.contentScrollWidth).toBeLessThanOrEqual(geometry.contentWidth)
  }

  const managerSource = readFileSync(join(process.cwd(), 'components/receivables/ReceivablesManager.tsx'), 'utf8')
  expect(managerSource).not.toContain('<DetailDrawer')
  expect(managerSource).toContain('presentation="workbench"')
  expect(managerSource).toContain('overlayClassName={debtorDetailStyles.detailOverlay}')
})
