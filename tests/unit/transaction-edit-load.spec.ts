import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

const reactPath = join(process.cwd(), 'node_modules/react/umd/react.development.js')
const reactDomPath = join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js')

function editRecordHookSource(): string {
  const source = readFileSync(join(process.cwd(), 'components/forms/use-transaction-edit-record.ts'), 'utf8')
    .replace(/^'use client'\s*/, '')
    .replace(/import \{[^}]+\} from 'react'/, 'const { useCallback, useEffect, useRef, useState } = window.React')
    .replace(/export interface /g, 'interface ')
    .replace(/export function /g, 'function ')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
  }).outputText
  return `var exports = {};\n${compiled}\nwindow.useTransactionEditRecord = useTransactionEditRecord;`
}

async function mount(page: import('@playwright/test').Page) {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setContent('<div id="root"></div>')
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: editRecordHookSource() })
  await page.addScriptTag({ content: `
    window.pendingRequests = [];
    window.fetch = (url, options = {}) => new Promise((resolve, reject) => {
      const request = { url, options, resolve, reject };
      window.pendingRequests.push(request);
      options.signal?.addEventListener('abort', () => {
        request.aborted = true;
        const aborted = new Error('aborted');
        aborted.name = 'AbortError';
        reject(aborted);
      }, { once: true });
    });
    window.respond = (id, payload, ok = true) => {
      const request = [...window.pendingRequests].reverse().find(item => item.url.endsWith('/' + id) && !item.resolved);
      if (!request) throw new Error('No pending request for ' + id);
      request.resolved = true;
      request.resolve({ ok, json: async () => payload });
    };
    function Harness() {
      const [open, setOpen] = React.useState(false);
      const [id, setId] = React.useState(null);
      const record = window.useTransactionEditRecord(open, id);
      return React.createElement(React.Fragment, null,
        React.createElement('button', { id: 'open-a', onClick: () => { setId('a'); setOpen(true); } }, 'Open A'),
        React.createElement('button', { id: 'open-b', onClick: () => { setId('b'); setOpen(true); } }, 'Open B'),
        React.createElement('button', { id: 'close', onClick: () => setOpen(false) }, 'Close'),
        React.createElement('button', { id: 'exit-complete', onClick: record.clearAfterExit }, 'Exit complete'),
        React.createElement('button', { id: 'retry', onClick: record.retry }, 'Retry'),
        React.createElement('span', { id: 'status' }, record.status),
        record.status === 'loading' ? React.createElement('div', { id: 'skeleton', 'aria-busy': 'true' }, 'skeleton') : null,
        record.error ? React.createElement('div', { id: 'error', role: 'alert' }, record.error) : null,
        record.transaction ? React.createElement('div', { id: 'loaded', 'data-id': record.transaction.id },
          React.createElement('span', { id: 'description' }, record.transaction.description),
          React.createElement('span', { id: 'amount' }, record.transaction.amount),
          React.createElement('span', { id: 'date' }, record.transaction.transaction_date)) : null);
    }
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
  ` })
  try {
    await page.locator('#status').waitFor({ timeout: 1200 })
  } catch {
    throw new Error(`Edit record harness did not mount: ${errors.join(' | ') || 'no browser exception'}`)
  }
}

async function waitForRequest(page: import('@playwright/test').Page, id: string) {
  await page.waitForFunction(target =>
    window.pendingRequests.some(request => request.url.endsWith('/' + target) && !request.resolved && !request.aborted), id)
}

test('edit never exposes the table preview while the complete persisted record is loading', async ({ page }) => {
  await mount(page)
  await page.evaluate(() => {
    window.persistedA = { ok: true, data: {
      id: 'a', type: 'INCOME', amount: 100, amount_pen: 100, currency: 'PEN', exchange_rate: 1,
      description: 'Ingreso completo', transaction_date: '2026-10-04', category_id: 'category-1', source_account_id: 'account-1',
    } }
  })
  await page.locator('#open-a').click()
  await expect(page.locator('#status')).toHaveText('loading')
  await expect(page.locator('#skeleton')).toBeVisible()
  await expect(page.locator('#loaded')).toHaveCount(0)
  await waitForRequest(page, 'a')
  await page.evaluate(() => window.respond('a', window.persistedA))
  await expect(page.locator('#loaded')).toHaveAttribute('data-id', 'a')
  await expect(page.locator('#description')).toHaveText('Ingreso completo')
  await expect(page.locator('#amount')).toHaveText('100')
})

test('slow and out-of-order responses can only reveal the currently selected transaction', async ({ page }) => {
  await mount(page)
  await page.evaluate(() => {
    window.persistedA = { ok: true, data: {
      id: 'a', type: 'EXPENSE', amount: 100, amount_pen: 380, currency: 'USD', exchange_rate: 3.8,
      description: 'Registro anterior', transaction_date: '2026-10-04', category_id: 'category-1', source_account_id: 'account-1',
    } }
    window.persistedB = { ok: true, data: {
      id: 'b', type: 'EXPENSE', amount: 250, amount_pen: 950, currency: 'USD', exchange_rate: 3.8,
      description: 'Registro vigente', transaction_date: '2026-10-05', category_id: 'category-1', source_account_id: 'account-1',
    } }
  })
  await page.locator('#open-a').click()
  await waitForRequest(page, 'a')
  await page.waitForTimeout(300)
  await expect(page.locator('#skeleton')).toBeVisible()
  await expect(page.locator('#loaded')).toHaveCount(0)
  await page.locator('#open-b').click()
  await expect(page.locator('#status')).toHaveText('loading')
  await waitForRequest(page, 'b')
  await page.waitForTimeout(1000)
  await expect(page.locator('#skeleton')).toBeVisible()
  await expect(page.locator('#loaded')).toHaveCount(0)
  await page.evaluate(() => window.respond('b', window.persistedB))
  await expect(page.locator('#loaded')).toHaveAttribute('data-id', 'b')
  await expect(page.locator('#description')).toHaveText('Registro vigente')
  await page.evaluate(() => window.respond('a', window.persistedA))
  await expect(page.locator('#loaded')).toHaveAttribute('data-id', 'b')
  await expect(page.locator('#description')).toHaveText('Registro vigente')
})

test('edit load timeout fails closed without exposing partial data', async ({ page }) => {
  await mount(page)
  await page.evaluate(() => {
    const nativeSetTimeout = window.setTimeout.bind(window)
    window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) =>
      nativeSetTimeout(handler, timeout === 15_000 ? 25 : timeout, ...args)) as typeof window.setTimeout
  })
  await page.locator('#open-a').click()
  await waitForRequest(page, 'a')
  await expect(page.locator('#error')).toHaveText('La carga tardó demasiado. Intenta nuevamente.')
  await expect(page.locator('#loaded')).toHaveCount(0)
})

test('close aborts an unfinished request, exit completion clears it, and retry recovers from errors', async ({ page }) => {
  await mount(page)
  await page.evaluate(() => {
    window.persistedA = { ok: true, data: {
      id: 'a', type: 'EXPENSE', amount: 80, amount_pen: 304, currency: 'USD', exchange_rate: 3.8,
      description: 'Movimiento recuperado', transaction_date: '2026-10-06', category_id: 'category-1', source_account_id: 'account-1',
    } }
  })
  await page.locator('#open-a').click()
  await waitForRequest(page, 'a')
  await page.locator('#close').click()
  await page.evaluate(() => window.respond('a', window.persistedA))
  await expect(page.locator('#loaded')).toHaveCount(0)
  await page.locator('#exit-complete').click()
  await expect(page.locator('#status')).toHaveText('idle')

  await page.locator('#open-a').click()
  await waitForRequest(page, 'a')
  await page.evaluate(() => window.respond('a', { ok: false, error: { message: 'Error simulado de lectura.' } }, false))
  await expect(page.locator('#error')).toHaveText('Error simulado de lectura.')
  await page.locator('#retry').click()
  await expect(page.locator('#status')).toHaveText('loading')
  await waitForRequest(page, 'a')
  await page.evaluate(() => window.respond('a', window.persistedA))
  await expect(page.locator('#loaded')).toHaveAttribute('data-id', 'a')
  await expect(page.locator('#description')).toHaveText('Movimiento recuperado')
})

declare global {
  interface Window {
    pendingRequests: Array<{
      url: string
      options: RequestInit
      resolve: (response: unknown) => void
      reject: (reason?: unknown) => void
      aborted?: boolean
      resolved?: boolean
    }>
    respond: (id: string, payload: unknown, ok?: boolean) => void
    persistedA: unknown
    persistedB: unknown
  }
}
