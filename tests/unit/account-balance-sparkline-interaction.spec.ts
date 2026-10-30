import { expect, test } from '@playwright/test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

declare global {
  interface Window {
    FinTrackCurrencyDisplay: {
      formatPortfolioAmount: (
        amount: number,
        currencyCode: string,
        currencies: readonly { code: string; name: string; symbol: string; is_system: boolean }[],
      ) => string
    }
  }
}

const cssDirectory = join(process.cwd(), '.next/static/css')
const reactPath = join(process.cwd(), 'node_modules/react/umd/react.development.js')
const reactDomPath = join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js')
const componentPath = join(process.cwd(), 'components/management/AccountBalanceSparkline.tsx')
const currencyPath = join(process.cwd(), 'modules/portfolio/currency-display.ts')

const sampleHistory = {
  status: 'available',
  points: [
    { month: '2026-07', balance: 27_400 },
    { month: '2026-08', balance: 28_100 },
    { month: '2026-09', balance: 28_980 },
  ],
}

function builtCss(): string {
  const files = readdirSync(cssDirectory).filter(file => file.endsWith('.css')).sort()
  if (files.length === 0) throw new Error('Build the application before running sparkline browser tests')
  return files.map(file => readFileSync(join(cssDirectory, file), 'utf8')).join('\n')
}

function browserCurrencySource(): string {
  const source = readFileSync(currencyPath, 'utf8').replace(/export function /g, 'function ')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
  }).outputText.replace('Object.defineProperty(exports, "__esModule", { value: true });', '')
  return `(() => { ${compiled}\nwindow.FinTrackCurrencyDisplay = { formatPortfolioAmount, getPortfolioCurrencyPresentation, groupPortfolioBalancesByCurrency }; })();`
}

function browserComponentSource(): string {
  const source = readFileSync(componentPath, 'utf8')
    .replace(/^'use client'\s*/, '')
    .replace(/import \{ createPortal \} from 'react-dom'/, 'const { createPortal } = window.ReactDOM')
    .replace(/import\s*\{[\s\S]*?\}\s*from 'react'/, 'const React = window.React; const { useCallback, useEffect, useId, useMemo, useRef, useState } = React')
    .replace(/import \{ formatPortfolioAmount \} from ['"][^'"]+['"]/, 'const { formatPortfolioAmount } = window.FinTrackCurrencyDisplay')
    .replace(/import type \{[^}]+\} from ['"][^'"]+account-monthly-history['"]\s*/, '')
    .replace(/export function /g, 'function ')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React },
  }).outputText
  return `(() => { ${compiled}\nwindow.FinTrackAccountBalanceSparkline = AccountBalanceSparkline; })();`
}

async function mountSparkline(page: import('@playwright/test').Page, options: { history?: typeof sampleHistory | { status: 'unavailable'; reason: string; points: [] } | null; dark?: boolean }) {
  page.on('pageerror', error => console.log('Sparkline browser error:', error.message))
  page.on('console', message => { if (message.type() === 'error') console.log('Sparkline console error:', message.text()) })
  await page.setContent('<div class="fin-shell" data-ft-v3 data-ft-v3-shell><div id="root"></div></div>')
  await page.addStyleTag({ content: builtCss() })
  if (options.dark) await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: browserCurrencySource() })
  await page.addScriptTag({ content: browserComponentSource() })
  await page.addScriptTag({ content: `(() => {
    const history = ${Object.hasOwn(options, 'history') ? JSON.stringify(options.history) : JSON.stringify(sampleHistory)};
    const currencies = [{ id:'pen', code:'PEN', name:'Sol peruano', symbol:'S/', is_default:true, is_system:true, is_active:true }];
    function Harness() {
      return React.createElement('div', { style:{ width:'280px', margin:'100px auto', padding:'16px', border:'1px solid var(--ft-border)', background:'var(--ft-surface)' } },
        React.createElement(window.FinTrackAccountBalanceSparkline, {
          history, currency:'PEN', currencies, loading:false, unavailable:false,
        })
      );
    }
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
  })();` })
}

test('history tooltip maps each hover region to its real month and formatted closing amount', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mountSparkline(page, {})
  const chart = page.getByRole('group', { name: /Cierres mensuales/ })
  const chartBox = await chart.boundingBox()
  expect(chartBox).not.toBeNull()
  const points = sampleHistory.points

  const line = page.locator('.account-history-sparkline-line')
  await expect(line).toHaveCSS('animation-name', 'account-history-sparkline-draw')
  const initialAnimationTime = await line.evaluate(element => Number(element.getAnimations()[0]?.currentTime ?? 0))

  for (const [index, point] of points.entries()) {
    const coordinate = points.length === 1 ? 56 : 3 + (index * 106) / (points.length - 1)
    const x = chartBox!.x + (coordinate / 112) * chartBox!.width
    await page.mouse.move(x, chartBox!.y + chartBox!.height / 2)
    const tooltip = page.getByRole('tooltip')
    await expect(tooltip).toBeVisible()
    const expectedMonth = new Date(`${point.month}-01T12:00:00Z`).toLocaleDateString('es-PE', {
      month: 'long', year: 'numeric', timeZone: 'UTC',
    }).replace(/^./, first => first.toLocaleUpperCase('es-PE'))
    const expectedAmount = await page.evaluate(balance =>
      window.FinTrackCurrencyDisplay.formatPortfolioAmount(balance, 'PEN', [{ code:'PEN', name:'Sol peruano', symbol:'S/', is_system:true }]),
    point.balance)
    await expect(tooltip).toHaveText(`${expectedMonth}Saldo al cierre: ${expectedAmount}`)

    const bounds = await tooltip.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390)
    expect(bounds!.y).toBeGreaterThanOrEqual(0)
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844)
    expect(await tooltip.evaluate(element => element.parentElement === document.body)).toBe(true)
  }

  const activePoint = page.locator('.account-history-sparkline-point.is-active')
  await expect(activePoint).toHaveCount(1)
  await page.mouse.move(8, 8)
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  const finalAnimationTime = await line.evaluate(element => Number(element.getAnimations()[0]?.currentTime ?? 0))
  expect(finalAnimationTime).toBeGreaterThanOrEqual(initialAnimationTime)

  await chart.focus()
  await expect(page.getByRole('tooltip')).toContainText('Julio de 2026')
  await chart.press('ArrowRight')
  await expect(page.getByRole('tooltip')).toContainText('Agosto de 2026')
  await expect(page.locator('.account-history-sparkline-sr-only[aria-live="polite"]')).toContainText('Saldo al cierre:')
  await chart.press('End')
  await expect(page.getByRole('tooltip')).toContainText('Setiembre de 2026')
  await expect(chart).toHaveAttribute('aria-describedby', /.+/)
  await chart.press('Escape')
  await expect(page.getByRole('tooltip')).toHaveCount(0)
})

test('touch can select each monthly region and dismissal clears the tooltip', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
  try {
    const page = await context.newPage()
    await mountSparkline(page, {})
    const chart = page.getByRole('group', { name: /Cierres mensuales/ })
    const box = await chart.boundingBox()
    expect(box).not.toBeNull()

    await page.touchscreen.tap(box!.x + box!.width * 0.95, box!.y + box!.height / 2)
    const tooltip = page.getByRole('tooltip')
    await expect(tooltip).toContainText('Setiembre de 2026')
    await expect(tooltip).toContainText('Saldo al cierre:')
    await expect(chart).toHaveAttribute('aria-describedby', /.+/)
    await page.touchscreen.tap(16, 24)
    await expect(tooltip).toHaveCount(0)
  } finally {
    await context.close()
  }
})

test('no history stays empty of invented points; reduced motion removes draw and tooltip animation', async ({ page }) => {
  await page.setViewportSize({ width: 834, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await mountSparkline(page, { history: undefined })
  await expect(page.getByText('Cierres mensuales no disponibles')).toBeVisible()
  await expect(page.locator('.account-history-sparkline-svg')).toHaveCount(0)
  await expect(page.getByRole('tooltip')).toHaveCount(0)

  await page.setContent('<div class="fin-shell" data-ft-v3 data-ft-v3-shell><div id="root"></div></div>')
  await page.addStyleTag({ content: builtCss() })
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: browserCurrencySource() })
  await page.addScriptTag({ content: browserComponentSource() })
  await page.addScriptTag({ content: `(() => {
    const history = ${JSON.stringify(sampleHistory)};
    function Harness() {
      return React.createElement(window.FinTrackAccountBalanceSparkline, {
        history, currency:'PEN', currencies:[{code:'PEN',name:'Sol peruano',symbol:'S/',is_system:true}], loading:false, unavailable:false,
      });
    }
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
  })();` })
  const line = page.locator('.account-history-sparkline-line')
  await expect(line).toHaveCSS('animation-name', 'none')
  await expect(line).toHaveCSS('stroke-dashoffset', '0px')
  await page.getByRole('group', { name: /Cierres mensuales/ }).focus()
  await expect(page.getByRole('tooltip')).toHaveCSS('animation-name', 'none')
})

test('sparkline tooltip uses dark V3 surfaces and stays within a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mountSparkline(page, { dark: true })
  const chart = page.getByRole('group', { name: /Cierres mensuales/ })
  const box = await chart.boundingBox()
  await page.mouse.move(box!.x + box!.width - 1, box!.y + box!.height / 2)
  const tooltip = page.getByRole('tooltip')
  await expect(tooltip).toContainText('Setiembre de 2026')
  const styling = await tooltip.evaluate(element => ({
    background: getComputedStyle(element).backgroundColor,
    surface: getComputedStyle(document.documentElement).getPropertyValue('--ft-surface').trim(),
    left: element.getBoundingClientRect().left,
    right: element.getBoundingClientRect().right,
  }))
  expect(styling.background).not.toBe('rgb(255, 255, 255)')
  expect(styling.left).toBeGreaterThanOrEqual(0)
  expect(styling.right).toBeLessThanOrEqual(390)
})
