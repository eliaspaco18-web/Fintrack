import { expect, test } from '@playwright/test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

function compileLayout(path: string) {
  const sourceFile = ts.createSourceFile(path, readFileSync(join(process.cwd(), path), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const removals: Array<{ start: number; end: number }> = []
  const bindings: string[] = []
  sourceFile.statements.forEach(statement => {
    if (!ts.isImportDeclaration(statement)) return
    removals.push({ start: statement.getStart(sourceFile), end: statement.end })
    if (!statement.importClause || statement.importClause.isTypeOnly) return
    const specifier = (statement.moduleSpecifier as ts.StringLiteral).text
    const local = `__catalogImport${bindings.length}`
    bindings.push(`const ${local}=window.__catalogModules[${JSON.stringify(specifier)}]||{};`)
    const clause = statement.importClause
    if (clause.name) bindings.push(`const ${clause.name.text}=${local}.default;`)
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) clause.namedBindings.elements.forEach(item => {
      bindings.push(`const ${item.name.text}=${local}[${JSON.stringify(item.propertyName?.text ?? item.name.text)}];`)
    })
  })
  let source = sourceFile.text
  removals.sort((a, b) => b.start - a.start).forEach(range => { source = `${source.slice(0, range.start)}${source.slice(range.end)}` })
  source = source.replace(/^'use client'\s*/, '').replace(/^export\s+(?=(?:async\s+)?(?:function|const|class|interface|type)\b)/gm, '')
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React } }).outputText.replace(/^export\s*\{\s*\};?\s*$/gm, '')
  return `(()=>{const React=window.React;${bindings.join('\n')}\n${compiled}\nwindow.__catalogLayout=CatalogAdminLayout;window.__catalogTable=CatalogTable;window.__catalogRow=CatalogRow;})();`
}

function classMap(css: string, sourcePath: string, prefix: string) {
  const names = new Set(readFileSync(join(process.cwd(), sourcePath), 'utf8').match(/\.([A-Za-z][\w-]*)/g)?.map(name => name.slice(1)) ?? [])
  return Object.fromEntries(Array.from(names, name => [name, css.match(new RegExp(`\.(${prefix}_${name}__[\\w-]+)`))?.[1] ?? name]))
}

test('catalog navigation uses the approved horizontal tabs and keeps full-width divider responsively', async ({ page }) => {
  page.on('pageerror', error => console.info('Catalog layout browser error:', error.stack ?? error.message))
  const cssRoot = join(process.cwd(), '.next/static/css')
  const css = readdirSync(cssRoot).filter(file => file.endsWith('.css')).map(file => readFileSync(join(cssRoot, file), 'utf8')).join('\n')
  const assetsClasses = classMap(css, 'components/assets/AssetsListPanel.module.css', 'AssetsListPanel')
  const movementClasses = classMap(css, 'components/tables/TransactionsRound07.module.css', 'TransactionsRound07')
  const catalogClasses = classMap(css, 'components/management/CatalogWorkspace.module.css', 'CatalogWorkspace')
  await page.setContent('<main><div id="root"></div></main>')
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ path: join(process.cwd(), 'node_modules/react/umd/react.development.js') })
  await page.addScriptTag({ path: join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js') })
  await page.addScriptTag({ content: `window.React=React;window.__catalogModules={react:React,'@/components/assets/AssetsListPanel.module.css':{default:${JSON.stringify(assetsClasses)}},'@/components/management/CatalogWorkspace.module.css':{default:${JSON.stringify(catalogClasses)}},'@/components/tables/TransactionsRound07.module.css':{default:${JSON.stringify(movementClasses)}},'@/components/finance':{PageLayout:({header,children,className})=>React.createElement('div',{className},header,children),DataErrorBanner:()=>null,EmptyState:()=>null}};` })
  await page.addScriptTag({ content: compileLayout('components/management/catalog.tsx') })
  await page.addScriptTag({ content: `const React=window.React;function Harness(){const [active,setActive]=React.useState('categories');return React.createElement(window.__catalogLayout,{title:'Catálogos',description:'Referencias para organizar tus registros financieros.',nav:[{key:'categories',label:'Categorías'},{key:'banks',label:'Entidades'},{key:'currencies',label:'Monedas'},{key:'asset-types',label:'Tipos de activo'}],activeKey:active,onSelect:setActive,action:React.createElement('button',{style:{height:36}},'Crear categoría')},React.createElement(window.__catalogTable,{title:'Categorías',count:3,summary:React.createElement('span',null,'2 personalizadas'),search:React.createElement('input',{placeholder:'Buscar categoría',style:{height:36}}),filters:React.createElement('button',null,'Todos los alcances'),columns:[{label:'Categoría'},{label:'Alcance'},{label:'Origen'},{label:'Acciones',align:'right'}],gridClassName:'md:grid-cols-[minmax(0,1.7fr)_160px_170px_auto]'},React.createElement(window.__catalogRow,{gridClassName:'md:grid-cols-[minmax(0,1.7fr)_160px_170px_auto]'},React.createElement('div',null,'Transporte'),React.createElement('div',null,'Egreso'),React.createElement('div',null,'Personalizada'),React.createElement('div',null,'Editar'))));}ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));` })

  await expect(page.getByRole('heading', { name: 'Catálogos' })).toBeVisible()
  const tabs = page.getByTestId('catalog-tabs')
  const listing = page.getByTestId('catalog-listing')
  const tableHead = page.getByTestId('catalog-table-head')
  await expect(tabs.getByRole('button')).toHaveCount(4)
  await expect(listing).toBeVisible()
  await expect(tableHead).toBeVisible()
  await expect(page.getByText('Transporte')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Crear categoría' })).toHaveCSS('height', '36px')
  for (const width of [390, 834, 1440, 1710]) {
    await page.setViewportSize({ width, height: 900 })
    const geometry = await tabs.evaluate(element => {
      const style = getComputedStyle(element)
      const active = element.querySelector('button[data-active="true"]')!
      const activeStyle = getComputedStyle(active)
      return {
        width: Math.round(element.getBoundingClientRect().width),
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        display: style.display,
        gap: style.gap,
        borderBottomWidth: style.borderBottomWidth,
        activeColor: activeStyle.color,
        activeUnderline: getComputedStyle(active, '::after').height,
      }
    })
    expect(geometry.width).toBeGreaterThan(0)
    expect(geometry.display).toBe('flex')
    expect(geometry.gap).toBe('24px')
    expect(geometry.borderBottomWidth).toBe('1px')
    expect(geometry.activeUnderline).toBe('2px')
    expect(geometry.scrollWidth).toBeGreaterThanOrEqual(geometry.clientWidth)
    const pageGeometry = await page.locator('#root').evaluate(element => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      listWidth: element.querySelector('[data-testid="catalog-listing"]')!.getBoundingClientRect().width,
      rowHeight: element.querySelector('article')!.getBoundingClientRect().height,
      searchHeight: element.querySelector('input')!.getBoundingClientRect().height,
    }))
    expect(pageGeometry.scrollWidth).toBeLessThanOrEqual(pageGeometry.clientWidth)
    expect(pageGeometry.listWidth).toBeGreaterThan(0)
    expect(pageGeometry.rowHeight).toBeLessThan(width < 768 ? 180 : 90)
    expect(pageGeometry.searchHeight).toBeGreaterThanOrEqual(32)
    await page.getByRole('button', { name: 'Entidades' }).click()
    await expect(page.getByRole('button', { name: 'Entidades' })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Categorías' }).click()
  }
})
