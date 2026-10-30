import { expect, test } from '@playwright/test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

const reactPath = join(process.cwd(), 'node_modules/react/umd/react.development.js')
const reactDomPath = join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js')

function compileComponent(path: string, moduleId: string, exportName: string) {
  const filePath = join(process.cwd(), path)
  const sourceFile = ts.createSourceFile(filePath, readFileSync(filePath, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const ranges: Array<{ start: number; end: number }> = []
  const bindings: string[] = []
  sourceFile.statements.forEach(statement => {
    if (!ts.isImportDeclaration(statement)) return
    ranges.push({ start: statement.getStart(sourceFile), end: statement.end })
    if (!statement.importClause || statement.importClause.isTypeOnly) return
    const specifier = (statement.moduleSpecifier as ts.StringLiteral).text
    const local = `__receivablesImport${bindings.length}`
    bindings.push(`const ${local} = window.__receivablesModules[${JSON.stringify(specifier)}] || {};`)
    const clause = statement.importClause
    if (clause.name) bindings.push(`const ${clause.name.text} = ${local}.default;`)
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      clause.namedBindings.elements.filter(item => !item.isTypeOnly).forEach(item => {
        const imported = item.propertyName?.text ?? item.name.text
        bindings.push(`const ${item.name.text} = ${local}[${JSON.stringify(imported)}];`)
      })
    }
  })
  let source = sourceFile.text
  ranges.sort((left, right) => right.start - left.start).forEach(range => {
    source = `${source.slice(0, range.start)}${source.slice(range.end)}`
  })
  source = source.replace(/^'use client'\s*/, '').replace(/\bexport\s+(?=(?:async\s+)?(?:function|const|class|interface|type)\b)/g, '')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React },
  }).outputText.replace(/^export\s*\{\s*\};?\s*$/gm, '')
  return `(() => { const React = window.React; ${bindings.join('\n')}\n${compiled}\nwindow.__receivablesModules[${JSON.stringify(moduleId)}] = { ...(window.__receivablesModules[${JSON.stringify(moduleId)}] || {}), ${exportName} }; })();`
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
  const path = join(process.cwd(), 'lib/ui/use-v3-workbench-presence.ts')
  const sourceFile = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true)
  const importRanges = sourceFile.statements.filter(ts.isImportDeclaration).map(statement => ({ start: statement.getStart(sourceFile), end: statement.end }))
  let source = sourceFile.text.replace(/^'use client'\s*/, '')
  importRanges.sort((a, b) => b.start - a.start).forEach(range => { source = `${source.slice(0, range.start)}${source.slice(range.end)}` })
  source = source.replace(/^export\s+(?=(?:async\s+)?(?:function|const|class|interface|type)\b)/gm, '')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
  }).outputText.replace(/^export\s*\{\s*\};?\s*$/gm, '')
  return `(() => { const { useEffect, useLayoutEffect, useRef, useState } = window.React; ${compiled}\nwindow.__receivablesModules['@/lib/ui/use-v3-workbench-presence'] = { useV3WorkbenchPresence }; })();`
}

test('real RecordModal workbenches keep one active focus trap across nested create and restore the opener', async ({ page }) => {
  page.on('pageerror', error => console.info('Nested RecordModal browser error:', error.stack ?? error.message))
  const cssPath = join(process.cwd(), '.next/static/css')
  const css = readdirSync(cssPath).filter(file => file.endsWith('.css')).sort().map(file => readFileSync(join(cssPath, file), 'utf8')).join('\n')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.setContent('<main data-ft-v3-shell><div id="root"><button id="launch">Abrir persona</button></div></main>')
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: `window.__receivablesModules = {}; window.__activeFocusTrapKeys = new Set();
    const add = document.addEventListener.bind(document); const remove = document.removeEventListener.bind(document);
    document.addEventListener = function(type, listener, options) { if (type === 'keydown') window.__activeFocusTrapKeys.add(listener); return add(type, listener, options); };
    document.removeEventListener = function(type, listener, options) { if (type === 'keydown') window.__activeFocusTrapKeys.delete(listener); return remove(type, listener, options); };
    window.__receivablesModules.react = React;
    window.__receivablesModules['react-dom'] = { createPortal: ReactDOM.createPortal };
    window.__receivablesModules['next/link'] = { default: () => null };
    window.__receivablesModules['@/components/ui/Button'] = { Button: ({children, type='button', onClick, ariaLabel, ...props}) => React.createElement('button', {type, onClick, 'aria-label':ariaLabel, ...props}, children), buttonClassName: () => '' };
    window.__receivablesModules['@/lib/ui/v3-modal-background'] = { acquireV3ModalBackground: () => () => {} };
    ` })
  await page.addScriptTag({ content: compileFocusTrap() })
  await page.addScriptTag({ content: compilePresenceHook() })
  await page.addScriptTag({ content: compileComponent('components/ui/RecordModal.tsx', '@/components/ui/RecordModal', 'RecordModal') })
  await page.addScriptTag({ content: `function Harness() {
    const [open,setOpen]=React.useState(false); const [nested,setNested]=React.useState(false);
    const Modal=window.__receivablesModules['@/components/ui/RecordModal'].RecordModal;
    return React.createElement(React.Fragment,null,
      React.createElement('button',{id:'launch',onClick:()=>setOpen(true)},'Abrir persona'),
      React.createElement(Modal,{open,onClose:()=>setOpen(false),onExitComplete:()=>document.getElementById('launch')?.focus(),title:'Detalle de cuenta',eyebrow:'Detalle de cuenta por cobrar',subtitle:'Cuentas y movimientos',size:'xl',presentation:'workbench',focusTrapActive:!nested,preserveFocusOnResume:true,preserveFocusOnDeactivate:true,testId:'debtor-detail-modal'},
        React.createElement('button',{id:'nested-trigger',onClick:()=>setNested(true)},'Nueva cuenta')),
      React.createElement(Modal,{open:nested,onClose:()=>setNested(false),title:'Nueva cuenta por cobrar',size:'lg',presentation:'workbench',testId:'nested-receivable-modal'},
        React.createElement('button',{id:'nested-close',onClick:()=>setNested(false)},'Cerrar formulario')),
      React.createElement('output',{id:'nested-state'},String(nested)),
      React.createElement('output',{id:'detail-state'},String(open)));
  }
  ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));` })

  await page.locator('#launch').click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __activeFocusTrapKeys: Set<unknown> }).__activeFocusTrapKeys.size)).toBe(1)
  await page.locator('#nested-trigger').click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __activeFocusTrapKeys: Set<unknown> }).__activeFocusTrapKeys.size)).toBe(1)
  await expect(page.getByRole('heading', { name: 'Nueva cuenta por cobrar' })).toBeFocused()
  await expect(page.getByTestId('debtor-detail-modal')).toBeVisible()
  await expect(page.getByTestId('nested-receivable-modal')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('#nested-state')).toHaveText('false')
  await expect(page.getByTestId('nested-receivable-modal')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => (window as unknown as { __activeFocusTrapKeys: Set<unknown> }).__activeFocusTrapKeys.size)).toBe(1)
  await expect(page.locator('#nested-trigger')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('#detail-state')).toHaveText('false')
  await expect(page.getByTestId('debtor-detail-modal')).toHaveCount(0)
  await expect(page.locator('#launch')).toBeFocused()
})
