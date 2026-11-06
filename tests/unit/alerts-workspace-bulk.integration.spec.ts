import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

const reactPath = join(process.cwd(), 'node_modules/react/umd/react.development.js')
const reactDomPath = join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js')

interface FixtureAlert {
  id: string
  alert_type: string
  source_module: string
  source_record_id: string | null
  title: string
  message: string | null
  href: string | null
  is_read: boolean
  created_at: string
}

interface AlertTestWindow {
  React: typeof import('react')
  ReactDOM: typeof import('react-dom/client')
  __alertModules: Record<string, Record<string, unknown>>
  __toastEvents: Array<{ type: string; title: string; description?: string }>
}

function compileComponent(path: string, moduleId: string, exports: string[]) {
  const sourceFile = ts.createSourceFile(join(process.cwd(), path), readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const removals: Array<{ start: number; end: number }> = []
  const bindings: string[] = []

  sourceFile.statements.forEach(statement => {
    if (!ts.isImportDeclaration(statement)) return
    removals.push({ start: statement.getStart(sourceFile), end: statement.end })
    if (!statement.importClause || statement.importClause.isTypeOnly) return
    const specifier = (statement.moduleSpecifier as ts.StringLiteral).text
    const local = `__alertImport${bindings.length}`
    bindings.push(`const ${local} = window.__alertModules[${JSON.stringify(specifier)}] || {};`)
    const clause = statement.importClause
    if (clause.name) bindings.push(`const ${clause.name.text} = ${local}.default;`)
    if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) bindings.push(`const ${clause.namedBindings.name.text} = ${local};`)
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) clause.namedBindings.elements.filter(item => !item.isTypeOnly).forEach(item => {
      const imported = item.propertyName?.text ?? item.name.text
      bindings.push(`const ${item.name.text} = ${local}[${JSON.stringify(imported)}];`)
    })
  })

  let source = sourceFile.text
  removals.sort((a, b) => b.start - a.start).forEach(range => { source = `${source.slice(0, range.start)}${source.slice(range.end)}` })
  source = source.replace(/^'use client'\s*/, '').replace(/^export\s+(?=(?:async\s+)?(?:function|const|class|interface|type)\b)/gm, '')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React },
  }).outputText.replace(/^export\s*\{\s*\};?\s*$/gm, '')
  return `(() => { ${bindings.join('\n')}\n${compiled}\nwindow.__alertModules[${JSON.stringify(moduleId)}] = { ...(window.__alertModules[${JSON.stringify(moduleId)}] || {}), ${exports.join(', ')} }; })();`
}

function fixtureAlert(id: string, is_read: boolean): FixtureAlert {
  return {
    id,
    alert_type: 'OPERATIONAL',
    source_module: 'budgets',
    source_record_id: null,
    title: `Aviso ${id}`,
    message: 'Aviso sintético para validación aislada.',
    href: '/budgets',
    is_read,
    created_at: '2026-11-05T12:00:00.000Z',
  }
}

async function mountWorkspace(page: import('@playwright/test').Page, initial: FixtureAlert[], mode: { markPartial?: boolean; clearPartial?: boolean } = {}) {
  const alerts = [...initial]
  const requests: Array<{ method: string; pathname: string; scope: string | null }> = []
  page.on('pageerror', error => console.info('Alerts workspace browser error:', error.stack ?? error.message))

  await page.route('http://alerts.test/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    requests.push({ method, pathname: url.pathname, scope: url.searchParams.get('scope') })

    if (url.pathname === '/api/alerts' && method === 'GET') {
      const unread = alerts.filter(alert => !alert.is_read).length
      return route.fulfill({ json: { ok: true, data: alerts, counts: { total: alerts.length, unread } } })
    }
    if (url.pathname === '/api/alerts' && method === 'PATCH') {
      const unread = alerts.filter(alert => !alert.is_read)
      unread.forEach(alert => { alert.is_read = true })
      if (mode.markPartial) {
        alerts.push(fixtureAlert('concurrent-unread', false))
        return route.fulfill({ status: 409, json: { ok: false, error: { code: 'PARTIAL_OPERATION', message: 'Queda 1 aviso sin leer.' }, data: { updatedCount: unread.length, remainingUnreadCount: 1 } } })
      }
      return route.fulfill({ json: { ok: true, data: { updatedCount: unread.length, remainingUnreadCount: 0 } } })
    }
    if (url.pathname === '/api/alerts' && method === 'DELETE') {
      if (url.searchParams.get('scope') === 'all') {
        const deletedCount = alerts.length
        alerts.splice(0, alerts.length)
        if (mode.clearPartial) {
          alerts.push(fixtureAlert('concurrent-leftover', false))
          return route.fulfill({ status: 409, json: { ok: false, error: { code: 'PARTIAL_OPERATION', message: 'Queda 1 aviso.' }, data: { deletedCount, scope: 'all', remainingCount: 1 } } })
        }
        return route.fulfill({ json: { ok: true, data: { deletedCount, scope: 'all', remainingCount: 0 } } })
      }
      const read = alerts.filter(alert => alert.is_read)
      for (let index = alerts.length - 1; index >= 0; index -= 1) {
        const alert = alerts[index]
        if (alert?.is_read) alerts.splice(index, 1)
      }
      return route.fulfill({ json: { ok: true, data: { deletedCount: read.length, scope: 'read', remainingReadCount: 0 } } })
    }
    if (url.pathname.startsWith('/api/alerts/')) {
      return route.fulfill({ status: 500, json: { ok: false, error: { message: 'Unexpected per-record request.' } } })
    }
    return route.fulfill({ status: 404, json: { ok: false, error: { message: 'Not found.' } } })
  })

  await page.goto('http://alerts.test/alerts')
  await page.setContent('<main data-ft-v3-shell><div id="root"></div><div id="toast-log"></div></main>')
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: `
    window.React = React;
    window.__alertModules = { react: { default: React, ...React }, 'react-dom': { createPortal: ReactDOM.createPortal } };
    window.__toastEvents = [];
    const classProxy = new Proxy({}, { get: (_target, name) => String(name) });
    const noop = () => {};
    window.__alertModules['@/components/ui/AppSelect'] = { AppSelect: ({value,onChange,options,ariaLabel,testId}) => React.createElement('select',{value,onChange:event=>onChange(event.target.value),'aria-label':ariaLabel,'data-testid':testId},options.map(option=>React.createElement('option',{key:option.value,value:option.value},option.label))) };
    window.__alertModules['@/components/ui/Button'] = { Button: ({children,testId,ariaLabel,title,onClick,disabled,loading,leadingIcon,...props}) => React.createElement('button',{type:'button','data-testid':testId,'aria-label':ariaLabel,title,disabled:disabled||loading,onClick,...props},leadingIcon,children) };
    window.__alertModules['@/components/ui/CreateModuleButton'] = { CreateModuleButton: ({onClick,label,testId}) => React.createElement('button',{type:'button',onClick,'data-testid':testId},label) };
    window.__alertModules['@/components/ui/RecordModal'] = { RecordModal: ({open,title,children,testId}) => open ? React.createElement('div',{role:'dialog','aria-label':title,'data-testid':testId},children) : null };
    window.__alertModules['@/components/finance'] = {
      ConfirmDialog: ({open,title,message,onConfirm,onCancel,loading,confirmLabel,cancelLabel,testId}) => open ? React.createElement('div',{role:'dialog','aria-label':title,'data-testid':testId},React.createElement('h2',null,title),React.createElement('p',null,message),React.createElement('button',{type:'button',onClick:onCancel,disabled:loading},cancelLabel||'Cancelar'),React.createElement('button',{type:'button',onClick:onConfirm,disabled:loading},confirmLabel||'Confirmar')) : null,
      DataErrorBanner: ({message,onRetry}) => React.createElement('div',{role:'alert'},message,React.createElement('button',{onClick:onRetry},'Reintentar')),
      DataSearchField: ({value,onChange,placeholder,...props}) => React.createElement('input',{value,onChange:event=>onChange(event.target.value),placeholder,...props}),
      EmptyState: ({title,description,action}) => React.createElement('div',null,React.createElement('p',null,title),React.createElement('p',null,description),action),
      PageLayout: ({children}) => React.createElement('div',null,children),
    };
    window.__alertModules['@/components/forms/primitives'] = {
      FormActions: ({secondaryAction,primaryAction}) => React.createElement('div',null,secondaryAction,primaryAction),
      FormField: ({label,children}) => React.createElement('label',null,label,children),
      FormSection: ({title,children}) => React.createElement('section',null,React.createElement('h2',null,title),children),
    };
    window.__alertModules['@/components/tables/TransactionsRound07.module.css'] = { default: classProxy };
    window.__alertModules['@/lib/api/error-message'] = { getApiErrorMessage: (json,fallback) => json?.error?.message || fallback };
    window.__alertModules['@/lib/client/fetch-with-timeout'] = { fetchWithTimeout: (url,options) => window.fetch(url,options) };
    window.__alertModules['@/lib/toast/toast'] = { useToast: () => ({ toast: {
      success: (title,description) => window.__toastEvents.push({type:'success',title,description}),
      error: (title,description) => window.__toastEvents.push({type:'error',title,description}),
    } }) };
    window.__alertModules['./AlertFilters'] = { AlertFilters: () => null };
    window.__alertModules['./AlertBadge'] = { moduleLabel: module => module === 'budgets' ? 'Presupuestos' : module, alertLabel: value => value };
    window.__alertModules['./AlertsWorkspace.module.css'] = { default: classProxy };
    window.__alertModules['./AlertCard'] = { AlertCard: ({id,title,is_read,busy,onToggleRead,actions}) => React.createElement('article',{'data-testid':'alert-row-'+id},React.createElement('h3',null,title),React.createElement('button',{type:'button',disabled:busy,onClick:()=>onToggleRead(id,!is_read)},is_read?'Marcar no leído':'Marcar leído'),actions.map(action=>React.createElement('button',{key:action.id,type:'button',disabled:action.disabled,onClick:action.onSelect},action.label))) };
  ` })

  const presentation = compileComponent('components/alerts/alerts-presentation.ts', './alerts-presentation', ['filterAlertRows', 'isValidAlertHref'])
  await page.addScriptTag({ content: presentation })
  const compiled = compileComponent('components/alerts/AlertsWorkspace.tsx', '@/components/alerts/AlertsWorkspace', ['AlertsWorkspace'])
  await page.addScriptTag({ content: compiled })
  await page.evaluate(() => {
    const browser = window as unknown as AlertTestWindow
    const workspace = browser.__alertModules['@/components/alerts/AlertsWorkspace']?.AlertsWorkspace as import('react').ComponentType
    browser.ReactDOM.createRoot(document.getElementById('root')!).render(
      browser.React.createElement(workspace),
    )
  })

  const firstVisibleUnread = initial.find(alert => !alert.is_read)
  if (firstVisibleUnread) await expect(page.getByTestId(`alert-row-${firstVisibleUnread.id}`)).toBeVisible()
  else await expect(page.getByText('No hay avisos sin leer.')).toBeVisible()

  return { requests, alerts }
}

test.describe('AlertsWorkspace bulk actions', () => {
  test('mark all read uses one account-level PATCH and refresh only reloads the inbox', async ({ page }) => {
    const { requests } = await mountWorkspace(page, [fixtureAlert('unread-a', false), fixtureAlert('unread-b', false), fixtureAlert('read-a', true)])

    await page.getByTestId('alerts-mark-all-read-button').click()
    await page.getByRole('button', { name: /Leídos/ }).click()
    await expect(page.getByTestId('alert-row-unread-a').getByRole('button', { name: 'Marcar no leído' })).toBeVisible()
    const patchRequests = requests.filter(request => request.method === 'PATCH' && request.pathname === '/api/alerts')
    expect(patchRequests).toHaveLength(1)
    expect(requests.some(request => request.pathname.startsWith('/api/alerts/'))).toBe(false)
    expect(requests.some(request => request.pathname === '/api/alerts/generate' || request.method === 'POST')).toBe(false)

    const beforeRefresh = requests.length
    await page.getByTestId('alerts-refresh-button').click()
    await expect.poll(() => page.evaluate(() => (window as unknown as AlertTestWindow).__toastEvents.filter(event => event.title === 'Bandeja actualizada').length)).toBe(1)
    expect(requests.slice(beforeRefresh)).toEqual([{ method: 'GET', pathname: '/api/alerts', scope: null }])
    expect(requests.some(request => request.pathname === '/api/alerts/generate')).toBe(false)
  })

  test('Vaciar bandeja requires explicit confirmation, cancels safely, and reports success only after a verified empty reload', async ({ page }) => {
    const { requests } = await mountWorkspace(page, [fixtureAlert('unread-a', false), fixtureAlert('read-a', true)])

    await page.getByTestId('alerts-clear-inbox-button').click()
    const dialog = page.getByTestId('alerts-clear-inbox-confirmation')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('permanentemente')
    await expect(dialog).toContainText('historial informativo')
    await expect(dialog).toContainText('no se puede deshacer')
    await expect(dialog).toContainText('movimientos')
    await dialog.getByRole('button', { name: 'Conservar avisos' }).click()
    expect(requests.some(request => request.method === 'DELETE')).toBe(false)

    await page.getByTestId('alerts-clear-inbox-button').click()
    await page.getByTestId('alerts-clear-inbox-confirmation').getByRole('button', { name: 'Vaciar bandeja' }).click()
    await expect(page.getByText('No hay avisos sin leer.')).toBeVisible()
    await expect.poll(() => page.evaluate(() => (window as unknown as AlertTestWindow).__toastEvents.some(event => event.type === 'success' && event.title === 'Bandeja vacía'))).toBe(true)
    expect(requests.filter(request => request.method === 'DELETE')).toEqual([{ method: 'DELETE', pathname: '/api/alerts', scope: 'all' }])
    expect(requests.some(request => /transactions|receivables|payables|credits/.test(request.pathname))).toBe(false)
  })

  test('partial deletion refreshes state and never shows a successful empty result', async ({ page }) => {
    const { requests } = await mountWorkspace(page, [fixtureAlert('unread-a', false), fixtureAlert('read-a', true)], { clearPartial: true })

    await page.getByTestId('alerts-clear-inbox-button').click()
    await page.getByTestId('alerts-clear-inbox-confirmation').getByRole('button', { name: 'Vaciar bandeja' }).click()
    await expect(page.getByTestId('alert-row-concurrent-leftover')).toBeVisible()
    await expect.poll(() => page.evaluate(() => (window as unknown as AlertTestWindow).__toastEvents.some(event => event.type === 'error' && event.title === 'No se pudo vaciar la bandeja'))).toBe(true)
    expect(await page.evaluate(() => (window as unknown as AlertTestWindow).__toastEvents.some(event => event.type === 'success' && event.title === 'Bandeja vacía'))).toBe(false)
    expect(requests.filter(request => request.method === 'DELETE')).toHaveLength(1)
    expect(requests.filter(request => request.method === 'GET' && request.pathname === '/api/alerts')).toHaveLength(2)
  })

  test('partial mark-all-read reloads authoritative unread counts and does not report full success', async ({ page }) => {
    const { requests } = await mountWorkspace(page, [fixtureAlert('unread-a', false)], { markPartial: true })

    await page.getByTestId('alerts-mark-all-read-button').click()
    await expect(page.getByTestId('alert-row-concurrent-unread')).toBeVisible()
    await expect.poll(() => page.evaluate(() => (window as unknown as AlertTestWindow).__toastEvents.some(event => event.type === 'error' && event.title === 'No se pudieron marcar todos como leídos'))).toBe(true)
    expect(await page.evaluate(() => (window as unknown as AlertTestWindow).__toastEvents.some(event => event.type === 'success' && event.title.includes('marcado(s) como leídos')))).toBe(false)
    expect(requests.filter(request => request.method === 'PATCH' && request.pathname === '/api/alerts')).toHaveLength(1)
    expect(requests.some(request => request.pathname.startsWith('/api/alerts/'))).toBe(false)
  })
})
