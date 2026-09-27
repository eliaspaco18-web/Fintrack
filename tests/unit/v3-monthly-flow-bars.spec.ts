import { expect, test } from '@playwright/test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

function flowSource(): string {
  const source = readFileSync(join(process.cwd(), 'components/finance/charts/MonthlyFlowBars.tsx'), 'utf8')
    .replace(/^'use client'\s*/, '')
    .replace(/^import .*$/gm, '')
    .replace(/export interface /g, 'interface ')
    .replace(/export function /g, 'function ')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React },
  }).outputText
  return `${compiled}\nwindow.FinTrackMonthlyFlowBars = MonthlyFlowBars; window.FinTrackMonthlyFlowDataTable = MonthlyFlowDataTable; window.flowDomain = flowDomain;`
}

async function mount(page: import('@playwright/test').Page, viewportWidth = 1200) {
  await page.setViewportSize({ width: viewportWidth, height: 720 })
  await page.setContent('<style>#root{width:560px;max-width:calc(100vw - 32px);margin:16px}</style><output id="summary">Septiembre: S/ 5,120.00</output><div id="root" data-ft-v3></div><button id="outside">Fuera</button>')
  await page.addScriptTag({ path: join(process.cwd(), 'node_modules/react/umd/react.development.js') })
  await page.addScriptTag({ path: join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js') })
  await page.addScriptTag({ content: `const { useEffect, useId, useMemo, useRef, useState } = React;` })
  await page.addScriptTag({ content: flowSource() })
  await page.addScriptTag({ content: `
    window.flowPoints = [
      { id:'apr',label:'Abr',periodLabel:'Abril 2026',income:8000,expense:6000,incomeLabel:'S/ 8,000.00',expenseLabel:'S/ 6,000.00',resultLabel:'S/ 2,000.00' },
      { id:'may',label:'May',periodLabel:'Mayo 2026',income:9000,expense:7000,incomeLabel:'S/ 9,000.00',expenseLabel:'S/ 7,000.00',resultLabel:'S/ 2,000.00' },
      { id:'jun',label:'Jun',periodLabel:'Junio 2026',income:null,expense:null,incomeLabel:'No disponible',expenseLabel:'No disponible',resultLabel:'No disponible' },
      { id:'jul',label:'Jul',periodLabel:'Julio 2026',income:10000,expense:6500,incomeLabel:'S/ 10,000.00',expenseLabel:'S/ 6,500.00',resultLabel:'S/ 3,500.00' },
      { id:'aug',label:'Ago',periodLabel:'Agosto 2026',income:11000,expense:7200,incomeLabel:'S/ 11,000.00',expenseLabel:'S/ 7,200.00',resultLabel:'S/ 3,800.00' },
      { id:'sep',label:'Set',periodLabel:'Septiembre 2026',income:12480,expense:7360,incomeLabel:'S/ 12,480.00',expenseLabel:'S/ 7,360.00',resultLabel:'S/ 5,120.00',partial:true },
    ];
    ReactDOM.createRoot(document.getElementById('root')).render(
      React.createElement(React.Fragment, null,
        React.createElement(window.FinTrackMonthlyFlowBars, { points: window.flowPoints }),
        React.createElement(window.FinTrackMonthlyFlowDataTable, { points: window.flowPoints })));
  ` })
  await page.locator('.ft-v3-flow-svg').waitFor()
}

async function captureMaterial(page: import('@playwright/test').Page, name: string) {
  const cssDirectory = join(process.cwd(), '.next/static/css')
  const cssName = readdirSync(cssDirectory, { recursive: true }).map(String).find(name => name.endsWith('.css') &&
    readFileSync(join(cssDirectory, name), 'utf8').includes('ft-v3-flow-tooltip'))
  if (!cssName) throw new Error('Build V3 CSS before capturing the monthly flow')
  await page.addStyleTag({ content: readFileSync(join(cssDirectory, cssName), 'utf8') })
  await page.addStyleTag({ content: '#root{padding:18px;background:var(--ft-surface);border-radius:18px;color:var(--ft-text-strong)}body{background:#f5f6f7}' })
  await page.locator('.ft-v3-flow-svg').screenshot({
    path: join(process.cwd(), `docs/redesign-v3/implementation/stage5-flow-${name}.png`),
  })
}

test('monthly lens changes only chart-local reading and retains exact missing/partial data', async ({ page }) => {
  await mount(page)
  if (process.env.V3_CAPTURE_FLOW === '1') {
    await captureMaterial(page, 'light-desktop')
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
    await captureMaterial(page, 'dark-desktop')
  }
  await expect(page.locator('.ft-v3-flow-result')).toContainText('Septiembre 2026 (parcial)')
  await expect(page.locator('.ft-v3-flow-result')).toContainText('S/ 5,120.00')
  await expect(page.getByRole('row', { name: /Junio 2026 No disponible/ })).toBeVisible()
  const august = page.getByRole('button', { name: /Agosto 2026: ingresos S\/ 11,000.00/ })
  await august.hover()
  await expect(page.locator('.ft-v3-flow-result')).toContainText('Agosto 2026')
  await expect(page.getByRole('tooltip')).toContainText('S/ 3,800.00')
  await expect(page.locator('#summary')).toHaveText('Septiembre: S/ 5,120.00')
  await page.locator('#outside').hover()
  await expect(page.locator('.ft-v3-flow-result')).toContainText('Septiembre 2026')
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  await august.focus()
  await august.press('Enter')
  await expect(page.locator('.ft-v3-flow-result')).toContainText('Agosto 2026')
  await august.press('Escape')
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  await expect(page.locator('.ft-v3-flow-result')).toContainText('Agosto 2026')
})

test('mobile shows three plot groups while its exact alternative retains six months', async ({ page }) => {
  await mount(page, 390)
  if (process.env.V3_CAPTURE_FLOW === '1') await captureMaterial(page, 'light-mobile')
  await expect.poll(() => page.locator('.ft-v3-flow-svg [role="button"]').count()).toBe(3)
  await expect(page.getByRole('row')).toHaveCount(7)
  const active = page.locator('.ft-v3-flow-svg [role="button"][tabindex="0"]')
  await expect(active).toHaveCount(1)
  await active.focus()
  await active.press('ArrowLeft')
  await expect(page.locator('.ft-v3-flow-result')).toContainText('Agosto 2026')
  await expect(page.getByRole('tooltip')).toContainText('S/ 11,000.00')
})

test('zero and negative domains retain zero baseline without generating fake bars', async ({ page }) => {
  await mount(page)
  const result = await page.evaluate(() => {
    const domain = Reflect.get(window, 'flowDomain') as (points: Array<{ income: number | null; expense: number | null }>) => unknown
    return {
      zero: domain([{ income: 0, expense: 0 }]),
      negative: domain([{ income: -200, expense: 600 }]),
      missing: domain([{ income: null, expense: null }]),
    }
  })
  expect(result.zero).toEqual({ minimum: 0, maximum: 0, ticks: [0] })
  expect(result.missing).toEqual({ minimum: 0, maximum: 0, ticks: [0] })
  expect(result.negative).toEqual({ minimum: -200, maximum: 1000, ticks: [-200, 0, 1000] })
})
