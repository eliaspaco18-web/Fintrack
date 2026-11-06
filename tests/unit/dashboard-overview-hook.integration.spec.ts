import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

const reactPath = join(process.cwd(), 'node_modules/react/umd/react.development.js')
const reactDomPath = join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js')

function compileModule(file: string, moduleName: string, exportNames: string[]) {
  const filePath = join(process.cwd(), file)
  const sourceFile = ts.createSourceFile(filePath, readFileSync(filePath, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const removals: Array<{ start: number; end: number }> = []
  const bindings: string[] = []

  sourceFile.statements.forEach(statement => {
    if (!ts.isImportDeclaration(statement)) return
    removals.push({ start: statement.getStart(sourceFile), end: statement.end })
    if (!statement.importClause || statement.importClause.isTypeOnly) return
    const specifier = (statement.moduleSpecifier as ts.StringLiteral).text
    const local = `__dashboardImport${bindings.length}`
    bindings.push(`const ${local} = window.__dashboardModules[${JSON.stringify(specifier)}] || {};`)
    const clause = statement.importClause
    if (clause.name) bindings.push(`const ${clause.name.text} = ${local}.default;`)
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      clause.namedBindings.elements.filter(item => !item.isTypeOnly).forEach(item => {
        const imported = item.propertyName?.text ?? item.name.text
        bindings.push(`const ${item.name.text} = ${local}[${JSON.stringify(imported)}];`)
      })
    }
  })

  let source = sourceFile.text
  removals.sort((a, b) => b.start - a.start).forEach(range => {
    source = `${source.slice(0, range.start)}${source.slice(range.end)}`
  })
  source = source.replace(/^'use client'\s*/, '').replace(/\bexport\s+(?=(?:async\s+)?(?:function|const|class|interface|type)\b)/g, '')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText.replace(/^export\s*\{\s*\};?\s*$/gm, '')
  const exposed = exportNames.map(name => `window.__dashboardModules[${JSON.stringify(moduleName)}][${JSON.stringify(name)}] = ${name};`).join('\n')
  return `(() => { window.__dashboardModules[${JSON.stringify(moduleName)}] = window.__dashboardModules[${JSON.stringify(moduleName)}] || {}; ${bindings.join('\n')}\n${compiled}\n${exposed}\n})();`
}

async function mountDashboardHook(page: Page) {
  await page.setContent('<main id="root"></main>')
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: `
    window.__dashboardModules = {};
    window.__dashboardCache = new Map();
    window.__dashboardListeners = new Map();
    window.__dashboardAuthListeners = new Set();
    window.__dashboardSessionUserId = 'user-a';
    window.__dashboardPath = '/dashboard';
    window.__dashboardPlans = [{ summary: { income: 100 }, sidebar: { label: 'initial' } }];
    window.__dashboardFetchCalls = [];
    const React = window.React;
    const notifyCache = key => (window.__dashboardListeners.get(key) || new Set()).forEach(listener => listener());
    const cacheMutate = async (key, value) => { window.__dashboardCache.set(key, value); notifyCache(key); return value; };
    function useSWR(key) {
      const currentKey = typeof key === 'string' ? key : null;
      const subscribe = React.useCallback(listener => {
        if (!currentKey) return () => {};
        let listeners = window.__dashboardListeners.get(currentKey);
        if (!listeners) { listeners = new Set(); window.__dashboardListeners.set(currentKey, listeners); }
        listeners.add(listener);
        return () => listeners.delete(listener);
      }, [currentKey]);
      const getSnapshot = React.useCallback(() => currentKey ? window.__dashboardCache.get(currentKey) : undefined, [currentKey]);
      return { data: React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot), error: undefined, isLoading: false, mutate: async () => undefined };
    }
    const pathnameListeners = new Set();
    window.__dashboardModules['swr'] = { default: useSWR, useSWRConfig: () => ({ cache: window.__dashboardCache, mutate: cacheMutate }) };
    window.__dashboardModules['react'] = { default: React, useCallback: React.useCallback, useEffect: React.useEffect, useRef: React.useRef, useState: React.useState };
    window.__dashboardModules['next/navigation'] = { usePathname: () => React.useSyncExternalStore(listener => { pathnameListeners.add(listener); return () => pathnameListeners.delete(listener); }, () => window.__dashboardPath, () => '/dashboard') };
    window.__dashboardModules['@/lib/supabase.client'] = { createClient: () => ({ auth: {
      getSession: async () => ({ data: { session: window.__dashboardSessionUserId ? { user: { id: window.__dashboardSessionUserId } } : null }, error: null }),
      onAuthStateChange: callback => { window.__dashboardAuthListeners.add(callback); return { data: { subscription: { unsubscribe: () => window.__dashboardAuthListeners.delete(callback) } } }; },
    } }) };
    window.__dashboardSetPath = path => { window.__dashboardPath = path; pathnameListeners.forEach(listener => listener()); };
    window.__dashboardSetUser = userId => { window.__dashboardSessionUserId = userId; for (const listener of [...window.__dashboardAuthListeners]) listener(userId ? 'SIGNED_IN' : 'SIGNED_OUT', userId ? { user: { id: userId } } : null); };
    window.__dashboardQueue = plan => window.__dashboardPlans.push(plan);
    window.__dashboardFetch = (url, options = {}) => {
      const plan = window.__dashboardPlans.shift() || { summary: { income: 10 }, sidebar: { label: 'default' } };
      window.__dashboardFetchCalls.push({ url: String(url), userId: window.__dashboardSessionUserId, aborted: false });
      const call = window.__dashboardFetchCalls.at(-1);
      return Promise.resolve(new Response(new ReadableStream({
        start(controller) {
          const timers = [];
          let done = false;
          const send = value => { if (!done) controller.enqueue(new TextEncoder().encode(JSON.stringify(value) + '\\n')); };
          const summary = { source: 'summary', data: plan.summary ?? null, error: plan.summaryError ?? null };
          const sidebar = plan.sidebarError
            ? { source: 'sidebar', data: null, error: { code: 'DATABASE_ERROR', message: plan.sidebarError } }
            : { source: 'sidebar', data: plan.sidebar ?? null, error: null };
          timers.push(setTimeout(() => send(summary), plan.summaryDelay ?? 5));
          timers.push(setTimeout(() => {
            send(sidebar);
            const closeStream = () => { done = true; controller.close(); };
            if (plan.tailDelay) timers.push(setTimeout(closeStream, plan.tailDelay));
            else closeStream();
          }, plan.sidebarDelay ?? 15));
          options.signal?.addEventListener('abort', () => {
            call.aborted = true;
            done = true;
            timers.forEach(clearTimeout);
            try { controller.error(new DOMException('Aborted', 'AbortError')); } catch {}
          }, { once: true });
        },
      }), { status: 200, headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' } }));
    };
    window.fetch = window.__dashboardFetch;
  ` })
  await page.addScriptTag({ content: compileModule('lib/dashboard/overview-stream.ts', '@/lib/dashboard/overview-stream', ['consumeDashboardOverviewStream']) })
  await page.addScriptTag({ content: compileModule('components/dashboard/useDashboardOverview.ts', '@/components/dashboard/useDashboardOverview', ['useDashboardOverview']) })
  await page.addScriptTag({ content: `
    function DashboardHookHarness() {
      const overview = window.__dashboardModules['@/components/dashboard/useDashboardOverview'].useDashboardOverview('2026-11');
      return React.createElement('section', null,
        React.createElement('output', { id: 'summary', 'data-loading': String(overview.summary.isLoading), 'data-error': overview.summary.error?.message || '' }, JSON.stringify(overview.summary.data ?? null)),
        React.createElement('output', { id: 'sidebar', 'data-loading': String(overview.sidebar.isLoading), 'data-error': overview.sidebar.error?.message || '' }, JSON.stringify(overview.sidebar.data ?? null)),
        React.createElement('button', { id: 'retry', onClick: () => void overview.mutate() }, 'Reintentar'));
    }
    window.__dashboardRoot = ReactDOM.createRoot(document.getElementById('root'));
    window.__dashboardRoot.render(React.createElement(React.StrictMode, null, React.createElement(DashboardHookHarness)));
  ` })
}

test('real Dashboard hook revalidates on return, deduplicates navigation loads, retries partial failures, and scopes cache to the session', async ({ page }) => {
  await mountDashboardHook(page)

  await expect(page.locator('#summary')).toContainText('100')
  await expect(page.locator('#sidebar')).toContainText('initial')
  await expect.poll(() => page.evaluate(() => (window as any).__dashboardFetchCalls.length)).toBe(1)
  expect(await page.evaluate(() => (window as any).__dashboardFetchCalls[0].url)).toBe('/api/dashboard/overview?period=2026-11')

  // Represents a saved movement followed by navigating away and back to Inicio.
  await page.evaluate(() => { (window as any).__dashboardQueue({ summary: { income: 250 }, sidebar: { label: 'after movement' } }); (window as any).__dashboardSetPath('/transactions') })
  await page.waitForTimeout(5)
  await page.evaluate(() => (window as any).__dashboardSetPath('/dashboard'))
  await expect(page.locator('#summary')).toContainText('250')
  await expect(page.locator('#sidebar')).toContainText('after movement')
  await expect.poll(() => page.evaluate(() => (window as any).__dashboardFetchCalls.length)).toBe(2)

  await page.evaluate(() => { (window as any).__dashboardQueue({ summary: { income: 260 }, sidebar: { label: 'repeat visit' } }); (window as any).__dashboardSetPath('/budgets') })
  await page.waitForTimeout(5)
  await page.evaluate(() => (window as any).__dashboardSetPath('/dashboard'))
  await expect(page.locator('#summary')).toContainText('260')
  await expect(page.locator('#sidebar')).toContainText('repeat visit')
  await expect.poll(() => page.evaluate(() => (window as any).__dashboardFetchCalls.length)).toBe(3)

  await page.evaluate(() => { (window as any).__dashboardQueue({ summary: { income: 400 }, sidebarError: 'No se pudo consultar el resumen lateral.', tailDelay: 120 }); (window as any).__dashboardSetPath('/transactions') })
  await page.waitForTimeout(5)
  await page.evaluate(() => (window as any).__dashboardSetPath('/dashboard'))
  await expect(page.locator('#summary')).toContainText('400')
  await expect(page.locator('#sidebar')).toHaveAttribute('data-error', 'No se pudo consultar el resumen lateral.')
  await page.evaluate(() => (window as any).__dashboardQueue({ summary: { income: 500 }, sidebar: { label: 'retry recovered' } }))
  await page.locator('#retry').click()
  await expect(page.locator('#summary')).toContainText('500')
  await expect(page.locator('#sidebar')).toContainText('retry recovered')
  await expect(page.locator('#sidebar')).toHaveAttribute('data-error', '')
  await expect.poll(() => page.evaluate(() => (window as any).__dashboardFetchCalls.length)).toBe(5)

  await page.evaluate(() => { (window as any).__dashboardQueue({ summary: { income: 900 }, sidebar: { label: 'user b' } }); (window as any).__dashboardSetUser('user-b') })
  await expect(page.locator('#summary')).toContainText('900')
  await expect(page.locator('#sidebar')).toContainText('user b')
  const userScopedCache = await page.evaluate(() => Array.from((window as any).__dashboardCache.keys(), String).filter(key => key.includes(':user=')))
  expect(userScopedCache.some((key: string) => key.includes(':user=user-a:summary'))).toBe(true)
  expect(userScopedCache.some((key: string) => key.includes(':user=user-b:summary'))).toBe(true)
  expect(await page.evaluate(() => (window as any).__dashboardFetchCalls.at(-1).userId)).toBe('user-b')

  await page.evaluate(() => (window as any).__dashboardSetUser(null))
  await expect(page.locator('#summary')).toHaveText('null')
  await expect(page.locator('#sidebar')).toHaveText('null')
  expect(await page.evaluate(() => (window as any).__dashboardFetchCalls.length)).toBe(6)
})
