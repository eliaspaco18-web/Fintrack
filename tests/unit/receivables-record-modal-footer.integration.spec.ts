import { expect, test } from '@playwright/test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

const reactPath = join(process.cwd(), 'node_modules/react/umd/react.development.js')
const reactDomPath = join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js')

function compileRecordModal() {
  const path = join(process.cwd(), 'components/ui/RecordModal.tsx')
  const parsed = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const removals: Array<{ start: number; end: number }> = []
  const bindings: string[] = []

  parsed.statements.forEach(statement => {
    if (!ts.isImportDeclaration(statement)) return
    removals.push({ start: statement.getStart(parsed), end: statement.end })
    if (!statement.importClause || statement.importClause.isTypeOnly) return
    const specifier = (statement.moduleSpecifier as ts.StringLiteral).text
    const key = `__modalImport${bindings.length}`
    bindings.push(`const ${key} = window.__modalModules[${JSON.stringify(specifier)}] || {};`)
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

  return `(() => { const React = window.React; ${bindings.join('\n')}\n${compiled}\nwindow.RecordModal = RecordModal; })();`
}

test('RecordModal places remote submit actions in its fixed footer and associates them to the real form', async ({ page }) => {
  const cssPath = join(process.cwd(), '.next/static/css')
  const css = readdirSync(cssPath).filter(file => file.endsWith('.css')).sort().map(file => readFileSync(join(cssPath, file), 'utf8')).join('\n')
  const formClasses = Object.fromEntries(['formRoot', 'formGrid', 'formSectionContainer', 'dateGrid', 'currencyGrid'].map(name => [
    name,
    css.match(new RegExp(`\\.(ReceivableForm_${name}__[\\w-]+)`))?.[1] ?? name,
  ]))
  const receivableOverlayClass = css.match(/\.(ReceivablesManager_receivableFormOverlay__[\w-]+)/)?.[1] ?? 'receivableFormOverlay'
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.setContent('<main data-ft-v3-shell><div id="root"></div></main>')
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: `window.__modalModules = {};
    window.__modalModules.react = React;
    window.__modalModules['react-dom'] = { createPortal: ReactDOM.createPortal };
    window.__modalModules['@/components/ui/Button'] = { Button: ({children, testId, ariaLabel, ...props}) => React.createElement('button', {...props, 'data-testid':testId, 'aria-label':ariaLabel}, children) };
    window.__modalModules['@/components/ui/accessibility'] = { FocusTrap: ({children,className}) => React.createElement('div', {className}, children) };
    window.__modalModules['@/lib/ui/use-v3-workbench-presence'] = { useV3WorkbenchPresence: () => ({phase:'open',mounted:true,frameRef:()=>{},veilRef:()=>{},bodyRef:()=>{}}) };
    window.__modalModules['@/lib/ui/v3-modal-background'] = { acquireV3ModalBackground: () => () => {} };` })
  await page.addScriptTag({ content: compileRecordModal() })
  await page.addScriptTag({ content: `function Harness() {
      const [submitted, setSubmitted] = React.useState(0);
      const modal = window.RecordModal;
      return React.createElement(React.Fragment, null,
        React.createElement(modal, {open:true,onClose:()=>{},title:'Registrar cuenta por cobrar',subtitle:'Datos documentados',size:'lg',presentation:'workbench',overlayClassName:${JSON.stringify(`z-modal ${receivableOverlayClass}`)},testId:'real-record-modal',footer:React.createElement('div',{className:'flex justify-end gap-2'},React.createElement('button',{type:'button','data-testid':'cancel-action'},'Cancelar'),React.createElement('button',{type:'submit',form:'receivable-form','data-testid':'submit-action'},'Crear cuenta por cobrar'))},
          React.createElement('form',{id:'receivable-form',onSubmit:event=>{event.preventDefault();setSubmitted(value=>value+1)}},React.createElement('label',null,'Importe',React.createElement('input',{name:'amount',defaultValue:'125.00'})))),
        React.createElement('output',{id:'submit-count'},String(submitted)));
    }
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));` })

  const dialog = page.getByTestId('real-record-modal')
  await expect(dialog).toBeVisible()
  const body = dialog.locator('[data-record-modal-body="true"]')
  const footer = body.locator('xpath=following-sibling::div[1]')
  await expect(footer).toBeVisible()
  await expect(footer.getByTestId('submit-action')).toBeVisible()
  await expect(body.getByTestId('submit-action')).toHaveCount(0)
  const geometry = await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="real-record-modal"]')!
    const body = modal.querySelector('[data-record-modal-body="true"]')!
    const footer = body.nextElementSibling!
    const bodyRect = body.getBoundingClientRect()
    const footerRect = footer.getBoundingClientRect()
    return {
      footerOutsideBody: !body.contains(footer),
      footerBottomGap: Math.round(modal.getBoundingClientRect().bottom - footerRect.bottom),
      bodyFooterOverlap: bodyRect.bottom > footerRect.top,
      footerBackground: getComputedStyle(footer).backgroundColor,
      footerBorderTop: getComputedStyle(footer).borderTopWidth,
      footerHeight: Math.round(footerRect.height),
      workbenchWidth: Math.round(modal.parentElement!.getBoundingClientRect().width),
    }
  })
  expect(geometry.footerOutsideBody).toBe(true)
  expect(geometry.bodyFooterOverlap).toBe(false)
  expect(geometry.footerHeight).toBeGreaterThan(50)
  expect(geometry.footerBorderTop).toBe('1px')
  expect(geometry.workbenchWidth).toBe(580)
  await page.evaluate(classes => {
    const host = document.createElement('div')
    host.innerHTML = `<form class="${classes.formRoot}" style="width: 1000px"><div class="${classes.formGrid}"><section class="${classes.formSectionContainer}"></section><section class="${classes.formSectionContainer}"><div class="${classes.dateGrid}"><div></div><div></div></div></section></div></form>`
    host.style.cssText = 'position:fixed;left:-2000px;top:0'
    document.body.append(host)
    const form = host.querySelector('form')!
    const grid = host.querySelector(`.${classes.formGrid}`)!
    const dates = host.querySelector(`.${classes.dateGrid}`)!
    const wide = { gridColumns: getComputedStyle(grid).gridTemplateColumns.split(' ').length, dateColumns: getComputedStyle(dates).gridTemplateColumns.split(' ').length, scrollWidth: form.scrollWidth, clientWidth: form.clientWidth }
    form.style.width = '650px'
    const compact = { gridColumns: getComputedStyle(grid).gridTemplateColumns.split(' ').length, dateColumns: getComputedStyle(dates).gridTemplateColumns.split(' ').length, scrollWidth: form.scrollWidth, clientWidth: form.clientWidth }
    host.remove()
    return { wide, compact }
  }, formClasses).then(layout => {
    expect(layout.wide.gridColumns).toBe(2)
    expect(layout.wide.dateColumns).toBe(2)
    expect(layout.wide.scrollWidth).toBeLessThanOrEqual(layout.wide.clientWidth)
    expect(layout.compact.gridColumns).toBe(1)
    expect(layout.compact.dateColumns).toBe(1)
    expect(layout.compact.scrollWidth).toBeLessThanOrEqual(layout.compact.clientWidth)
  })
  await page.setViewportSize({ width: 390, height: 844 })
  const mobileWorkbenchWidth = await dialog.locator('xpath=ancestor::div[contains(@class,"ft-v3-workbench-wrapper")]').evaluate(element => Math.round(element.getBoundingClientRect().width))
  expect(mobileWorkbenchWidth).toBe(374)
  await page.getByTestId('submit-action').click()
  await expect(page.locator('#submit-count')).toHaveText('1')
})
