import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

function chartFrameSource(): string {
  const source = readFileSync(join(process.cwd(), 'components/finance/charts/ChartFrame.tsx'), 'utf8')
    .replace(/^'use client'\s*/, '')
    .replace(/^import .*$/gm, '')
    .replace('export type ChartFrameProps', 'type ChartFrameProps')
    .replace('export function ChartFrame', 'function ChartFrame')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React },
  }).outputText
  return `${compiled}\nwindow.FinTrackChartFrame = ChartFrame;`
}

async function mount(page: import('@playwright/test').Page) {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setContent('<div id="root"></div>')
  await page.addScriptTag({ path: join(process.cwd(), 'node_modules/react/umd/react.development.js') })
  await page.addScriptTag({ path: join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js') })
  await page.addScriptTag({ content: `
    const { useId, useState } = React;
    const DataBoundary = props => {
      if (props.state === 'error') return React.createElement('div', { role: 'alert' },
        props.message, props.onRetry && React.createElement('button', { onClick: props.onRetry }, 'Reintentar'));
      if (props.state === 'initial') return React.createElement('div', { 'aria-busy': true }, props.skeleton);
      return React.createElement('div', null, props.children);
    };
  ` })
  await page.addScriptTag({ content: chartFrameSource() })
  if (!await page.evaluate(() => typeof Reflect.get(window, 'FinTrackChartFrame') === 'function')) {
    throw new Error(`ChartFrame did not compile in the isolated harness: ${errors.join(' | ') || 'unknown browser error'}`)
  }
}

test('chart frame exposes exact scope, summary and keyboard-accessible data table without mutating other facts', async ({ page }) => {
  await mount(page)
  await page.addScriptTag({ content: `
    function Harness() {
      const [summary, setSummary] = React.useState('Septiembre: S/ 5,120.00');
      return React.createElement(React.Fragment, null,
        React.createElement('output', { id: 'monthly-summary' }, summary),
        React.createElement(window.FinTrackChartFrame, {
          title: 'Flujo mensual', unit: 'PEN de reporte', interval: 'Abril–septiembre 2026',
          summary: 'Ingresos y egresos registrados por mes.', state: 'ready',
          chart: React.createElement('div', { id: 'chart' }, 'Gráfico de pares'),
          dataTable: React.createElement('table', null, React.createElement('tbody', null,
            React.createElement('tr', null, React.createElement('th', null, 'Septiembre'),
              React.createElement('td', null, 'S/ 12,480.00')))),
        }));
    }
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
  ` })
  await expect(page.getByRole('region', { name: 'Flujo mensual' })).toContainText('Abril–septiembre 2026 · PEN de reporte')
  await expect(page.getByRole('region', { name: 'Flujo mensual' })).toContainText('Ingresos y egresos registrados por mes.')
  await expect(page.locator('#chart')).toBeVisible()
  const toggle = page.getByRole('button', { name: 'Ver datos' })
  await toggle.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('table')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'S/ 12,480.00' })).toBeVisible()
  await expect(page.locator('#monthly-summary')).toHaveText('Septiembre: S/ 5,120.00')
  await page.getByRole('button', { name: 'Ver gráfico' }).click()
  await expect(page.locator('#chart')).toBeVisible()
})

test('chart error keeps its exact scope and retry without inventing a zero series', async ({ page }) => {
  await mount(page)
  await page.addScriptTag({ content: `
    window.retries = 0;
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(window.FinTrackChartFrame, {
      title: 'Flujo mensual', unit: 'PEN de reporte', interval: 'Abril–septiembre 2026',
      summary: 'Historial no disponible por ahora.', state: 'error',
      message: 'No se pudo consultar la serie.', onRetry: () => { window.retries += 1 },
    }));
  ` })
  await expect(page.getByRole('region', { name: 'Flujo mensual' })).toContainText('Abril–septiembre 2026')
  await expect(page.getByRole('alert')).toContainText('No se pudo consultar la serie.')
  await expect(page.getByRole('button', { name: 'Ver datos' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Reintentar' }).click()
  expect(await page.evaluate(() => Reflect.get(window, 'retries'))).toBe(1)
})
