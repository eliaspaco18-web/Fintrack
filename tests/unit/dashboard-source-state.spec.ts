import { expect, test } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'
import postcss from 'postcss'

declare global {
  interface Window {
    DashboardSourceState: (...args: never[]) => unknown
    dashboardStyles: Record<string, string>
    renderDashboardSource: (props: { loading: boolean; failed: boolean; available: boolean; content?: unknown }) => void
    renderDashboardBatch: (sources: Array<{ id: string; loading: boolean }>) => void
    retries: number
    sourceRegion: Element
    sourceRevealAnimation: Animation | undefined
  }
}

const reactPath = join(process.cwd(), 'node_modules/react/umd/react.development.js')
const reactDomPath = join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js')
const captureDirectory = process.env.DASHBOARD_SOURCE_CAPTURE_DIR

function capturePath(name: string) {
  if (!captureDirectory) return undefined
  mkdirSync(captureDirectory, { recursive: true })
  return join(captureDirectory, name)
}

function componentScript() {
  const source = readFileSync(join(process.cwd(), 'components/dashboard/DashboardSourceState.tsx'), 'utf8')
    .replace(/^'use client'\s*/, '')
    .replace("import { useEffect, useState, type ReactNode } from 'react'", 'const { useEffect, useState } = window.React')
    .replace("import styles from './DashboardRound07.module.css'", 'const styles = window.dashboardStyles')
    .replace(/export type /g, 'type ')
    .replace(/export function /g, 'function ')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React },
  }).outputText
  const browserScript = compiled.replace(/^"use strict";\s*Object\.defineProperty\(exports, "__esModule", \{ value: true \}\);\s*/m, '')
  return `(() => { const React = window.React;\n${browserScript}\nwindow.DashboardSourceState = DashboardSourceState; })()`
}

function sourceStyles() {
  const source = postcss.parse(readFileSync(join(process.cwd(), 'components/dashboard/DashboardRound07.module.css'), 'utf8'))
  const output = postcss.root()
  const names = ['sourceRegion', 'sourceReady', 'sourceSkeleton', 'summarySource', 'skeletonLine', 'facts', 'resultFact', 'sourceState', 'stale']
  source.walkRules(rule => {
    if (!names.some(name => rule.selector.includes(`.${name}`))) return
    let clone: postcss.Node = rule.clone()
    let parent = rule.parent
    while (parent && parent.type === 'atrule') {
      clone = parent.clone({ nodes: [clone] })
      parent = parent.parent
    }
    output.append(clone)
  })
  source.walkAtRules('keyframes', rule => {
    if (rule.params === 'dashboardSourceReveal' || rule.params === 'dashboardSkeletonPulse') output.append(rule.clone())
  })
  output.append(postcss.parse('@media (prefers-reduced-motion: reduce) { .sourceReady, .sourceSkeleton *, .skeletonLine { animation: none !important; transition: none !important; } }').nodes!)
  return output.toString()
}

async function mount(page: import('@playwright/test').Page) {
  await page.setContent('<!doctype html><html><head></head><body><main class="dashboardCompare"><section class="dashboardSample"><h2>Antes · espera de texto</h2><div class="sourceState" role="status" aria-busy="true">Cargando información…</div></section><section class="dashboardSample"><h2>Después · espacio reservado</h2><div id="root"></div></section></main></body></html>')
  await page.addStyleTag({ content: `:root { --ft-surface-muted: #f0f2f4; --ft-border: #dfe3e7; --ft-surface: #fff; --ft-text-muted: #59636d; } body { margin: 0; padding: 18px; background: #f8f9fa; font: 14px Manrope, system-ui, sans-serif; } .dashboardCompare { display: grid; grid-template-columns: repeat(2, minmax(0, 440px)); gap: 16px; align-items: start; } .dashboardSample { min-width: 0; overflow: hidden; border: 1px solid var(--ft-border); border-radius: 12px; background: #fff; } .dashboardSample h2 { margin: 0; padding: 12px 16px; border-bottom: 1px solid var(--ft-border); color: #242a30; font: 600 12px Manrope, system-ui, sans-serif; } #root { width: 100%; max-width: 100%; } ${sourceStyles()}` })
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: `window.dashboardStyles = new Proxy({}, { get: (_target, key) => String(key) });` })
  await page.addScriptTag({ content: componentScript() })
  await page.addScriptTag({ content: `
    const React = window.React;
    const root = ReactDOM.createRoot(document.getElementById('root'));
    window.renderDashboardSource = props => root.render(React.createElement(window.DashboardSourceState, {
      skeleton: 'summary', regionClassName: 'summarySource', retry: () => { window.retries = (window.retries || 0) + 1; },
      ...props,
    }, props.content || React.createElement('div', { className: 'facts' }, React.createElement('div', null, 'Ingreso'), React.createElement('div', null, 'Egreso'), React.createElement('div', { className: 'resultFact' }, 'Resultado'))));
    window.renderDashboardBatch = sources => root.render(React.createElement('div', null, sources.map(source => React.createElement(window.DashboardSourceState, {
      key: source.id, loading: source.loading, failed: false, available: !source.loading, skeleton: 'summary',
      regionClassName: 'summarySource', retry: () => {},
    }, React.createElement('div', { 'data-testid': 'ready-' + source.id }, source.id)))));
  ` })
}

test('dashboard reserves the section while loading, delays the skeleton, and keeps stale data during revalidation', async ({ page }) => {
  await mount(page)
  await page.evaluate(() => window.renderDashboardSource({ loading: true, failed: false, available: false }))
  const region = page.locator('#root > div')
  await expect(region).toHaveAttribute('aria-busy', 'true')
  const before = await region.evaluate(element => element.getBoundingClientRect().height)
  expect(before).toBeGreaterThanOrEqual(96)
  await expect(page.locator('.sourceSkeleton')).toHaveCSS('opacity', '0')
  await page.waitForTimeout(145)
  await expect(page.locator('.sourceSkeleton')).toHaveCSS('opacity', '1')
  const loadingCapture = capturePath('fintrack-dashboard-section-loading.png')
  if (loadingCapture) await page.screenshot({ path: loadingCapture, fullPage: true })
  const loadingHeight = await region.evaluate(element => element.getBoundingClientRect().height)
  await page.evaluate(() => window.renderDashboardSource({ loading: false, failed: false, available: true }))
  await expect(region).not.toHaveAttribute('aria-busy', 'true')
  await expect(page.locator('.sourceSkeleton')).toHaveCount(0)
  expect(await region.evaluate(element => element.getBoundingClientRect().height)).toBe(loadingHeight)
  await page.waitForTimeout(180)
  const readyCapture = capturePath('fintrack-dashboard-section-ready.png')
  if (readyCapture) await page.screenshot({ path: readyCapture, fullPage: true })

  await region.evaluate(element => {
    window.sourceRegion = element
    window.sourceRevealAnimation = element.getAnimations()[0]
  })
  await page.evaluate(() => window.renderDashboardSource({ loading: false, failed: false, available: true }))
  expect(await region.evaluate(element => element.isSameNode(window.sourceRegion))).toBe(true)
  expect(await region.evaluate(element => element.getAnimations()[0] === window.sourceRevealAnimation)).toBe(true)
  expect(await region.evaluate(element => element.getBoundingClientRect().height)).toBe(loadingHeight)

  await page.evaluate(() => window.renderDashboardSource({ loading: false, failed: true, available: true }))
  await expect(page.locator('.stale')).toContainText('últimos datos disponibles')
  await expect(page.locator('.sourceSkeleton')).toHaveCount(0)
  await expect(page.getByText('Resultado')).toBeVisible()
})

test('fast dashboard data does not flash a skeleton and isolated failures keep retry available', async ({ page }) => {
  await mount(page)
  await page.evaluate(() => window.renderDashboardSource({ loading: true, failed: false, available: false }))
  await page.waitForTimeout(35)
  await page.evaluate(() => window.renderDashboardSource({ loading: false, failed: false, available: true }))
  await page.waitForTimeout(140)
  await expect(page.locator('.sourceSkeleton')).toHaveCount(0)

  await page.evaluate(() => window.renderDashboardSource({ loading: false, failed: true, available: false }))
  const alert = page.getByRole('alert')
  await expect(alert).toContainText('No se pudo cargar esta sección')
  await alert.getByRole('button', { name: 'Reintentar' }).click()
  expect(await page.evaluate(() => window.retries)).toBe(1)
})

test('independent dashboard sections settle as delayed sources return out of order', async ({ page }) => {
  await mount(page)
  await page.evaluate(() => window.renderDashboardBatch([
    { id: 'summary', loading: true },
    { id: 'flow', loading: true },
    { id: 'recent', loading: true },
  ]))
  await page.waitForTimeout(300)
  await page.evaluate(() => window.renderDashboardBatch([
    { id: 'summary', loading: true },
    { id: 'flow', loading: true },
    { id: 'recent', loading: false },
  ]))
  await expect(page.getByTestId('ready-recent')).toBeVisible()
  await expect(page.getByTestId('ready-summary')).toHaveCount(0)
  await expect(page.getByTestId('ready-flow')).toHaveCount(0)

  await page.waitForTimeout(500)
  await page.evaluate(() => window.renderDashboardBatch([
    { id: 'summary', loading: true },
    { id: 'flow', loading: false },
    { id: 'recent', loading: false },
  ]))
  await expect(page.getByTestId('ready-flow')).toBeVisible()
  await expect(page.getByTestId('ready-summary')).toHaveCount(0)

  await page.waitForTimeout(1200)
  await page.evaluate(() => window.renderDashboardBatch([
    { id: 'summary', loading: false },
    { id: 'flow', loading: false },
    { id: 'recent', loading: false },
  ]))
  await expect(page.getByTestId('ready-summary')).toBeVisible()
  const heights = await page.locator('#root > div > div').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height))
  expect(heights).toEqual([98, 98, 98])
})

test('dashboard skeleton and reveal honor reduced-motion preference', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await mount(page)
  await page.evaluate(() => window.renderDashboardSource({ loading: true, failed: false, available: false }))
  await page.waitForTimeout(145)
  await expect(page.locator('.sourceReady')).toHaveCount(0)
  await expect(page.locator('.skeletonLine').first()).toHaveCSS('animation-name', 'none')
  await page.evaluate(() => window.renderDashboardSource({ loading: false, failed: false, available: true }))
  await expect(page.locator('.sourceReady')).toHaveCSS('animation-name', 'none')
})
