import { expect, test } from '@playwright/test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

const reactPath = join(process.cwd(), 'node_modules/react/umd/react.development.js')
const reactDomPath = join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js')

function cssModuleMap(css: string, sourcePath: string, prefix: string) {
  const names = new Set(readFileSync(join(process.cwd(), sourcePath), 'utf8').match(/\.([A-Za-z][\w-]*)/g)?.map(name => name.slice(1)) ?? [])
  return Object.fromEntries(Array.from(names, name => [name, css.match(new RegExp(`\.(${prefix}_${name}__[\\w-]+)`))?.[1] ?? name]))
}

function compileModule(path: string, moduleId: string, exportNames: string[]) {
  const file = join(process.cwd(), path)
  const parsed = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const removals: Array<{ start: number; end: number }> = []
  const bindings: string[] = []
  for (const statement of parsed.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    removals.push({ start: statement.getStart(parsed), end: statement.end })
    if (!statement.importClause || statement.importClause.isTypeOnly) continue
    const specifier = (statement.moduleSpecifier as ts.StringLiteral).text
    const local = `__recurringImport${bindings.length}`
    bindings.push(`const ${local}=window.__recurringModules[${JSON.stringify(specifier)}]||{};`)
    const clause = statement.importClause
    if (clause.name) bindings.push(`const ${clause.name.text}=${local}.default;`)
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) clause.namedBindings.elements.filter(item => !item.isTypeOnly).forEach(item => {
      const imported = item.propertyName?.text ?? item.name.text
      bindings.push(`const ${item.name.text}=${local}[${JSON.stringify(imported)}];`)
    })
  }
  let source = parsed.text
  removals.sort((a, b) => b.start - a.start).forEach(range => { source = `${source.slice(0, range.start)}${source.slice(range.end)}` })
  source = source.replace(/^'use client'\s*/, '').replace(/\bexport\s+(?=(?:async\s+)?(?:function|const|class|interface|type)\b)/g, '')
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React } }).outputText.replace(/^export\s*\{\s*\};?\s*$/gm, '')
  return `(()=>{const React=window.React;${bindings.join('\n')}\n${compiled}\nwindow.__recurringModules[${JSON.stringify(moduleId)}]={...(window.__recurringModules[${JSON.stringify(moduleId)}]||{}),${exportNames.join(',')}};})();`
}

test('real recurring workspace keeps approved tabs and list geometry across desktop, tablet and mobile', async ({ page }) => {
  const cssRoot = join(process.cwd(), '.next/static/css')
  const css = readdirSync(cssRoot).filter(file => file.endsWith('.css')).sort().map(file => readFileSync(join(cssRoot, file), 'utf8')).join('\n')
  const movementCss = cssModuleMap(css, 'components/tables/TransactionsRound07.module.css', 'TransactionsRound07')
  const workspaceCss = cssModuleMap(css, 'components/recurring/RecurringWorkspace.module.css', 'RecurringWorkspace')
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.setContent('<main class="fin-shell" data-ft-v3-shell><div id="root"></div></main>')
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: `window.React=React;window.__recurringModules={react:React,'react-dom':{createPortal:ReactDOM.createPortal}};window.__templateRequests=[];
    window.__recurringModules['@/components/tables/TransactionsRound07.module.css']={default:${JSON.stringify(movementCss)}};
    window.__recurringModules['./RecurringWorkspace.module.css']={default:${JSON.stringify(workspaceCss)}};
    window.__recurringRouter={push:href=>window.__recurringLastHref=href,replace:()=>{}};window.__recurringParams=new URLSearchParams();
    window.__recurringModules['next/navigation']={usePathname:()=>'/recurring',useRouter:()=>window.__recurringRouter,useSearchParams:()=>window.__recurringParams};
    window.__recurringModules['@/lib/toast/toast']={useToast:()=>({toast:{success:()=>{},error:()=>{}}})};
    window.__recurringModules['@/lib/api/error-message']={getApiErrorMessage:(_json,fallback)=>fallback};
    window.__recurringModules['@/lib/client/fetch-with-timeout']={fetchWithTimeout:async()=>({ok:true,json:async()=>({ok:true,data:[
      {id:'income',name:'Ingreso de honorarios',type:'INCOME',sub_type:null,is_active:true,amount:1250,currency:'PEN',source_account_id:'a1',source_account:{id:'a1',name:'Cuenta principal',currency:'PEN'},description:'Servicios profesionales'},
      {id:'lend',name:'Préstamo a familiar',type:'EXPENSE',sub_type:'RECEIVABLE_LENDING',is_active:false,amount:500,currency:'USD',source_account_id:'a2',source_account:{id:'a2',name:'Ahorros USD',currency:'USD'}},
      {id:'received',name:'Préstamo recibido',type:'INCOME',sub_type:'PAYABLE_PAYMENT',is_active:true,amount:800,currency:'PEN',source_account_id:'a1',source_account:{id:'a1',name:'Cuenta principal',currency:'PEN'}},
      {id:'transfer',name:'Ahorro mensual',type:'TRANSFER',sub_type:null,is_active:true,amount:100,currency:'PEN',source_account_id:'a1',source_account:{id:'a1',name:'Cuenta principal',currency:'PEN'},destination_account_id:'a2',destination_account:{id:'a2',name:'Reserva USD',currency:'USD'}}
    ]})})};
    window.__recurringModules['@/lib/contracts/ui.contracts']={formatCurrency:(amount,currency)=>currency==='USD'?'$ '+Number(amount).toFixed(2):'S/ '+Number(amount).toFixed(2)};
    window.__recurringModules['@/components/ui/RecordModal']={RecordModal:()=>null};
    window.__recurringModules['@/components/finance']={PageLayout:({children,className})=>React.createElement('div',{className:'mx-auto flex w-full max-w-[1440px] flex-col gap-4 pb-10 '+className},children),DataErrorBanner:({message})=>React.createElement('p',{role:'alert'},message),EmptyState:({title})=>React.createElement('p',null,title),ConfirmDialog:()=>null,StatusBadge:({children})=>React.createElement('span',{className:'inline-flex rounded-full border px-2 py-1 text-xs'},children),DataTable:({children,className=''})=>React.createElement('section',{className:'relative rounded-panel border border-[var(--ft-border)] bg-[var(--ft-surface)] '+className},children),DataSearchField:({value,onChange,placeholder,...props})=>React.createElement('input',{...props,type:'search',value,placeholder,onChange:event=>onChange(event.target.value),className:'h-9 w-full rounded-control border border-[var(--ft-border)] bg-[var(--ft-surface)] px-3 text-[13px]'})};
    window.__recurringModules['@/components/ui/AnchoredActionMenu']={AnchoredActionMenu:({label,triggerContent})=>React.createElement('button',{type:'button','aria-label':label,className:'h-8 w-8'},triggerContent)};
    window.__recurringModules['@/components/ui/AppSelect']={AppSelect:({value,onChange,options=[],ariaLabel,className})=>React.createElement('select',{value,onChange:event=>onChange(event.target.value),className,'aria-label':ariaLabel},options.map(option=>React.createElement('option',{key:option.value,value:option.value},option.label)))};
    window.__recurringModules['@/components/ui/Button']={Button:({children,onClick,className='',testId,disabled,ariaLabel,type='button',form})=>React.createElement('button',{type,form,onClick,className:'inline-flex h-9 items-center justify-center gap-2 rounded-control px-3 text-xs '+className,'data-testid':testId,'aria-label':ariaLabel,disabled},children)};
    window.__recurringModules['@/components/ui/CreateModuleButton']={CreateModuleButton:({label,onClick,className,testId})=>React.createElement('button',{type:'button',onClick,className:'module-create-btn '+className,'data-testid':testId},label)};
    window.__recurringModules['@/components/forms/primitives']={FormField:({label,children,optional})=>React.createElement('label',{className:'flex flex-col gap-2'},React.createElement('span',null,label,optional?' · Opcional':''),children),FormSection:({title,children,className=''})=>React.createElement('section',{className},React.createElement('h3',null,title),children)};
    window.__recurringModules['@/lib/utils/numeric-input']={parseNumericInput:(value,fallback)=>{const number=Number(value);return Number.isFinite(number)?number:fallback},roundToDecimals:(value,decimals)=>Number(value.toFixed(decimals))};
    window.__recurringModules['@/lib/toast/toast']={useToast:()=>({toast:{success:()=>{},error:()=>{}}})};
    window.__recurringModules['@/components/ui/NumericInput']={NumericInput:({value,onValueChange,decimals:_decimals,...props})=>React.createElement('input',{...props,value,onChange:event=>onValueChange(event.target.value)})};
    window.fetch=async(url,init={})=>{window.__templateRequests.push({url:String(url),method:init.method||'GET',body:init.body||null});if(String(url)==='/api/accounts')return {ok:true,status:200,json:async()=>({ok:true,data:[{id:'a1',name:'Cuenta principal',currency:'PEN',type:'CHECKING',is_active:true}]})};if(String(url)==='/api/categories')return {ok:true,status:200,json:async()=>({ok:true,data:[{id:'c1',name:'Servicios'}]})};return {ok:true,status:201,json:async()=>({ok:true,data:{id:'new-template'}})};};
    window.__recurringModules['./RecurringForm']={};
    window.__recurringModules['@/components/ui/accessibility']={FocusTrap:({children,className})=>React.createElement('div',{className},children)};
    window.__recurringModules['@/lib/ui/use-v3-workbench-presence']={useV3WorkbenchPresence:(open,enabled)=>({phase:open?'open':'closed',mounted:open&&enabled,frameRef:()=>{},veilRef:()=>{},bodyRef:()=>{}})};
    window.__recurringModules['@/lib/ui/v3-modal-background']={acquireV3ModalBackground:()=>()=>{}};
    window.__recurringModules['@/components/ui/ConfirmDialog']={};` })
  await page.addScriptTag({ content: compileModule('modules/recurring/recurring-presentation.ts', '@/modules/recurring/recurring-presentation', ['getRecurringOperation','getRecurringDirection','matchesRecurringTab','recurringUseHref','summarizeRecurringRows']) })
  await page.addScriptTag({ content: compileModule('components/recurring/RecurringForm.tsx', './RecurringForm', ['RecurringCreateForm','RecurringForm','recurringTypeTone','TYPE_LABELS']) })
  await page.addScriptTag({ content: compileModule('components/ui/RecordModal.tsx', '@/components/ui/RecordModal', ['RecordModal','RecordModalFooter']) })
  await page.addScriptTag({ content: compileModule('components/recurring/RecurringWorkspace.tsx', '@/components/recurring/RecurringWorkspace', ['RecurringWorkspace']) })
  await page.addScriptTag({ content: `ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(window.__recurringModules['@/components/recurring/RecurringWorkspace'].RecurringWorkspace));` })

  await expect(page.getByTestId('recurring-row-income')).toBeVisible()
  await expect(page.getByTestId('recurring-row-lend')).toBeVisible()
  await expect(page.getByTestId('recurring-summary').getByText('3')).toBeVisible()
  await page.getByRole('button', { name: 'Egresos y dinero prestado' }).click()
  await expect(page.getByTestId('recurring-row-lend')).toBeVisible()
  await expect(page.getByTestId('recurring-row-income')).toHaveCount(0)
  await page.getByRole('button', { name: 'Todas', exact: true }).click()
  await page.getByTestId('recurring-use-income').click()
  expect(await page.evaluate(() => window.__recurringLastHref)).toBe('/transactions/new?from_recurring=income')
  await expect(page.getByTestId('recurring-use-lend')).toBeDisabled()
  await page.getByTestId('recurring-create-button').click()
  await expect(page.getByTestId('recurring-create-modal')).toBeVisible()
  await expect(page.getByLabel('Cuenta de origen')).toBeVisible()
  expect(await page.evaluate(() => window.__templateRequests.filter(request => request.method === 'POST').length)).toBe(0)

  for (const width of [390, 834, 1440, 1710]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 960 })
    const geometry = await page.evaluate(workbenchOverlayClass => {
      const rect = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector)!
        const box = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height), font: style.fontFamily, fontSize: style.fontSize, gap: style.columnGap }
      }
      const tabs = document.querySelector<HTMLElement>('[data-testid="recurring-operation-tabs"]')!
      const firstTab = tabs.querySelector<HTMLElement>('button')!
      const toolbar = document.querySelector<HTMLElement>('[data-testid="recurring-filter-toolbar"]')!
      return { viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth, tabs: rect('[data-testid="recurring-operation-tabs"]'), tabGap: getComputedStyle(tabs).gap, tabFontSize: getComputedStyle(firstTab).fontSize, tabHeight: Math.round(firstTab.getBoundingClientRect().height), toolbar: rect('[data-testid="recurring-filter-toolbar"]'), list: rect('[data-testid^="recurring-row-"]'), tableWidth: document.querySelector<HTMLElement>('[data-testid^="recurring-row-"]')!.parentElement!.getBoundingClientRect().width, workbench: document.querySelector<HTMLElement>(`.${workbenchOverlayClass} .ft-v3-workbench-wrapper`)?.getBoundingClientRect().width ?? 0, dialog: document.querySelector<HTMLElement>('[data-testid="recurring-create-modal"]')?.getBoundingClientRect().width ?? 0, footer: Boolean(document.querySelector('[data-testid="recurring-create-modal"] [data-record-modal-body] + *')) }
    }, workspaceCss.formWorkbenchOverlay)
    console.info(`Recurring geometry ${width}px:`, JSON.stringify(geometry))
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport)
    expect(geometry.tabs.width).toBeGreaterThan(0)
    expect(geometry.tabGap).toBe('24px')
    expect(geometry.tabFontSize).toBe('12px')
    expect(geometry.list.width).toBeLessThanOrEqual(geometry.tableWidth)
    expect(geometry.workbench).toBeGreaterThan(0)
    expect(geometry.dialog).toBeGreaterThan(0)
    expect(geometry.dialog).toBeLessThanOrEqual(geometry.workbench)
    expect(geometry.footer).toBe(true)
    if (width === 390) expect(geometry.tabs.width).toBeLessThanOrEqual(geometry.viewport)
  }

  await page.getByLabel('Nombre', { exact: true }).fill('Servicio de prueba')
  await page.getByLabel('Cuenta de origen').selectOption('a1')
  await page.getByLabel('Importe').fill('125.50')
  await page.getByTestId('recurring-create-modal').getByRole('button', { name: 'Crear plantilla' }).click()
  await expect(page.getByTestId('recurring-create-modal')).toHaveCount(0)
  const writes = await page.evaluate(() => window.__templateRequests.filter(request => request.method === 'POST'))
  expect(writes).toHaveLength(1)
  expect(writes[0]!.url).toBe('/api/recurring')
  expect(JSON.parse(writes[0]!.body ?? '{}')).toMatchObject({ name: 'Servicio de prueba', amount: 125.5, currency: 'PEN', source_account_id: 'a1' })
  expect(writes.some(request => request.url.includes('/api/transactions'))).toBe(false)
})

declare global {
  interface Window {
    __recurringLastHref?: string
    __templateRequests: Array<{ url: string; method: string; body: string | null }>
  }
}
