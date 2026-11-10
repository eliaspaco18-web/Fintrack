import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as ts from 'typescript'

function compileBudgetCategoryHook() {
  const sourcePath = resolve(process.cwd(), 'lib/hooks/useBudgetCategories.ts')
  const source = readFileSync(sourcePath, 'utf8')
    .replace(/^import .*\n/gm, '')
    .replace(/^'use client'\s*/m, '')
    .replace(/export\s+(?=function\b)/g, '')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText.replace(/^export\s*\{\s*\};?\s*$/gm, '')

  return `(() => {
    const { useCallback, useEffect, useRef, useState } = window.React;
    const fetchWithTimeout = window.__budgetFetchWithTimeout;
    const getApiErrorMessage = window.__budgetApiErrorMessage;
    ${compiled}
    window.__budgetCategoryHook = useBudgetCategories;
  })();`
}

async function mountBudgetCategoryHook(page: import('@playwright/test').Page) {
  await page.setContent('<div id="root"></div>')
  await page.addScriptTag({ path: resolve(process.cwd(), 'node_modules/react/umd/react.development.js') })
  await page.addScriptTag({ path: resolve(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js') })
  await page.addScriptTag({ content: 'window.React = React;' })
  await page.addScriptTag({ content: `(() => {
    window.__budgetFetchCalls = [];
    window.__budgetResponses = [];
    window.__budgetFetchWithTimeout = async url => {
      window.__budgetFetchCalls.push(url);
      const response = window.__budgetResponses.shift() || { ok: true, body: { ok: true, data: [
        { id: 'expense-1', name: 'Hogar', scope: 'EXPENSE', is_system: true },
        { id: 'income-1', name: 'Sueldo', scope: 'INCOME', is_system: true },
      ] } };
      await new Promise(resolve => setTimeout(resolve, 15));
      return { ok: response.ok, json: async () => response.body };
    };
    window.__budgetApiErrorMessage = (_json, fallback) => fallback;
  })();` })
  await page.addScriptTag({ content: compileBudgetCategoryHook() })
  await page.addScriptTag({ content: `(() => {
    const React = window.React;
    function Harness() {
      const [open, setOpen] = React.useState(false);
      const state = window.__budgetCategoryHook(open);
      return React.createElement('main', null,
        React.createElement('button', { 'data-testid': 'toggle-options', onClick: () => setOpen(value => !value) }, 'Toggle'),
        React.createElement('button', { 'data-testid': 'retry-options', onClick: () => void state.load() }, 'Retry'),
        React.createElement('span', { 'data-testid': 'category-count' }, String(state.categories.length)),
        React.createElement('span', { 'data-testid': 'category-error' }, state.error || ''),
        React.createElement('span', { 'data-testid': 'category-loading' }, String(state.isLoading))
      );
    }
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
  })();` })
}

test('budget category choices stay unloaded on list entry and load once when the form opens', async ({ page }) => {
  await mountBudgetCategoryHook(page)
  expect(await page.evaluate(() => (window as unknown as { __budgetFetchCalls: string[] }).__budgetFetchCalls)).toEqual([])
  await expect(page.getByTestId('category-loading')).toHaveText('false')

  await page.getByTestId('toggle-options').click()
  await expect(page.getByTestId('category-count')).toHaveText('1')
  expect(await page.evaluate(() => (window as unknown as { __budgetFetchCalls: string[] }).__budgetFetchCalls)).toEqual([
    '/api/categories?include_system=true',
  ])

  await page.getByTestId('toggle-options').click()
  await page.getByTestId('toggle-options').click()
  await expect(page.getByTestId('category-count')).toHaveText('1')
  expect(await page.evaluate(() => (window as unknown as { __budgetFetchCalls: string[] }).__budgetFetchCalls)).toHaveLength(1)
})

test('budget category options can retry after a failed lazy load without fabricating a result', async ({ page }) => {
  await mountBudgetCategoryHook(page)
  await page.evaluate(() => {
    (window as unknown as { __budgetResponses: Array<unknown> }).__budgetResponses.push(
      { ok: false, body: { ok: false, error: { message: 'unavailable' } } },
    )
  })
  await page.getByTestId('toggle-options').click()
  await expect(page.getByTestId('category-error')).toHaveText('No se pudieron cargar las categorías')
  await expect(page.getByTestId('category-count')).toHaveText('0')

  await page.getByTestId('retry-options').click()
  await expect(page.getByTestId('category-count')).toHaveText('1')
  expect(await page.evaluate(() => (window as unknown as { __budgetFetchCalls: string[] }).__budgetFetchCalls)).toHaveLength(2)
})
