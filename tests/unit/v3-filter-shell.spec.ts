import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

function compileSource(path: string, exportName: string): string {
  const source = readFileSync(join(process.cwd(), path), 'utf8')
    .replace(/^'use client'\s*/, '')
    .replace(/^import .*$/gm, '')
    .replace(/export interface /g, 'interface ')
    .replace(/export function /g, 'function ')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React },
  }).outputText
  return `${compiled}\nwindow.${exportName} = ${exportName};`
}

test('filter drawer never applies draft on search, clear or cancel', async ({ page }) => {
  await page.setContent('<div id="root"></div>')
  await page.addScriptTag({ path: join(process.cwd(), 'node_modules/react/umd/react.development.js') })
  await page.addScriptTag({ path: join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js') })
  await page.addScriptTag({ content: `
    const Button = ({ children, onClick, disabled }) => React.createElement('button', { type: 'button', onClick, disabled }, children);
    const RecordModalFooter = ({ children }) => React.createElement('footer', null, children);
    const RecordModal = ({ open, onClose, children }) => open
      ? React.createElement('div', { role: 'dialog' },
          React.createElement('button', { onClick: onClose }, 'Close panel'), children)
      : null;
  ` })
  await page.addScriptTag({ content: compileSource('components/finance/filters/V3FilterDrawer.tsx', 'V3FilterDrawer') })
  await page.addScriptTag({ content: `
    function Harness() {
      const [open, setOpen] = React.useState(false);
      const [draft, setDraft] = React.useState('Todas');
      const [applied, setApplied] = React.useState('Todas');
      const cancel = () => { setDraft(applied); setOpen(false); };
      return React.createElement(React.Fragment, null,
        React.createElement('button', { id: 'open', onClick: () => setOpen(true) }, 'Open'),
        React.createElement('output', { id: 'applied' }, applied),
        React.createElement(window.V3FilterDrawer, {
          open, onCancel: cancel, onClearDraft: () => setDraft(''),
          onApply: () => { setApplied(draft); setOpen(false); },
        }, React.createElement('input', { 'aria-label': 'Categoría', value: draft,
          onChange: event => setDraft(event.target.value) })));
    }
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
  ` })

  await page.locator('#open').click()
  await page.getByRole('textbox', { name: 'Categoría' }).fill('Comida')
  await expect(page.locator('#applied')).toHaveText('Todas')
  await page.getByRole('button', { name: 'Limpiar filtros' }).click()
  await expect(page.getByRole('textbox', { name: 'Categoría' })).toHaveValue('')
  await expect(page.locator('#applied')).toHaveText('Todas')
  await page.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.locator('#applied')).toHaveText('Todas')
  await page.locator('#open').click()
  await page.getByRole('textbox', { name: 'Categoría' }).fill('Transporte')
  await page.getByRole('button', { name: 'Aplicar filtros' }).click()
  await expect(page.locator('#applied')).toHaveText('Transporte')
  expect(await page.evaluate(() => location.search)).toBe('')
})

test('scope chips remove only their own caller-owned filter ID', async ({ page }) => {
  await page.setContent('<div id="root"></div>')
  await page.addScriptTag({ path: join(process.cwd(), 'node_modules/react/umd/react.development.js') })
  await page.addScriptTag({ path: join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js') })
  await page.addScriptTag({ content: compileSource('components/finance/filters/V3ScopeChips.tsx', 'V3ScopeChips') })
  await page.addScriptTag({ content: `
    function Harness() {
      const [ids, setIds] = React.useState(['account_id', 'category_id']);
      const chips = ids.map(id => ({ id, label: id === 'account_id' ? 'Cuenta principal' : 'Alimentos',
        onRemove: () => setIds(value => value.filter(item => item !== id)) }));
      return React.createElement(window.V3ScopeChips, { chips, onClearAll: () => setIds([]) });
    }
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
  ` })
  await page.getByRole('button', { name: 'Quitar filtro: Cuenta principal' }).click()
  await expect(page.getByRole('button', { name: 'Quitar filtro: Cuenta principal' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Quitar filtro: Alimentos' })).toBeVisible()
  await page.getByRole('button', { name: 'Limpiar todo' }).click()
  await expect(page.getByRole('group', { name: 'Filtros aplicados' })).toHaveCount(0)
})
