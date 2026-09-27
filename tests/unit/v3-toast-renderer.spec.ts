import { expect, test } from '@playwright/test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

const reactPath = join(process.cwd(), 'node_modules/react/umd/react.development.js')
const reactDomPath = join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js')

function compileForBrowser(source: string): string {
  return ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React },
  }).outputText
}

function clockSource(): string {
  const source = readFileSync(join(process.cwd(), 'lib/toast/v3-acknowledgement-clock.ts'), 'utf8')
    .replace(/export (type|interface|const|function) /g, '$1 ')
  return `(function () {\n${compileForBrowser(source)}\nwindow.FinTrackToastClock = {
    createAcknowledgementClock, dismissAcknowledgement, enqueueAcknowledgement,
    resizeAcknowledgementClock, setAcknowledgementPause, tickAcknowledgements,
  };\n})()`
}

function rendererSource(): string {
  const source = readFileSync(join(process.cwd(), 'lib/toast/toast.tsx'), 'utf8')
    .replace(/^'use client'\s*/, '')
    .replace(/import\s*\{[\s\S]*?\}\s*from 'react'/,
      'const React = window.React; const { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } = React')
    .replace(/import\s*\{[\s\S]*?\}\s*from '\.\/v3-acknowledgement-clock'/,
      'const { createAcknowledgementClock, dismissAcknowledgement, enqueueAcknowledgement, resizeAcknowledgementClock, setAcknowledgementPause, tickAcknowledgements } = window.FinTrackToastClock')
    .replace(/export (type|interface|const|function) /g, '$1 ')
  return `(function () {\n${compileForBrowser(source)}\nwindow.FinTrackToast = { ToastProvider, ToastRenderer, useToast };\n})()`
}

async function mountToastHarness(page: import('@playwright/test').Page) {
  const browserErrors: string[] = []
  page.on('pageerror', error => browserErrors.push(error.message))
  await page.setContent('<div id="root"></div>')
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: clockSource() })
  await page.addScriptTag({ content: rendererSource() })
  await page.addScriptTag({ content: `
    function Controls() {
      const { toast } = window.FinTrackToast.useToast();
      return React.createElement('div', { id: 'controls' },
        React.createElement('button', { id: 'success', onClick: () => toast.success('Cuenta creada', 'Ahorros · PEN', { persist: false }) }, 'Éxito'),
        React.createElement('button', { id: 'persisted-success', onClick: () => toast.success('Cuenta guardada', 'Ahorros · PEN') }, 'Éxito persistido'),
        React.createElement('button', { id: 'warning', onClick: () => toast.warning('Revisar cuenta', 'Falta una referencia') }, 'Aviso'),
        React.createElement('button', { id: 'error', onClick: () => toast.error('No se guardó', 'Conservamos el formulario') }, 'Error'),
        React.createElement('button', { id: 'info', onClick: () => toast.info('Sincronización disponible') }, 'Info'),
        React.createElement('button', { id: 'clear', onClick: () => toast.clear() }, 'Limpiar'),
      );
    }
    ReactDOM.createRoot(document.getElementById('root')).render(
      React.createElement(window.FinTrackToast.ToastProvider, null,
        React.createElement(Controls), React.createElement(window.FinTrackToast.ToastRenderer)));
  ` })
  try {
    await page.locator('#success').waitFor({ timeout: 1500 })
  } catch {
    throw new Error(`Toast harness did not mount: ${browserErrors.join(' | ') || 'no browser exception'}`)
  }
}

test('renderer uses one provider, two desktop slots and a queued full lifetime', async ({ page }) => {
  await page.clock.install()
  await mountToastHarness(page)
  await page.locator('#success').click()
  await page.locator('#warning').click()
  await page.locator('#error').click()
  await expect(page.locator('.ft-v3-toast')).toHaveCount(2)
  await expect(page.getByRole('status').filter({ hasText: 'Cuenta creada' })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Revisar cuenta' })).toBeVisible()
  await page.clock.runFor(4350)
  await expect(page.getByRole('alert').filter({ hasText: 'No se guardó' })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Cierra en 9 s')
})

test('hover and focus pause the single remaining-time clock, then resume', async ({ page }) => {
  await page.clock.install()
  await mountToastHarness(page)
  await page.locator('#success').click()
  const toast = page.getByRole('status').filter({ hasText: 'Cuenta creada' })
  await toast.hover()
  await page.clock.runFor(5000)
  await expect(toast).toBeVisible()
  await expect(toast).toContainText('En pausa')
  await toast.getByRole('button', { name: 'Cerrar notificación' }).focus()
  await page.mouse.move(0, 0)
  await page.clock.runFor(5000)
  await expect(toast).toBeVisible()
  await toast.getByRole('button', { name: 'Cerrar notificación' }).blur()
  await page.clock.runFor(4350)
  await expect(page.getByRole('status').filter({ hasText: 'Cuenta creada' })).toHaveCount(0)
})

test('mobile shows one upper-right acknowledgement and captures compiled light/dark material', async ({ page }) => {
  await page.clock.install()
  await page.setViewportSize({ width: 390, height: 844 })
  await mountToastHarness(page)
  if (process.env.V3_CAPTURE_TOAST === '1') {
    const cssDirectory = join(process.cwd(), '.next/static/css')
    const cssName = readdirSync(cssDirectory, { recursive: true }).map(String).find(name => name.endsWith('.css') &&
      readFileSync(join(cssDirectory, name), 'utf8').includes('ft-v3-toast-enter'))
    if (!cssName) throw new Error('Build V3 CSS before capturing the acknowledgement')
    await page.addStyleTag({ content: readFileSync(join(cssDirectory, cssName), 'utf8') })
  }
  await page.locator('#success').click()
  await page.locator('#error').click()
  await expect(page.locator('.ft-v3-toast')).toHaveCount(1)
  if (process.env.V3_CAPTURE_TOAST === '1') {
    const captureStyle = await page.addStyleTag({ content: '#controls{visibility:hidden}' })
    await page.screenshot({ path: join(process.cwd(), 'docs/redesign-v3/implementation/stage4-toast-light-390.png') })
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
    await expect.poll(() => page.locator('.ft-v3-toast').evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(32, 35, 39)')
    await page.screenshot({ path: join(process.cwd(), 'docs/redesign-v3/implementation/stage4-toast-dark-390.png') })
    await captureStyle.evaluate(element => (element as Element).remove())
  }
})

test('reduced motion keeps the message and textual lifetime without moving the surface', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.install()
  await mountToastHarness(page)
  const cssDirectory = join(process.cwd(), '.next/static/css')
  const cssName = readdirSync(cssDirectory, { recursive: true }).map(String).find(name => name.endsWith('.css') &&
    readFileSync(join(cssDirectory, name), 'utf8').includes('ft-v3-toast-enter'))
  if (!cssName) throw new Error('Build V3 CSS before checking reduced motion')
  await page.addStyleTag({ content: readFileSync(join(cssDirectory, cssName), 'utf8') })
  await page.locator('#success').click()
  const toast = page.getByRole('status').filter({ hasText: 'Cuenta creada' })
  await expect(toast).toBeVisible()
  await expect(toast).toContainText('Cierra en 5 s')
  await expect.poll(() => toast.evaluate(element => getComputedStyle(element).animationName)).toBe('none')
  await expect.poll(() => toast.locator('.ft-v3-toast-fill').evaluate(element => getComputedStyle(element).display)).toBe('none')
  await page.clock.runFor(4350)
  await expect(toast).toHaveCount(0)
})

test('existing success activity persists once on dispatch, not again on countdown or dismissal', async ({ page }) => {
  let notificationPosts = 0
  await page.route('https://fintrack-synthetic.test/**', async route => {
    if (route.request().url().endsWith('/api/notifications')) {
      notificationPosts += 1
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
      return
    }
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body></body></html>' })
  })
  await page.goto('https://fintrack-synthetic.test/')
  await page.clock.install()
  await mountToastHarness(page)
  await page.locator('#persisted-success').click()
  await expect(page.getByRole('status').filter({ hasText: 'Cuenta guardada' })).toBeVisible()
  await expect.poll(() => notificationPosts).toBe(1)
  await page.clock.runFor(4350)
  await expect(page.getByRole('status').filter({ hasText: 'Cuenta guardada' })).toHaveCount(0)
  expect(notificationPosts).toBe(1)
})
