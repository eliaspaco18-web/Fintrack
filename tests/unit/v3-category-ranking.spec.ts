import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

function rankingSource(): string {
  const source = readFileSync(join(process.cwd(), 'components/finance/charts/CategoryRanking.tsx'), 'utf8')
    .replace(/^'use client'\s*/, '')
    .replace(/^import .*$/gm, '')
    .replace(/export type /g, 'type ')
    .replace(/export function /g, 'function ')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React },
  }).outputText
  return `${compiled}\nwindow.FinTrackCategoryRanking = CategoryRanking; window.rankingBarPercent = rankingBarPercent;`
}

test('category ranking preserves real IDs and keeps a real Otros category distinct from aggregate Others', async ({ page }) => {
  await page.setContent('<div id="root" data-ft-v3></div>')
  await page.addScriptTag({ path: join(process.cwd(), 'node_modules/react/umd/react.development.js') })
  await page.addScriptTag({ path: join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js') })
  await page.addScriptTag({ content: `
    const Link = ({ href, children, ...rest }) => React.createElement('a', { href, ...rest }, children);
  ` })
  await page.addScriptTag({ content: rankingSource() })
  await page.addScriptTag({ content: `
    window.aggregateOpens = 0;
    const rows = [
      { kind: 'category', key: 'cat-other', categoryId: 'cat-other', name: 'Otros',
        amount: 1200, formattedAmount: 'S/ 1,200.00', shareLabel: '30.0%', href: '/transactions?category_id=cat-other' },
      { kind: 'category', key: 'cat-food', categoryId: 'cat-food', name: 'Alimentos',
        amount: 600, formattedAmount: 'S/ 600.00', shareLabel: '15.0%', href: '/transactions?category_id=cat-food' },
      { kind: 'aggregate', key: 'aggregate-other', name: 'Otras categorías',
        amount: 300, formattedAmount: 'S/ 300.00', shareLabel: '7.5%',
        onInspect: () => { window.aggregateOpens += 1 } },
    ];
    ReactDOM.createRoot(document.getElementById('root')).render(
      React.createElement(window.FinTrackCategoryRanking, { rows }));
  ` })
  const realOthers = page.getByRole('link', { name: 'Otros, S/ 1,200.00, 30.0%' })
  await expect(realOthers).toHaveAttribute('data-category-id', 'cat-other')
  await expect(realOthers).toHaveAttribute('href', '/transactions?category_id=cat-other')
  await expect(page.getByRole('button', { name: 'Ver desglose de Otras categorías, S/ 300.00, 7.5%' })).toBeVisible()
  await page.getByRole('button', { name: 'Ver desglose de Otras categorías, S/ 300.00, 7.5%' }).click()
  expect(await page.evaluate(() => Reflect.get(window, 'aggregateOpens'))).toBe(1)
  const tracks = page.locator('.ft-v3-category-track > span')
  await expect(tracks.nth(0)).toHaveAttribute('style', 'width: 100%;')
  await expect(tracks.nth(1)).toHaveAttribute('style', 'width: 50%;')
  await expect(tracks.nth(2)).toHaveAttribute('style', 'width: 25%;')
  expect(await page.evaluate(() => Reflect.get(window, 'rankingBarPercent')(-20, 100))).toBe(0)
})
