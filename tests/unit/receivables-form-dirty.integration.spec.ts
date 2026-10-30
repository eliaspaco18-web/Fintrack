import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

const reactPath = join(process.cwd(), 'node_modules/react/umd/react.development.js')
const reactDomPath = join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js')

function compileComponent(path: string, registryId: string, exportName: string) {
  const filePath = join(process.cwd(), path)
  const parsed = ts.createSourceFile(filePath, readFileSync(filePath, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const removals: Array<{ start: number; end: number }> = []
  const bindings: string[] = []
  parsed.statements.forEach(statement => {
    if (!ts.isImportDeclaration(statement)) return
    removals.push({ start: statement.getStart(parsed), end: statement.end })
    if (!statement.importClause || statement.importClause.isTypeOnly) return
    const specifier = (statement.moduleSpecifier as ts.StringLiteral).text
    const key = `__import${bindings.length}`
    bindings.push(`const ${key} = window.__receivablesModules[${JSON.stringify(specifier)}] || {};`)
    const clause = statement.importClause
    if (clause.name) bindings.push(`const ${clause.name.text} = ${key}.default;`)
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      clause.namedBindings.elements.filter(item => !item.isTypeOnly).forEach(item => {
        const imported = item.propertyName?.text ?? item.name.text
        bindings.push(`const ${item.name.text} = ${key}[${JSON.stringify(imported)}];`)
      })
    }
  })
  let source = parsed.text
  removals.sort((left, right) => right.start - left.start).forEach(range => {
    source = `${source.slice(0, range.start)}${source.slice(range.end)}`
  })
  source = source.replace(/^'use client'\s*/, '').replace(/\bexport\s+(?=(?:async\s+)?(?:function|const|class|interface|type)\b)/g, '')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React },
  }).outputText.replace(/^export\s*\{\s*\};?\s*$/gm, '')
  return `(() => { const React = window.React; ${bindings.join('\n')}\n${compiled}\nwindow.__receivablesModules[${JSON.stringify(registryId)}] = { ...(window.__receivablesModules[${JSON.stringify(registryId)}] || {}), ${exportName} }; })();`
}

test('receivable and debtor forms request discard only while submitted values differ from their opening values', async ({ page }) => {
  await page.setContent('<div id="root"></div>')
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: `window.__receivablesModules={}; window.React=React;
    window.__receivablesModules.react=React;
    window.__receivablesModules['@/components/ui/NumericInput']={NumericInput:props=>React.createElement('input',{...props,type:'text'})};
    window.__receivablesModules['@/components/forms/primitives']={FormField:({label,children})=>React.createElement('label',null,label,children),FormSection:({title,children})=>React.createElement('section',null,React.createElement('h3',null,title),children),OptionalSection:({children})=>React.createElement('section',null,children)};
    window.__receivablesModules['@/lib/api/error-message']={getApiErrorMessage:(_json,fallback)=>fallback};
    window.__receivablesModules['@/lib/utils/numeric-input']={parseNumericInput:(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback,roundToDecimals:(value,decimals)=>Number(Number(value).toFixed(decimals))};
    window.__receivablesModules['@/lib/toast/toast']={useToast:()=>({toast:{success:()=>{},error:()=>{}}})};
    window.__receivablesModules['@/components/credits/CreditInfoHint']={CreditInfoHint:()=>null};
    window.__receivablesModules['@/components/ui/Button']={Button:({children,testId,...props})=>React.createElement('button',{...props,'data-testid':testId},children)};
    window.__receivablesModules['@/components/ui/AppSelect']={AppSelect:({value,onChange,options,testId})=>React.createElement('select',{value,onChange:event=>onChange(event.target.value),'data-testid':testId},options.map(option=>React.createElement('option',{key:option.value,value:option.value},option.label)))};
    window.__receivablesModules['@/components/forms/TransactionForm/FormFields']={CheckboxToggle:({checked,onChange,label})=>React.createElement('label',null,React.createElement('input',{type:'checkbox',checked,onChange:event=>onChange(event.target.checked)}),label)};
    window.__receivablesModules['@/components/forms/TransactionForm/IncomeDatePicker']={IncomeDatePicker:({value,onChange,inputTestId,inputLabel})=>React.createElement('label',null,inputLabel,React.createElement('input',{type:'date',value,onChange:event=>onChange(event.target.value),'data-testid':inputTestId}))};
    window.__receivablesModules['@/lib/contracts/ui.contracts']={formatCurrency:(amount,currency)=>currency+' '+Number(amount).toFixed(2)};
    window.__receivablesModules['@/modules/attachments/attachment-integrity']={ATTACHMENT_LEGACY_REFERENCE_NOTICE:'Referencia heredada',ATTACHMENT_UPLOAD_UNAVAILABLE_MESSAGE:'Carga no disponible'};
    window.__receivablesModules['./ReceivableForm.module.css']={default:{formRoot:'',formGrid:'',formSectionContainer:'',formWide:'',currencyGrid:'',dateGrid:''}};
    window.__receivablesModules['./DebtorForm.module.css']={default:{}};
    window.__testDebtor={id:'debtor-1',name:'Estudio Norte',initial_debt:25,relationship:'Cliente',is_active:true};
    window.fetch=async()=>({ok:true,json:async()=>({ok:true,data:[{id:'account-1',name:'Cuenta principal',currency:'PEN',type:'checking',is_active:true}]})});` })
  await page.addScriptTag({ content: compileComponent('components/receivables/DebtorForm.tsx', './DebtorForm', 'DebtorForm') })
  await page.addScriptTag({ content: compileComponent('components/receivables/ReceivableForm.tsx', './ReceivableForm', 'ReceivableForm') })
  await page.addScriptTag({ content: `function Harness(){
      const [debtorDirty,setDebtorDirty]=React.useState(false);
      const [receivableDirty,setReceivableDirty]=React.useState(false);
      const debtor=window.__testDebtor;
      return React.createElement(React.Fragment,null,
        React.createElement(window.__receivablesModules['./DebtorForm'].DebtorForm,{debtor,onSuccess:()=>{},onDirtyChange:setDebtorDirty,onFormStateChange:()=>{}}),
        React.createElement('output',{'data-testid':'debtor-dirty'},String(debtorDirty)),
        React.createElement(window.__receivablesModules['./ReceivableForm'].ReceivableForm,{debtors:[debtor],exchangeRate:3.7,defaultDebtorId:debtor.id,onSuccess:()=>{},onDirtyChange:setReceivableDirty,onFormStateChange:()=>{}}),
        React.createElement('output',{'data-testid':'receivable-dirty'},String(receivableDirty)));
    }
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));` })

  await expect(page.getByTestId('debtor-dirty')).toHaveText('false')
  await expect(page.getByTestId('receivable-dirty')).toHaveText('false')

  const debtorName = page.getByTestId('debtor-name-input')
  await debtorName.fill('Estudio Norte S.A.')
  await expect(page.getByTestId('debtor-dirty')).toHaveText('true')
  await debtorName.fill('Estudio Norte')
  await expect(page.getByTestId('debtor-dirty')).toHaveText('false')

  const debtorAmount = page.getByTestId('debtor-initial-debt-input')
  await debtorAmount.fill('40.00')
  await expect(page.getByTestId('debtor-dirty')).toHaveText('true')
  await debtorAmount.fill('25.00')
  await expect(page.getByTestId('debtor-dirty')).toHaveText('false')

  const receivableAmount = page.getByTestId('receivable-amount-input')
  await receivableAmount.fill('95.00')
  await expect(page.getByTestId('receivable-dirty')).toHaveText('true')
  await receivableAmount.fill('0.00')
  await expect(page.getByTestId('receivable-dirty')).toHaveText('false')
})
