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

test('real DetailDrawer suspends its focus trap for a nested window and restores focus on close', async ({ page }) => {
  const cssPath = join(process.cwd(), '.next/static/css')
  const css = readdirSync(cssPath).filter(file => file.endsWith('.css')).sort().map(file => readFileSync(join(cssPath, file), 'utf8')).join('\n')
  await page.setContent('<main data-ft-v3-shell><button id="launch">Abrir persona</button></main>')
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
    ` })
  await page.addScriptTag({ content: compileFocusTrap() })
  await page.addScriptTag({ content: compileComponent('components/ui/ModalOverlayPortal.tsx', '@/components/ui/ModalOverlayPortal', 'ModalOverlayPortal') })
  await page.addScriptTag({ content: compileComponent('components/finance/primitives.tsx', '@/components/finance/primitives', 'DetailDrawer') })
  await page.addScriptTag({ content: `function Harness() {
    const [open,setOpen]=React.useState(false); const [nested,setNested]=React.useState(false);
    const returnRef=React.useRef(null);
    const Drawer=window.__receivablesModules['@/components/finance/primitives'].DetailDrawer;
    const Trap=window.__receivablesModules['@/components/ui/accessibility'].FocusTrap;
    return React.createElement(React.Fragment,null,
      React.createElement('button',{id:'launch',onClick:()=>setOpen(true)},'Abrir persona'),
      React.createElement(Drawer,{open,title:'Detalle de persona',description:'Cuentas y movimientos',onClose:()=>setOpen(false),width:800,inset:true,focusTrapActive:!nested,preserveFocusOnResume:true,focusReturnTargetRef:returnRef,reliableExitLifecycle:true},
        React.createElement('button',{id:'nested-trigger',onClick:event=>{returnRef.current=event.currentTarget;setNested(true)}},'Nueva cuenta'),
        nested ? React.createElement(Trap,{active:true,onEscape:()=>setNested(false),preserveFocusIfAlreadyWithin:true},React.createElement('section',{role:'dialog','aria-label':'Nueva cuenta'},React.createElement('button',{id:'nested-close',onClick:()=>setNested(false)},'Cerrar formulario'))) : null,
        React.createElement('output',{id:'nested-state'},String(nested))),
      React.createElement('output',{id:'drawer-state'},String(open)));
  }
  ReactDOM.createRoot(document.querySelector('main')).render(React.createElement(Harness));` })

  await page.locator('#launch').click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __activeFocusTrapKeys: Set<unknown> }).__activeFocusTrapKeys.size)).toBe(1)
  await page.locator('#nested-trigger').click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __activeFocusTrapKeys: Set<unknown> }).__activeFocusTrapKeys.size)).toBe(1)
  await expect(page.locator('#nested-close')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('#nested-state')).toHaveText('false')
  await expect.poll(() => page.evaluate(() => (window as unknown as { __activeFocusTrapKeys: Set<unknown> }).__activeFocusTrapKeys.size)).toBe(1)
  await expect(page.locator('#nested-trigger')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('#drawer-state')).toHaveText('false')
  await expect(page.getByRole('dialog', { name: 'Detalle de persona' })).toHaveCount(0)
  await expect(page.locator('#launch')).toBeFocused()
})
