import { expect, test } from '@playwright/test'
import { createServer, type Server } from 'node:http'
import { readFileSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { once } from 'node:events'
import * as ts from 'typescript'

declare global {
  interface Window {
    renderNavBadgesHook: (userId: string, initialData: Record<string, number>, copies?: number) => void
    triggerNavBadgesRevalidation: () => Promise<unknown>
    unhandledNavBadgeRejections: number
  }
}

const root = process.cwd()
let server: Server
let baseUrl: string

function transpile(filePath: string, replacements: Record<string, string> = {}) {
  let source = readFileSync(resolve(root, filePath), 'utf8')
    .replace(/^'use client'\s*/, '')

  for (const [from, to] of Object.entries(replacements)) {
    source = source.replaceAll(from, to)
  }

  return ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.React,
    },
  }).outputText
}

const reactShim = `
const React = window.React;
export default React;
export const createContext = React.createContext;
export const createElement = React.createElement;
export const useCallback = React.useCallback;
export const useContext = React.useContext;
export const useDebugValue = React.useDebugValue;
export const useEffect = React.useEffect;
export const useLayoutEffect = React.useLayoutEffect;
export const useMemo = React.useMemo;
export const useRef = React.useRef;
export const useState = React.useState;
export const useSyncExternalStore = React.useSyncExternalStore;
`

const syncExternalStoreShim = `
import React from 'react';
export const useSyncExternalStore = React.useSyncExternalStore;
`

const harness = `
import React from 'react';
import { useSWRConfig } from 'swr';
import { useNavBadges } from '/hook.mjs';
import { NavBadgesErrorNotice } from '/notice.mjs';

function BadgeConsumer({ userId, initialData }) {
  const { data, error, isValidating, retry } = useNavBadges(initialData, userId);
  const { mutate } = useSWRConfig();
  window.triggerNavBadgesRevalidation = () => mutate(['/api/dashboard/nav-badges', userId]);
  return React.createElement('section', { 'data-user': userId },
    React.createElement('output', { 'data-testid': 'counts' }, JSON.stringify(data)),
    React.createElement('output', { 'data-testid': 'validating' }, String(isValidating)),
    error ? React.createElement(NavBadgesErrorNotice, {
      isRetrying: isValidating,
      onRetry: retry,
    }) : null,
  );
}

window.renderNavBadgesHook = (userId, initialData, copies = 1) => ReactDOM.render(
  React.createElement(React.Fragment, null,
    ...Array.from({ length: copies }, (_, index) => React.createElement(BadgeConsumer, {
      key: index,
      userId,
      initialData,
    })),
  ),
  document.getElementById('root'),
);

window.addEventListener('unhandledrejection', event => {
  window.unhandledNavBadgeRejections += 1;
  event.preventDefault();
});
`

function sendModule(response: import('node:http').ServerResponse, body: string) {
  response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' })
  response.end(body)
}

test.beforeAll(async () => {
  const hook = transpile('lib/hooks/useNavBadges.ts', {
    "'@/lib/client/fetch-with-timeout'": "'/fetch-with-timeout.mjs'",
    "'@/lib/hooks/nav-badges-policy'": "'/nav-badges-policy.mjs'",
  })
  const fetchWithTimeout = transpile('lib/client/fetch-with-timeout.ts')
  const navBadgesPolicy = transpile('lib/hooks/nav-badges-policy.ts')
  const notice = transpile('components/layout/NavBadgesErrorNotice.tsx')

  server = createServer((request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname

    if (pathname === '/') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      response.end(`<!doctype html>
        <html><head>
          <script type="importmap">{"imports":{"react":"/react-shim.mjs","swr":"/node_modules/swr/dist/index/index.mjs","dequal/lite":"/node_modules/dequal/lite/index.mjs","use-sync-external-store/shim":"/use-sync-external-store-shim.mjs"}}</script>
          <script src="/node_modules/react/umd/react.development.js"></script>
          <script src="/node_modules/react-dom/umd/react-dom.development.js"></script>
        </head><body><main id="root"></main><script type="module" src="/harness.mjs"></script></body></html>`)
      return
    }

    if (pathname === '/react-shim.mjs') return sendModule(response, reactShim)
    if (pathname === '/use-sync-external-store-shim.mjs') return sendModule(response, syncExternalStoreShim)
    if (pathname === '/hook.mjs') return sendModule(response, hook)
    if (pathname === '/fetch-with-timeout.mjs') return sendModule(response, fetchWithTimeout)
    if (pathname === '/nav-badges-policy.mjs') return sendModule(response, navBadgesPolicy)
    if (pathname === '/notice.mjs') return sendModule(response, notice)
    if (pathname === '/harness.mjs') return sendModule(response, harness)

    if (pathname.startsWith('/node_modules/swr/') || pathname.startsWith('/node_modules/dequal/')) {
      const packageName = pathname.startsWith('/node_modules/swr/') ? 'swr' : 'dequal'
      const relativePath = pathname.slice(`/node_modules/${packageName}/`.length)
      const packageRoot = resolve(root, `node_modules/${packageName}`)
      const filePath = resolve(packageRoot, relativePath)
      if (!filePath.startsWith(`${packageRoot}${sep}`)) {
        response.writeHead(400).end()
        return
      }
      response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' })
      response.end(readFileSync(filePath))
      return
    }

    if (pathname.startsWith('/node_modules/react/') || pathname.startsWith('/node_modules/react-dom/')) {
      const filePath = resolve(root, `.${pathname}`)
      if (!filePath.startsWith(`${resolve(root, 'node_modules')}${sep}`)) {
        response.writeHead(400).end()
        return
      }
      response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' })
      response.end(readFileSync(filePath))
      return
    }

    response.writeHead(404).end()
  })

  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Test module server did not bind to a TCP port')
  baseUrl = `http://127.0.0.1:${address.port}`
})

test.afterAll(async () => {
  if (!server?.listening) return
  server.close()
  await once(server, 'close')
})

test('real SWR hook retains verified data on manual failure, recovers, dedupes and isolates users', async ({ page }) => {
  let apiRequests = 0
  await page.route('**/api/dashboard/nav-badges', async route => {
    apiRequests += 1

    if (apiRequests === 1) {
      await route.fulfill({ json: { ok: true, data: { credits: 2, alerts: 2 } } })
      return
    }

    if (apiRequests === 2 || apiRequests === 3) {
      await new Promise(resolveDelay => setTimeout(resolveDelay, 250))
      await route.fulfill({ status: 503, json: { ok: false } })
      return
    }

    if (apiRequests === 4) {
      await route.fulfill({ json: { ok: true, data: { credits: 5, alerts: 5 } } })
      return
    }

    await new Promise(resolveDelay => setTimeout(resolveDelay, 250))
    await route.fulfill({ json: { ok: true, data: { receivables: 3, alerts: 3 } } })
  })

  await page.goto(baseUrl)
  await page.evaluate(() => {
    window.unhandledNavBadgeRejections = 0
    window.renderNavBadgesHook('user-a', { credits: 9 }, 2)
  })

  const counts = page.getByTestId('counts').first()
  await expect(counts).toHaveText('{"credits":2,"alerts":2}')
  await expect.poll(() => apiRequests).toBe(1)
  await expect(page.getByTestId('counts')).toHaveCount(2)

  await page.evaluate(async () => {
    try {
      await window.triggerNavBadgesRevalidation()
    } catch {
      // The background revalidation is intentionally failing to surface SWR's error state.
    }
  })
  await expect.poll(() => apiRequests).toBe(2)

  const retryButtons = page.getByRole('button', { name: 'Reintentar verificación de indicadores de navegación' })
  await retryButtons.first().click()
  await expect(retryButtons.first()).toBeDisabled()
  await expect(retryButtons.first()).toHaveText('Verificando…')
  await expect.poll(() => apiRequests).toBe(3)
  await expect(page.getByRole('alert').first()).toContainText('No se pudieron verificar')
  await expect(counts).toHaveText('{"credits":2,"alerts":2}')
  await expect.poll(() => page.evaluate(() => window.unhandledNavBadgeRejections)).toBe(0)

  await retryButtons.first().click()
  await expect(counts).toHaveText('{"credits":5,"alerts":5}')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect.poll(() => apiRequests).toBe(4)

  await page.evaluate(() => window.renderNavBadgesHook('user-b', { payables: 4 }))
  await expect(page.getByTestId('counts')).toHaveText('{"payables":4}')
  await expect(page.getByTestId('counts')).not.toContainText('credits')
  await expect(page.getByTestId('counts')).toHaveText('{"receivables":3,"alerts":3}')
  await expect.poll(() => apiRequests).toBe(5)
})
