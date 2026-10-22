import { expect, test } from '@playwright/test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

const reactPath = join(process.cwd(), 'node_modules/react/umd/react.development.js')
const reactDomPath = join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js')

function compileComponent(path: string, moduleId: string, exports: string[]) {
  const sourceFile = ts.createSourceFile(join(process.cwd(), path), readFileSync(join(process.cwd(), path), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const removals: Array<{ start: number; end: number }> = []
  const bindings: string[] = []

  sourceFile.statements.forEach(statement => {
    if (!ts.isImportDeclaration(statement)) return
    removals.push({ start: statement.getStart(sourceFile), end: statement.end })
    if (!statement.importClause || statement.importClause.isTypeOnly) return
    const specifier = (statement.moduleSpecifier as ts.StringLiteral).text
    const local = `__alertsImport${bindings.length}`
    bindings.push(`const ${local} = window.__alertsModules[${JSON.stringify(specifier)}] || {};`)
    const clause = statement.importClause
    if (clause.name) bindings.push(`const ${clause.name.text} = ${local}.default;`)
    if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) bindings.push(`const ${clause.namedBindings.name.text} = ${local};`)
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) clause.namedBindings.elements.filter(item => !item.isTypeOnly).forEach(item => {
      const imported = item.propertyName?.text ?? item.name.text
      bindings.push(`const ${item.name.text} = ${local}[${JSON.stringify(imported)}];`)
    })
  })

  let source = sourceFile.text
  removals.sort((a, b) => b.start - a.start).forEach(range => { source = `${source.slice(0, range.start)}${source.slice(range.end)}` })
  source = source.replace(/^'use client'\s*/, '').replace(/^export\s+(?=(?:async\s+)?(?:function|const|class|interface|type)\b)/gm, '')
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React } }).outputText.replace(/^export\s*\{\s*\};?\s*$/gm, '')
  return `(() => { ${bindings.join('\n')}\n${compiled}\nwindow.__alertsModules[${JSON.stringify(moduleId)}] = { ...(window.__alertsModules[${JSON.stringify(moduleId)}] || {}), ${exports.join(', ')} }; })();`
}

function cssModuleMap(css: string, sourcePath: string, prefix: string) {
  const names = new Set(readFileSync(join(process.cwd(), sourcePath), 'utf8').match(/\.([A-Za-z][\w-]*)/g)?.map(name => name.slice(1)) ?? [])
  return Object.fromEntries(Array.from(names, name => [name, css.match(new RegExp(`\.(${prefix}_${name}__[\\w-]+)`))?.[1] ?? name]))
}

test('real alert rows stay readable and actionable across mobile, tablet and desktop widths', async ({ page }, testInfo) => {
  page.on('pageerror', error => console.info('Alerts row browser error:', error.stack ?? error.message))
  const cssRoot = join(process.cwd(), '.next/static/css')
  const css = readdirSync(cssRoot).filter(file => file.endsWith('.css')).sort().map(file => readFileSync(join(cssRoot, file), 'utf8')).join('\n')
  const classes = cssModuleMap(css, 'components/alerts/AlertCard.module.css', 'AlertCard')
  await page.setContent('<main data-ft-v3-shell><div id="root"></div></main>')
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: `window.React=React; window.__alertsModules={react:React,'react-dom':{createPortal:ReactDOM.createPortal},'./AlertCard.module.css':{default:${JSON.stringify(classes)}}};
    window.__alertsModules['@/components/finance']={StatusBadge:({children,dot})=>React.createElement('span',{className:'shared-status-badge'},dot?React.createElement('span',{'aria-hidden':true},'•'):null,children)};
    window.__alertsModules['@/components/ui/Button']={Button:({href,children,testId,ariaLabel,onClick,disabled,className})=>href?React.createElement('a',{href,'data-testid':testId,'aria-label':ariaLabel,className},children):React.createElement('button',{type:'button','data-testid':testId,'aria-label':ariaLabel,onClick,disabled,className},children)};` })
  await page.addScriptTag({ content: compileComponent('components/ui/AnchoredActionMenu.tsx', '@/components/ui/AnchoredActionMenu', ['AnchoredActionMenu']) })
  await page.addScriptTag({ content: compileComponent('components/alerts/AlertBadge.tsx', './AlertBadge', ['AlertBadge', 'alertLabel', 'moduleLabel']) })
  await page.addScriptTag({ content: compileComponent('components/alerts/AlertCard.tsx', '@/components/alerts/AlertCard', ['AlertCard']) })
  await page.addScriptTag({ content: `function Harness(){
    const React=window.React; const [read,setRead]=React.useState(false); const [deleted,setDeleted]=React.useState(false);
    const Card=window.__alertsModules['@/components/alerts/AlertCard'].AlertCard;
    if(deleted)return React.createElement('p',null,'Deleted');
    return React.createElement(Card,{id:'fixture-1',alert_type:'CRITICAL',source_module:'budgets',title:'Aviso de prueba con una descripción suficientemente extensa para comprobar su ajuste responsivo',message:'Este aviso sintético no corresponde a datos personales ni financieros reales.',href:'/budgets?period=2026-10',is_read:read,created_at:'2026-10-20T13:25:00.000Z',dateLabel:'20 oct 2026, 08:25',busy:false,onToggleRead:(_id,next)=>setRead(next),actions:[{id:'delete',label:'Eliminar aviso',destructive:true,onSelect:()=>setDeleted(true)}]});
  } ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));` })

  const row = page.getByTestId('alert-row-fixture-1')
  await expect(row).toBeVisible()
  await expect(row.getByText('Presupuestos', { exact: true })).toBeVisible()
  await expect(row.getByText('Crítica')).toBeVisible()
  await expect(row.getByRole('link', { name: 'Revisar en Presupuestos' })).toHaveAttribute('href', '/budgets?period=2026-10')
  await expect(row.getByRole('button', { name: 'Marcar leído' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('alerts-row.png'), fullPage: true })

  for (const width of [390, 834, 1440, 1710]) {
    await page.setViewportSize({ width, height: 900 })
    const geometry = await row.evaluate(element => ({
      width: Math.round(element.getBoundingClientRect().width),
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      height: Math.round(element.getBoundingClientRect().height),
      contentHeight: Math.round(element.querySelector('h3')!.getBoundingClientRect().height),
      display: getComputedStyle(element).display,
      columns: getComputedStyle(element).gridTemplateColumns,
      fontFamily: getComputedStyle(element).fontFamily,
    }))
    console.info(`Alerts row geometry ${width}px:`, JSON.stringify(geometry))
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth)
    expect(geometry.width).toBeGreaterThan(0)
    expect(geometry.contentHeight).toBeGreaterThan(0)
    expect(geometry.display).toBe('grid')
    expect(geometry.fontFamily.toLowerCase()).toContain('manrope')
  }

  await page.getByTestId('alert-toggle-fixture-1').click()
  await expect(row.getByRole('button', { name: 'Marcar no leído' })).toBeVisible()
  await page.getByTestId('alert-toggle-fixture-1').click()
  await expect(row.getByRole('button', { name: 'Marcar leído' })).toBeVisible()

  const menuButton = page.getByRole('button', { name: 'Más acciones del aviso: Aviso de prueba con una descripción suficientemente extensa para comprobar su ajuste responsivo' })
  await menuButton.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('menuitem', { name: 'Eliminar aviso' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Eliminar aviso' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menuitem', { name: 'Eliminar aviso' })).toHaveCount(0)
  await expect(menuButton).toBeFocused()
  await menuButton.click()
  await expect(page.getByRole('menuitem', { name: 'Eliminar aviso' })).toBeVisible()
  await page.getByRole('menuitem', { name: 'Eliminar aviso' }).click()
  await expect(page.getByText('Deleted')).toBeVisible()
})
