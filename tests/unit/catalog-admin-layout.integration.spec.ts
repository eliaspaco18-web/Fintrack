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
  return `(()=>{const React=window.React;${bindings.join('\n')}\n${compiled}\nwindow.__catalogLayout=CatalogAdminLayout;window.__catalogTable=CatalogTable;window.__catalogRow=CatalogRow;window.__catalogCell=CatalogCell;window.__catalogIdentity=CatalogIdentity;window.__catalogRowActions=CatalogRowActions;})();`
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
  await page.addScriptTag({ content: `window.React=React;window.__catalogModules={react:React,'@/components/assets/AssetsListPanel.module.css':{default:${JSON.stringify(assetsClasses)}},'@/components/management/CatalogWorkspace.module.css':{default:${JSON.stringify(catalogClasses)}},'@/components/tables/TransactionsRound07.module.css':{default:${JSON.stringify(movementClasses)}},'@/components/ui/AnchoredActionMenu':{AnchoredActionMenu:({label,triggerContent,className})=>React.createElement('button',{type:'button','aria-label':label,'data-testid':'catalog-menu-trigger',className},triggerContent)},'@/components/finance':{PageLayout:({header,children,className})=>React.createElement('div',{className},header,children),DataErrorBanner:()=>null,EmptyState:()=>null}};` })
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
    // Row height is measured in the populated catalog fixture below using the production column grids.
    expect(pageGeometry.searchHeight).toBeGreaterThanOrEqual(32)
    await page.getByRole('button', { name: 'Entidades' }).click()
    await expect(page.getByRole('button', { name: 'Entidades' })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Categorías' }).click()
  }
})

test('all catalog tabs use compact neutral rows and the shared contextual action geometry', async ({ page }, testInfo) => {
  const cssRoot = join(process.cwd(), '.next/static/css')
  const css = readdirSync(cssRoot).filter(file => file.endsWith('.css')).map(file => readFileSync(join(cssRoot, file), 'utf8')).join('\n')
  const assetsClasses = classMap(css, 'components/assets/AssetsListPanel.module.css', 'AssetsListPanel')
  const movementClasses = classMap(css, 'components/tables/TransactionsRound07.module.css', 'TransactionsRound07')
  const catalogClasses = classMap(css, 'components/management/CatalogWorkspace.module.css', 'CatalogWorkspace')
  await page.setContent('<main><div id="root"></div></main>')
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ path: join(process.cwd(), 'node_modules/react/umd/react.development.js') })
  await page.addScriptTag({ path: join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js') })
  await page.addScriptTag({ content: `window.React=React;window.__catalogModules={react:React,'@/components/assets/AssetsListPanel.module.css':{default:${JSON.stringify(assetsClasses)}},'@/components/management/CatalogWorkspace.module.css':{default:${JSON.stringify(catalogClasses)}},'@/components/tables/TransactionsRound07.module.css':{default:${JSON.stringify(movementClasses)}},'@/components/ui/AnchoredActionMenu':{AnchoredActionMenu:({label,triggerContent,className})=>React.createElement('button',{type:'button','aria-label':label,'data-testid':'catalog-menu-trigger',className},triggerContent)},'@/components/finance':{PageLayout:({header,children,className})=>React.createElement('div',{className},header,children),DataErrorBanner:()=>null,EmptyState:()=>null}};` })
  await page.addScriptTag({ content: compileLayout('components/management/catalog.tsx') })
  await page.addScriptTag({ content: `const React=window.React;const tabs=[{key:'categories',label:'Categorías'},{key:'entities',label:'Entidades'},{key:'currencies',label:'Monedas'},{key:'asset-types',label:'Tipos de activo'}];const fixtures={categories:{title:'Categorías',columns:['Categoría','Tipo','Origen','Relaciones','Acciones'],name:'Transporte',subtitle:'Categoría personal',type:'Egreso',origin:'Personalizada',relation:'—'},entities:{title:'Entidades',columns:['Entidad','País','Estado','Acciones'],name:'Banco Horizonte',subtitle:'Horizonte',type:'Perú',origin:'Activa'},currencies:{title:'Monedas',columns:['Moneda','País','Estado','Acciones'],name:'USD — Dólar estadounidense',subtitle:'Predeterminada',type:'Estados Unidos',origin:'Activa'},'asset-types':{title:'Tipos de activo',columns:['Tipo','Origen','Estado','Acciones'],name:'Tecnología',subtitle:'Registro del sistema',type:'Sistema',origin:'Activo'}};function FixtureRow({item}){const cell=window.__catalogCell;const identity=React.createElement(window.__catalogIdentity,{icon:React.createElement('span',{className:'inline-flex h-7 w-7 items-center justify-center text-[var(--ft-text-muted)]','data-testid':'catalog-fixture-icon'},'•'),title:item.name,subtitle:item.subtitle});const cells=[React.createElement(cell,{key:'identity',label:item.columns[0]},identity),React.createElement(cell,{key:'type',label:item.columns[1]},React.createElement('span',null,item.type)),React.createElement(cell,{key:'origin',label:item.columns[2]},React.createElement('span',{className:'inline-flex rounded-[4px] bg-[var(--ft-surface-muted)] px-2 py-1 text-[10px] font-semibold leading-4 text-[var(--ft-text-muted)]'},item.origin))];if(item.columns.length===5)cells.push(React.createElement(cell,{key:'relation',label:item.columns[3]},React.createElement('span',{title:'Dato no disponible con los datos cargados'},item.relation)));const actionCell=React.createElement(cell,{key:'actions',label:'Acciones',align:'right'},React.createElement(window.__catalogRowActions,{label:item.name,onEdit:()=>{},actions:[{id:'delete',label:'Eliminar',destructive:true,onSelect:()=>{}}]}));cells.push(actionCell);const grid=item.columns.length===5?'md:grid-cols-[minmax(0,1fr)_80px_100px_90px_120px] lg:grid-cols-[minmax(0,1.55fr)_100px_130px_120px_120px] md:items-center':item.title==='Entidades'?'md:grid-cols-[minmax(0,1fr)_115px_100px_120px] lg:grid-cols-[minmax(0,1.6fr)_200px_120px_120px] md:items-center':item.title==='Monedas'?'md:grid-cols-[minmax(0,1fr)_100px_100px_120px] lg:grid-cols-[minmax(0,1.6fr)_150px_120px_120px] md:items-center':'md:grid-cols-[minmax(0,1fr)_100px_100px_120px] lg:grid-cols-[minmax(0,1.6fr)_130px_120px_120px] md:items-center';return React.createElement(window.__catalogRow,{gridClassName:grid,'data-testid':'catalog-fixture-row'},...cells)}function Harness(){const [active,setActive]=React.useState('categories');const item=fixtures[active];const grid=item.title==='Categorías'?'md:grid-cols-[minmax(0,1fr)_80px_100px_90px_120px] lg:grid-cols-[minmax(0,1.55fr)_100px_130px_120px_120px] md:items-center':item.title==='Entidades'?'md:grid-cols-[minmax(0,1fr)_115px_100px_120px] lg:grid-cols-[minmax(0,1.6fr)_200px_120px_120px] md:items-center':item.title==='Monedas'?'md:grid-cols-[minmax(0,1fr)_100px_100px_120px] lg:grid-cols-[minmax(0,1.6fr)_150px_120px_120px] md:items-center':'md:grid-cols-[minmax(0,1fr)_100px_100px_120px] lg:grid-cols-[minmax(0,1.6fr)_130px_120px_120px] md:items-center';return React.createElement(window.__catalogLayout,{title:'Catálogos',description:'Referencias para organizar tus registros.',nav:tabs,activeKey:active,onSelect:setActive,action:React.createElement('button',{style:{height:36}},'Crear categoría')},React.createElement(window.__catalogTable,{title:item.title,count:1,search:React.createElement('input',{placeholder:'Buscar',style:{height:36}}),columns:item.columns.map(label=>({label,align:label==='Acciones'?'right':undefined})),gridClassName:grid},React.createElement(FixtureRow,{item})));}ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));` })

  for (const width of [390, 834, 1440, 1710]) {
    await page.setViewportSize({ width, height: 900 })
    for (const tab of ['Categorías', 'Entidades', 'Monedas', 'Tipos de activo']) {
      await page.getByRole('button', { name: tab }).click()
      await expect(page.getByRole('button', { name: tab })).toHaveAttribute('aria-pressed', 'true')
      await expect(page.getByTestId('catalog-fixture-row')).toBeVisible()
      await expect(page.locator('[aria-label^="Editar "]')).toBeVisible()
      await expect(page.getByTestId('catalog-menu-trigger')).toBeVisible()
      await page.screenshot({ path: testInfo.outputPath(`catalog-r3-${tab.toLowerCase().replaceAll(' ', '-')}-${width}.png`), fullPage: true })
      const geometry = await page.getByTestId('catalog-fixture-row').evaluate(element => {
        const icon = element.querySelector('[data-testid="catalog-fixture-icon"]')!
        const action = element.querySelector('[data-testid="catalog-menu-trigger"]')!
        return {
          rowHeight: element.getBoundingClientRect().height,
          columns: getComputedStyle(element).gridTemplateColumns,
          cellHeights: Array.from(element.children).map(cell => Math.round(cell.getBoundingClientRect().height)),
          rowShadow: getComputedStyle(element).boxShadow,
          iconWidth: icon.getBoundingClientRect().width,
          iconHeight: icon.getBoundingClientRect().height,
          actionHeight: action.getBoundingClientRect().height,
          scrollWidth: document.documentElement.scrollWidth,
          viewportWidth: document.documentElement.clientWidth,
        }
      })
      const headColumns = await page.getByTestId('catalog-table-head').evaluate(element => getComputedStyle(element).gridTemplateColumns)
      console.info(`[catalog R3 geometry] ${tab} ${width}px: row=${geometry.rowHeight.toFixed(1)}px, columns=${geometry.columns}, header=${headColumns}`)
      expect(geometry.rowShadow).toBe('none')
      expect(geometry.iconWidth).toBe(28)
      expect(geometry.iconHeight).toBe(28)
      expect(geometry.actionHeight).toBe(36)
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth)
      expect(geometry.rowHeight, `${tab} at ${width}px`).toBeLessThan(width < 768 ? 220 : 84)
      if (tab === 'Categorías') {
        const expectedColumnCount = width < 768 ? 2 : 5
        expect(geometry.columns.trim().split(/\s+/)).toHaveLength(expectedColumnCount)
        if (width >= 768) expect(headColumns).toBe(geometry.columns)
      }
    }
  }
})
