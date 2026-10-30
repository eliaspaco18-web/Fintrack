import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

function budgetSource(): string {
  const source = readFileSync(join(process.cwd(), 'components/finance/charts/BudgetProgressRow.tsx'), 'utf8')
    .replace(/^import .*$/gm, '')
    .replace(/export type /g, 'type ')
    .replace(/export function /g, 'function ')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React },
  }).outputText
  return `${compiled}\nwindow.FinTrackBudgetProgressRow = BudgetProgressRow; window.budgetTrackFill = budgetTrackFill;`
}

test('budget row caps only visual fill while keeping exact over-limit metric and target', async ({ page }) => {
  await page.setContent('<div id="root" data-ft-v3></div>')
  await page.addScriptTag({ path: join(process.cwd(), 'node_modules/react/umd/react.development.js') })
  await page.addScriptTag({ path: join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js') })
  await page.addScriptTag({ content: `
    const Link = ({ href, children, ...rest }) => React.createElement('a', { href, ...rest }, children);
  ` })
  await page.addScriptTag({ content: budgetSource() })
  await page.addScriptTag({ content: `
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(React.Fragment, null,
      React.createElement(window.FinTrackBudgetProgressRow, {
        periodId: 'period-123', href: '/budgets/period-123', label: 'Alimentación',
        spentLabel: 'S/ 860.00', limitLabel: 'S/ 800.00', state: 'valid',
        percentage: 107.5, percentageLabel: '107.5%', remainingLabel: 'Exceso S/ 60.00', exceeded: true,
      }),
      React.createElement(window.FinTrackBudgetProgressRow, {
        periodId: 'period-unknown', href: '/budgets/period-unknown', label: 'Viajes',
        spentLabel: 'S/ 0.00', limitLabel: 'S/ 0.00', state: 'invalid', reason: 'Sin límite válido',
      })));
  ` })

  const exceeded = page.locator('[data-budget-period-id="period-123"]')
  await expect(exceeded).toHaveAttribute('href', '/budgets/period-123')
  await expect(exceeded).toContainText('107.5%')
  await expect(exceeded).toContainText('Exceso S/ 60.00')
  await expect(exceeded).toContainText('de S/ 800.00')
  await expect(exceeded.locator('.ft-v3-budget-track > span')).toHaveAttribute('style', 'width: 100%;')
  const invalid = page.locator('[data-budget-period-id="period-unknown"]')
  await expect(invalid).toContainText('Sin límite válido')
  await expect(invalid.locator('.ft-v3-budget-track')).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'budgetTrackFill')(107.5))).toBe(100)
  expect(await page.evaluate(() => Reflect.get(window, 'budgetTrackFill')(-4))).toBe(0)
})
