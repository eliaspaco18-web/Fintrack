import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

declare global {
  interface Window {
    __fintrackModules: Record<string, any>
    __fintrackExports: Record<string, any>
    __fintrackOptions: unknown
    __fintrackQuickOperations: Record<string, unknown>
    __fintrackFormOrchestrator: Record<string, unknown>
    __fintrackFallbackOptions: unknown
    __unexpectedSupabaseCalls: number
    __serverOptionLoad: { delayMs: number; fail: boolean }
    __navigateMock?: (path: string) => void
    __mountAssetsWorkspace?: () => void
    __routeDebug?: { path: string; search: string }
  }
}

const reactPath = join(process.cwd(), 'node_modules/react/umd/react.development.js')
const reactDomPath = join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js')
const reactHookFormPath = join(process.cwd(), 'node_modules/react-hook-form/dist/index.umd.js')

function compileComponent(file: string, exportName: string, exportedName: string, extraExports: string[] = []): string {
  const filePath = join(process.cwd(), file)
  const sourceText = readFileSync(filePath, 'utf8')
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const removals: Array<{ start: number; end: number }> = []
  const bindings: string[] = []

  sourceFile.statements.forEach(statement => {
    if (ts.isImportDeclaration(statement)) {
      removals.push({ start: statement.getStart(sourceFile), end: statement.end })
      if (statement.importClause?.isTypeOnly) return
      const specifier = (statement.moduleSpecifier as ts.StringLiteral).text
      const moduleName = `__module${bindings.length}`
      bindings.push(`const ${moduleName} = window.__fintrackModules[${JSON.stringify(specifier)}];`)
      const clause = statement.importClause
      if (!clause) return
      if (clause.name) bindings.push(`const ${clause.name.text} = ${moduleName}.default;`)
      if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
        bindings.push(`const ${clause.namedBindings.name.text} = ${moduleName};`)
      } else if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        clause.namedBindings.elements.filter(item => !item.isTypeOnly).forEach(item => {
          const imported = item.propertyName?.text ?? item.name.text
          bindings.push(`const ${item.name.text} = ${moduleName}[${JSON.stringify(imported)}];`)
        })
      }
    }
    if (ts.isExportDeclaration(statement)) removals.push({ start: statement.getStart(sourceFile), end: statement.end })
  })

  let source = sourceText
  removals.sort((a, b) => b.start - a.start).forEach(range => {
    source = `${source.slice(0, range.start)}${source.slice(range.end)}`
  })
  source = source
    .replace(/^'use client'\s*/, '')
    .replace(/\bexport\s+(?=(?:async\s+)?(?:function|const|class|interface|type)\b)/g, '')
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.None,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
    },
  }).outputText
  const reactBinding = bindings.some(binding => /const React\s*=/.test(binding)) ? '' : 'const React = window.React;'
  const exposed = [exportedName, ...extraExports].map(name => `window.__fintrackExports[${JSON.stringify(name)}] = ${name};`).join('\n')
  return `(() => { ${bindings.join('\n')}\n${reactBinding}\n${compiled}\nwindow.__fintrackExports[${JSON.stringify(exportName)}] = ${exportedName};\n${exposed}\n})();`
}

function browserMocks(): string {
  return `
    window.__fintrackModules = {};
    window.__fintrackExports = {};
    const React = window.React;
    const ReactDOM = window.ReactDOM;
    const noop = () => {};
    const moduleProxy = new Proxy({}, { get: (_target, key) => String(key) });
    const router = {
      push(path) { history.pushState({}, '', path); window.dispatchEvent(new Event('popstate')); window.__navigateMock?.(path); },
      replace(path) { history.replaceState({}, '', path); window.dispatchEvent(new Event('popstate')); },
      refresh() {},
    };
    const subscribe = callback => { window.addEventListener('popstate', callback); return () => window.removeEventListener('popstate', callback); };
    window.__fintrackModules['react'] = { default: React, ...React };
    window.__fintrackModules['react-dom'] = { default: ReactDOM, createPortal: ReactDOM.createPortal };
    window.__fintrackModules['react-hook-form'] = window.ReactHookForm;
    window.__fintrackModules['zod'] = { z: {} };
    window.__fintrackModules['@/lib/schemas/transaction.schemas'] = { zCreateTransactionSchema: {} };
    window.__fintrackModules['next/link'] = { default: ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children) };
    window.__fintrackModules['next/dynamic'] = { default: () => () => null };
    window.__fintrackModules['next/navigation'] = {
      useRouter: () => router,
      usePathname: () => React.useSyncExternalStore(subscribe, () => location.pathname, () => '/dashboard'),
      useSearchParams: () => {
        const search = React.useSyncExternalStore(subscribe, () => location.search, () => '');
        return React.useMemo(() => new URLSearchParams(search), [search]);
      },
    };
    const summary = { ingresos_mes: 120, egresos_mes: 45, resultado_mensual: 75 };
    window.__fintrackModules['swr'] = {
      default: key => {
        let data = [];
        if (typeof key === 'string' && key.includes('/dashboard/summary')) data = summary;
        else if (typeof key === 'string' && key.includes('/dashboard/money-flow')) data = { series: [] };
        else if (typeof key === 'string' && key.includes('/dashboard/sidebar')) data = { ingresos_categoria: [], egresos_categoria: [] };
        else if (typeof key === 'string' && key.includes('/transactions?')) data = { data: [], pagination: { has_more: false } };
        return { data, error: undefined, isLoading: false, mutate: async () => data };
      },
      mutate: async () => undefined,
    };
    window.__fintrackModules['@/components/finance/charts/BudgetProgressRow'] = { BudgetProgressRow: () => null };
    window.__fintrackModules['@/components/finance/charts/CategoryRanking'] = { CategoryRanking: () => null };
    window.__fintrackModules['@/components/finance/charts/MonthlyFlowBars'] = { MonthlyFlowBars: () => null, MonthlyFlowDataTable: () => null };
    window.__fintrackModules['@/components/finance/MoneyText'] = { MoneyText: ({ value }) => React.createElement('span', null, String(value ?? '')) };
    window.__fintrackModules['@/components/finance/PositionBand'] = { PositionBand: () => null };
    window.__fintrackModules['@/components/ui/accessibility'] = { FocusTrap: ({ children, className }) => React.createElement('div', { className }, children) };
    window.__fintrackModules['@/components/ui/ModalOverlayPortal'] = { ModalOverlayPortal: ({ children }) => children };
    window.__fintrackModules['@/components/ui/CreateModuleButton'] = {
      CreateModuleButton: ({ onClick, label, testId, ...props }) => React.createElement('button', { type: 'button', onClick, 'data-testid': testId, ...props }, label),
    };
    window.__fintrackModules['@/components/tables/TransactionsRound07.module.css'] = { default: moduleProxy };
    window.__fintrackModules['@/components/dashboard/DashboardRound07.module.css'] = { default: moduleProxy };
    window.__fintrackModules['./DashboardRound07.module.css'] = window.__fintrackModules['@/components/dashboard/DashboardRound07.module.css'];
    window.__fintrackModules['@/components/forms/TransactionForm/IncomeTransactionForm.module.css'] = { default: moduleProxy };
    window.__fintrackModules['./IncomeTransactionForm.module.css'] = window.__fintrackModules['@/components/forms/TransactionForm/IncomeTransactionForm.module.css'];
    window.__fintrackModules['@/components/tables/TransactionTable'] = {
      TransactionTable: ({ workspaceHeader, toolbarActions }) => React.createElement('div', { 'data-testid': 'transaction-table-stub' }, workspaceHeader, toolbarActions),
    };
    window.__fintrackModules['@/components/assets/AssetsListPanel'] = {
      AssetsListPanel: ({ onCreate }) => React.createElement('button', { type: 'button', 'data-testid': 'assets-create-button', onClick: onCreate }, 'Registrar activo'),
    };
    window.__fintrackModules['@/lib/constants/quick-operations'] = window.__fintrackQuickOperations;
    window.__fintrackModules['@/lib/dashboard/round07'] = {
      currentLimaPeriod: () => ({ iso: '2026-10-18', month: '2026-10', day: '18' }),
      documentedAgenda: () => [], documentedPending: () => ({ amounts: [], unverified: 0, count: 0 }),
      nativeAccountPosition: () => ({ amounts: [], count: 0 }),
    };
    window.__fintrackModules['@/lib/dashboard/types'] = {};
    window.__fintrackModules['@/lib/credits/display-type'] = {};
    window.__fintrackModules['@/modules/credits/credit-detail-presentation'] = { getCreditDetailPresentation: () => ({ availability: {}, currency: 'PEN' }) };
    window.__fintrackModules['@/lib/finance/v3-money-display'] = { formatV3Money: ({ value }) => ({ text: String(value ?? 0) }) };
    window.__fintrackModules['@/components/dashboard/api'] = { fetchDashboardData: async () => ({}) };
    window.__fintrackModules['./api'] = window.__fintrackModules['@/components/dashboard/api'];
    window.__fintrackModules['@/lib/toast/toast'] = { useToast: () => ({ toast: { success: noop, warning: noop, error: noop } }) };
    window.__fintrackModules['@/lib/ui/v3-modal-background'] = { acquireV3ModalBackground: () => () => {} };
    window.__fintrackModules['@/lib/contracts/ui.contracts'] = {
      formatCurrency: (value, currency) => (currency === 'USD' ? '$' : 'S/') + Number(value ?? 0).toFixed(2),
      formatNumber: value => String(value ?? ''),
    };
    window.__fintrackModules['@/lib/hooks/useDashboard'] = { useCurrency: () => ({ exchangeRate: 3.7 }) };
    window.__fintrackModules['@/components/forms/TransactionForm/TypeSelector'] = {
      TypeSelector: () => null,
      TYPE_CONFIG: {
        INCOME: { accentColor: '#2b7356' }, EXPENSE: { accentColor: '#ad4545' }, TRANSFER: { accentColor: '#426f9f' },
      },
    };
    window.__fintrackModules['./TypeSelector'] = window.__fintrackModules['@/components/forms/TransactionForm/TypeSelector'];
    const FieldWrapper = ({ label, children, error, hint, description }) => React.createElement('div', null,
      label ? React.createElement('label', null, label) : null, hint ? React.createElement('small', null, hint) : null,
      description ? React.createElement('small', null, description) : null, children,
      error ? React.createElement('span', { role: 'alert' }, error) : null);
    const Input = React.forwardRef((props, ref) => React.createElement('input', { ...props, ref, 'aria-label': props['aria-label'] ?? props.label }));
    const Select = props => React.createElement('select', { ...props, 'aria-label': props['aria-label'] ?? props.label }, props.children);
    const Textarea = React.forwardRef((props, ref) => React.createElement('textarea', { ...props, ref, 'aria-label': props['aria-label'] ?? props.label }));
    const AmountInput = props => React.createElement('input', { ...props, 'aria-label': props['aria-label'] ?? props.label, inputMode: 'decimal' });
    const CheckboxToggle = ({ label, ...props }) => React.createElement('label', null, label, React.createElement('input', { type: 'checkbox', ...props }));
    const InlineFeedback = ({ message, detail }) => React.createElement('div', null, message, detail ? React.createElement('small', null, detail) : null);
    const SectionDivider = ({ title }) => React.createElement('h3', null, title);
    window.__fintrackModules['./FormFields'] = { FieldWrapper, Input, Select, Textarea, AmountInput, CheckboxToggle, InlineFeedback, SectionDivider };
    window.__fintrackModules['@/components/forms/TransactionForm/sections/ModuleSections'] = {
      AssetSection: () => null, ReceivableSection: () => null, PayableSection: () => null, ModuleTriggerHint: () => null,
    };
    window.__fintrackModules['./sections/ModuleSections'] = window.__fintrackModules['@/components/forms/TransactionForm/sections/ModuleSections'];
    window.__fintrackModules['./SubmitButton'] = {
      SubmitButton: ({ labels }) => React.createElement('button', { type: 'submit' }, labels?.idle ?? 'Registrar'),
      SuccessSummary: () => null,
    };
    window.__fintrackModules['@/lib/constants/category-keys'] = {
      CategoryKeys: new Proxy({}, { get: (_target, key) => String(key) }), getModuleTrigger: () => null,
    };
    window.__fintrackModules['@/modules/transactions/credit-card-transfer-policy'] = { getCreditCardTransferPolicy: () => ({ violation: null }) };
    window.__fintrackModules['@/lib/api/error-message'] = { getApiErrorMessage: () => 'Error' };
    window.__fintrackModules['@/lib/utils/numeric-input'] = {
      hasAtMostDecimals: () => true, parseNumericInput: value => Number(value), roundToDecimals: (value, places) => Number(Number(value).toFixed(places)),
    };
    window.__fintrackModules['@/components/ui/Button'] = {
      Button: ({ children, onClick, type = 'button', testId, ariaLabel, ...props }) => React.createElement('button', { type, onClick, 'data-testid': testId, 'aria-label': ariaLabel, ...props }, children),
    };
    window.__fintrackModules['@/components/forms/primitives'] = {
      FormActions: ({ secondaryAction, primaryAction, className }) => React.createElement('div', { className }, secondaryAction, primaryAction),
      OptionalSection: ({ children, title }) => React.createElement('section', null, title, children),
    };
    window.__fintrackModules['@/components/ui/RecordModal'] = { RecordModalFooter: ({ children }) => children };
    window.__fintrackModules['@/app/actions/transaction.actions'] = { updateTransactionAction: async () => ({ ok: false }) };
    window.__fintrackModules['./form.orchestrator'] = window.__fintrackFormOrchestrator;
    window.__fintrackModules['@/components/forms/transaction-edit-presentation'] = { getTransactionEditPresentation: () => ({ blocked: false }) };
    window.__fintrackModules['./NestedRecordCreationModals'] = { NestedAccountCreateModal: () => null, NestedCategoryCreateModal: () => null };
    window.__fintrackModules['@/components/finance'] = { StatusBadge: () => null };
    window.__fintrackModules['@/components/forms/TransactionForm/IncomeDatePicker'] = { IncomeDatePicker: props => React.createElement('input', { ...props, type: 'date', 'aria-label': props.inputLabel ?? 'Fecha' }) };
    window.__fintrackModules['./IncomeDatePicker'] = window.__fintrackModules['@/components/forms/TransactionForm/IncomeDatePicker'];
    window.__fintrackModules['@/modules/attachments/attachment-client'] = { getAttachmentAvailabilityOutcome: () => ({ available: false }), requestAttachmentUpload: async () => ({}) };
    window.__fintrackModules['@/modules/attachments/attachment-integrity'] = { MAX_FINANCIAL_ATTACHMENT_BYTES: 5_000_000 };
    window.__fintrackModules['@/lib/supabase.server'] = { createClient: () => { window.__unexpectedSupabaseCalls += 1; throw new Error('Unexpected server client access in isolated harness'); } };
    window.__fintrackModules['@/lib/catalog/catalog-normalization'] = { dedupeAssetTypes: items => items };
    window.__fintrackModules['@/modules/assets/asset-purchase-payload'] = {};
    window.__fintrackModules['@/lib/server/observability'] = { measureServerOperation: (_name, fn) => fn() };
    window.__unexpectedSupabaseCalls = 0;
    window.__serverOptionLoad = { delayMs: 0, fail: false };
  `
}

const formOptions = {
  accounts: [{ value: 'synthetic-account', label: 'Cuenta sintética', meta: { currency: 'PEN', type: 'CHECKING', balance: 1000 } }],
  creditCards: [], creditors: [{ value: 'synthetic-creditor', label: 'Acreedor sintético' }],
  debtors: [{ value: 'synthetic-debtor', label: 'Deudor sintético' }],
  pendingReceivables: [{ value: 'synthetic-receivable', label: 'Cobro sintético', meta: { currency: 'PEN', pending_amount: 100 } }],
  pendingPayables: [{ value: 'synthetic-payable', label: 'Pago sintético', meta: { currency: 'PEN', pending_amount: 100 } }],
  assetTypes: [{ value: 'synthetic-asset-type', label: 'Equipo', meta: {} }],
  categories: {
    income: [{ value: 'income-category', label: 'Ingreso', system_key: null }],
    expense: [{ value: 'expense-category', label: 'General', system_key: null }],
  },
  currencies: [{ value: 'PEN', label: 'Soles' }, { value: 'USD', label: 'Dólares' }],
}

async function mountIntegratedFlow(page: Page) {
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.route('http://fintrack.test/**', route => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<!doctype html><html><head></head><body><div id="root"></div></body></html>',
  }))
  await page.goto('http://fintrack.test/dashboard')
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ path: reactHookFormPath })
  await page.addScriptTag({ content: browserMocks() })

  await page.evaluate(({ options }) => {
    window.__fintrackOptions = options
    window.__fintrackQuickOperations = {}
  }, { options: formOptions })

  const quickOperationsPath = join(process.cwd(), 'lib/constants/quick-operations.ts')
  const quickSource = readFileSync(quickOperationsPath, 'utf8').replace(/^\/\*[^]*?\*\/\s*/, '')
  const quickCompiled = ts.transpileModule(quickSource.replace(/\bexport\s+(?=(?:const|function)\b)/g, ''), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText
  await page.addScriptTag({ content: `(() => { ${quickCompiled}; window.__fintrackQuickOperations = { QUICK_OPERATIONS, quickOperationHrefForId }; window.__fintrackModules['@/lib/constants/quick-operations'] = window.__fintrackQuickOperations; })()` })

  await page.addScriptTag({ content: compileComponent('components/transactions/OperationTypeIcon.tsx', 'OperationTypeIcon', 'OperationTypeIcon') })
  await page.addScriptTag({ content: `window.__fintrackModules['@/components/transactions/OperationTypeIcon'] = { OperationTypeIcon: window.__fintrackExports.OperationTypeIcon }; window.__fintrackModules['react'] = { default: window.React, ...window.React };` })
  await page.addScriptTag({ content: compileComponent('components/transactions/OperationTypeSelector.tsx', 'OperationTypePopover', 'OperationTypePopover', ['OperationTypeSelector', 'operationTypeToFormConfig', 'OPERATION_TITLES']) })
  await page.addScriptTag({ content: `window.__fintrackModules['@/components/transactions/OperationTypeSelector'] = { OperationTypePopover: window.__fintrackExports.OperationTypePopover, OperationTypeSelector: window.__fintrackExports.OperationTypeSelector, OPERATION_TITLES: window.__fintrackExports.OPERATION_TITLES, operationTypeToFormConfig: window.__fintrackExports.operationTypeToFormConfig };` })
  await page.addScriptTag({ content: compileComponent('lib/ui/use-v3-workbench-presence.ts', 'useV3WorkbenchPresence', 'useV3WorkbenchPresence') })
  await page.addScriptTag({ content: `window.__fintrackModules['@/lib/ui/use-v3-workbench-presence'] = { useV3WorkbenchPresence: window.__fintrackExports.useV3WorkbenchPresence };` })
  await page.addScriptTag({ content: compileComponent('components/ui/RecordModal.tsx', 'RecordModal', 'RecordModal') })
  await page.addScriptTag({ content: `window.__fintrackModules['@/components/ui/RecordModal'] = { ...window.__fintrackModules['@/components/ui/RecordModal'], RecordModal: window.__fintrackExports.RecordModal };` })

  await page.addScriptTag({ content: compileComponent('modules/assets/asset-purchase-payload.ts', 'buildAssetPurchaseModulePayload', 'buildAssetPurchaseModulePayload') })
  await page.addScriptTag({ content: `window.__fintrackModules['@/modules/assets/asset-purchase-payload'] = { buildAssetPurchaseModulePayload: window.__fintrackExports.buildAssetPurchaseModulePayload };` })
  await page.addScriptTag({ content: compileComponent('components/forms/TransactionForm/form.orchestrator.ts', 'useFormOrchestrator', 'useFormOrchestrator') })
  await page.addScriptTag({ content: `window.__fintrackFormOrchestrator = { useFormOrchestrator: window.__fintrackExports.useFormOrchestrator }; window.__fintrackModules['./form.orchestrator'] = window.__fintrackFormOrchestrator;` })
  await page.addScriptTag({ content: compileComponent('components/forms/TransactionForm/index.tsx', 'TransactionForm', 'TransactionForm') })
  await page.addScriptTag({ content: `window.__fintrackModules['@/components/forms/TransactionForm'] = { TransactionForm: window.__fintrackExports.TransactionForm };` })

  await page.addScriptTag({ content: compileComponent('components/transactions/use-transaction-modal-initial-values.ts', 'useTransactionModalInitialValues', 'useTransactionModalInitialValues') })
  await page.addScriptTag({ content: `window.__fintrackModules['@/components/transactions/use-transaction-modal-initial-values'] = { useTransactionModalInitialValues: window.__fintrackExports.useTransactionModalInitialValues };` })
  const resolverSource = compileComponent('lib/server/transaction-form-options.ts', 'resolveTransactionInitialValues', 'resolveTransactionInitialValues')
  await page.addScriptTag({ content: resolverSource })
  await page.addScriptTag({ content: `window.__fintrackModules['@/lib/server/transaction-form-options'] = { resolveTransactionInitialValues: window.__fintrackExports.resolveTransactionInitialValues };` })
  await page.addScriptTag({ content: compileComponent('components/ui/CreateModuleButton.tsx', 'CreateModuleButton', 'CreateModuleButton') })
  await page.addScriptTag({ content: `window.__fintrackModules['@/components/ui/CreateModuleButton'] = { CreateModuleButton: window.__fintrackExports.CreateModuleButton };` })
  await page.addScriptTag({ content: compileComponent('components/dashboard/DashboardSourceState.tsx', 'DashboardSourceState', 'DashboardSourceState') })
  await page.addScriptTag({ content: `window.__fintrackModules['@/components/dashboard/DashboardSourceState'] = { DashboardSourceState: window.__fintrackExports.DashboardSourceState }; window.__fintrackModules['./DashboardSourceState'] = window.__fintrackModules['@/components/dashboard/DashboardSourceState'];` })
  await page.addScriptTag({ content: compileComponent('components/dashboard/DashboardRound07.tsx', 'DashboardRound07', 'DashboardRound07') })
  await page.addScriptTag({ content: `window.__fintrackModules['@/components/dashboard/DashboardRound07'] = { DashboardRound07: window.__fintrackExports.DashboardRound07 };` })
  await page.addScriptTag({ content: compileComponent('components/transactions/TransactionsWorkspace.tsx', 'TransactionsWorkspace', 'TransactionsWorkspace') })
  await page.addScriptTag({ content: `window.__fintrackModules['@/components/transactions/TransactionsWorkspace'] = { TransactionsWorkspace: window.__fintrackExports.TransactionsWorkspace };` })
  await page.addScriptTag({ content: compileComponent('components/assets/AssetsWorkspace.tsx', 'AssetsWorkspace', 'AssetsWorkspace') })
  await page.addScriptTag({ content: `window.__fintrackModules['@/components/assets/AssetsWorkspace'] = { AssetsWorkspace: window.__fintrackExports.AssetsWorkspace };` })

  await page.addScriptTag({ content: `(() => {
    const React = window.React;
    const root = window.ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(window.__fintrackExports.DashboardRound07));
    window.__mountAssetsWorkspace = () => root.render(React.createElement(window.__fintrackExports.AssetsWorkspace, { demoAllowed: false }));
    window.__navigateMock = path => {
      window.__routeDebug = { path: location.pathname, search: location.search };
      if (new URL(path, location.href).pathname === '/dashboard') {
        root.render(React.createElement(window.__fintrackExports.DashboardRound07));
        return;
      }
      const params = Object.fromEntries(new URLSearchParams(new URL(path, location.href).search));
      const optionLoad = window.__serverOptionLoad ?? { delayMs: 0, fail: false };
      const routeOptions = optionLoad.fail ? window.__fintrackFallbackOptions : window.__fintrackOptions;
      const renderWorkspace = () => window.__fintrackExports.resolveTransactionInitialValues(params, 'synthetic-user', routeOptions)
        .then(initialValues => root.render(React.createElement(window.__fintrackExports.TransactionsWorkspace, {
          options: routeOptions,
          initialValues,
          preloadWarnings: optionLoad.fail ? [{ area: 'options', message: 'No se pudieron cargar las opciones de transacción.', detail: 'Las opciones sintéticas no están disponibles.', affectedOptions: ['accounts'] }] : [],
        })))
        .catch(error => { window.__routeError = String(error); });
      window.setTimeout(renderWorkspace, optionLoad.delayMs);
    };
  })()` })

  await page.getByRole('button', { name: 'Nuevo movimiento' }).waitFor({ timeout: 5000 }).catch(() => {
    throw new Error(`Integrated dashboard did not mount: ${pageErrors.join(' | ') || 'no browser exception captured'}`)
  })
  return pageErrors
}

test('Inicio navigation mounts the authentic TransactionForm for each of the eight operations', async ({ page }) => {
  await mountIntegratedFlow(page)
  const expected = [
    { id: 'income', title: 'Ingreso', layout: 'income', section: 'Movimiento', fieldTestId: 'transaction-source-account-select' },
    { id: 'expense', title: 'Egreso', layout: 'expense', section: 'Movimiento', fieldTestId: 'transaction-source-account-select' },
    { id: 'transfer', title: 'Transferencia', layout: 'transfer', section: 'Transferencia', fieldTestId: 'transaction-destination-account-select' },
    { id: 'asset_purchase', title: 'Comprar activo', layout: 'asset_purchase', section: 'Activo', fieldTestId: 'transaction-asset-name-input' },
    { id: 'receivable_issue', title: 'Prestar dinero', layout: 'receivable_issue', section: 'Cuenta por cobrar', fieldTestId: 'transaction-receivable-debtor-select' },
    { id: 'receivable_collect', title: 'Registrar cobro', layout: 'receivable_collect', section: 'Registrar cobro', fieldTestId: 'transaction-settlement-receivable-select' },
    { id: 'payable_issue', title: 'Recibir préstamo', layout: 'payable_issue', section: 'Cuenta por pagar', fieldTestId: 'transaction-payable-creditor-select' },
    { id: 'payable_pay', title: 'Registrar pago', layout: 'payable_pay', section: 'Registrar pago', fieldTestId: 'transaction-settlement-payable-select' },
  ]

  for (const operation of expected) {
    await page.getByRole('button', { name: 'Nuevo movimiento' }).click()
    const menu = page.getByRole('menu', { name: 'Registrar una operación' })
    await expect(menu).toBeVisible()
    await menu.getByRole('menuitem', { name: new RegExp(`^${operation.title}`) }).click()

    await expect(page).toHaveURL(new RegExp(`/transactions\\?new=transaction`))
    await expect(page.getByTestId('transaction-form')).toBeVisible()
    const dialog = page.getByRole('dialog', { name: operation.title })
    await expect(dialog).toBeVisible()
    const form = dialog.getByTestId('transaction-form')
    await expect(form).toHaveAttribute('data-operation-layout', operation.layout)
    await expect(form.getByRole('region', { name: operation.section })).toBeVisible()
    await expect(form.getByTestId(operation.fieldTestId)).toBeVisible()
    await expect(dialog.getByRole('menu', { name: 'Registrar una operación' })).toHaveCount(0)
    await expect(form.getByRole('button', { name: 'Cancelar' })).toBeVisible()

    const actualUrl = new URL(page.url())
    const params = actualUrl.searchParams
    expect(params.get('type')).toBe(operation.id === 'income' || operation.id === 'receivable_collect' || operation.id === 'payable_issue' ? 'INCOME' : operation.id === 'transfer' ? 'TRANSFER' : 'EXPENSE')
    if (operation.id === 'asset_purchase') expect(params.get('module')).toBe('asset')
    if (operation.id.startsWith('receivable_')) expect(params.get('module')).toBe('receivable')
    if (operation.id.startsWith('payable_')) expect(params.get('module')).toBe('payable')

    await form.getByRole('button', { name: 'Cancelar' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('menu', { name: 'Registrar una operación' })).toHaveCount(0)
    await expect(page.getByTestId('transaction-form')).toHaveCount(0)
    if (operation !== expected[expected.length - 1]) {
      await page.evaluate(() => {
        history.pushState({}, '', '/dashboard')
        window.dispatchEvent(new Event('popstate'))
        window.__navigateMock?.('/dashboard')
      })
      await page.getByRole('button', { name: 'Nuevo movimiento' }).waitFor()
    }
  }
  expect(await page.evaluate(() => window.__unexpectedSupabaseCalls)).toBe(0)
})

test('receivables issue deep link mounts the approved Prestar dinero form without the operation selector', async ({ page }) => {
  await mountIntegratedFlow(page)
  const destination = '/transactions?new=transaction&module=receivable&type=EXPENSE'
  await page.evaluate(path => {
    history.pushState({}, '', path)
    window.__navigateMock?.(path)
  }, destination)

  await expect(page).toHaveURL(/\/transactions\?new=transaction&module=receivable&type=EXPENSE/)
  const dialog = page.getByRole('dialog', { name: 'Prestar dinero' })
  await expect(dialog).toBeVisible()
  const form = dialog.getByTestId('transaction-form')
  await expect(form).toHaveAttribute('data-operation-layout', 'receivable_issue')
  await expect(form.getByRole('region', { name: 'Cuenta por cobrar' })).toBeVisible()
  await expect(form.getByTestId('transaction-receivable-debtor-select')).toBeVisible()
  await expect(page.getByRole('menu', { name: 'Registrar una operación' })).toHaveCount(0)
  await expect(form.getByRole('button', { name: 'Cancelar' })).toBeVisible()
  expect(await page.evaluate(() => window.__unexpectedSupabaseCalls)).toBe(0)
})

test('payables issue deep link mounts the approved Recibir préstamo form without the operation selector', async ({ page }) => {
  await mountIntegratedFlow(page)
  const destination = '/transactions?new=transaction&module=payable&type=INCOME'
  await page.evaluate(path => {
    history.pushState({}, '', path)
    window.__navigateMock?.(path)
  }, destination)

  await expect(page).toHaveURL(/\/transactions\?new=transaction&module=payable&type=INCOME/)
  const dialog = page.getByRole('dialog', { name: 'Recibir préstamo' })
  await expect(dialog).toBeVisible()
  const form = dialog.getByTestId('transaction-form')
  await expect(form).toHaveAttribute('data-operation-layout', 'payable_issue')
  await expect(form.getByRole('region', { name: 'Cuenta por pagar' })).toBeVisible()
  await expect(form.getByTestId('transaction-payable-creditor-select')).toBeVisible()
  await expect(page.getByRole('menu', { name: 'Registrar una operación' })).toHaveCount(0)
  await expect(form.getByRole('button', { name: 'Cancelar' })).toBeVisible()
  await form.getByRole('button', { name: 'Cancelar' }).click()
  await expect(dialog).toHaveCount(0)
  expect(await page.evaluate(() => window.__unexpectedSupabaseCalls)).toBe(0)
})

test('Assets Registrar activo opens the approved Comprar activo form directly', async ({ page }) => {
  await mountIntegratedFlow(page)
  await page.evaluate(() => window.__mountAssetsWorkspace?.())
  await page.getByTestId('assets-create-button').click()

  await expect(page).toHaveURL(/\/transactions\?new=transaction&module=asset&type=EXPENSE$/)
  const dialog = page.getByRole('dialog', { name: 'Comprar activo' })
  await expect(dialog).toBeVisible()
  const form = dialog.getByTestId('transaction-form')
  await expect(form).toHaveAttribute('data-operation-layout', 'asset_purchase')
  await expect(form.getByRole('region', { name: 'Activo' })).toBeVisible()
  await expect(form.getByTestId('transaction-asset-name-input')).toBeVisible()
  await expect(page.getByRole('menu', { name: 'Registrar una operación' })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  await expect(dialog).toHaveCount(0)
  expect(await page.evaluate(() => window.__unexpectedSupabaseCalls)).toBe(0)
})

test('delayed and failed option preload never silently mounts a different financial operation', async ({ page }) => {
  await mountIntegratedFlow(page)
  await page.evaluate(() => {
    window.__serverOptionLoad = { delayMs: 300, fail: false }
  })

  await page.getByRole('button', { name: 'Nuevo movimiento' }).click()
  await page.getByRole('menu', { name: 'Registrar una operación' }).getByRole('menuitem', { name: /^Comprar activo/ }).click()
  await expect(page).toHaveURL(/\/transactions\?new=transaction/)
  await expect(page.getByTestId('transaction-form')).toHaveCount(0)
  const delayedForm = page.getByTestId('transaction-form')
  await expect(delayedForm).toBeVisible()
  await expect(delayedForm).toHaveAttribute('data-operation-layout', 'asset_purchase')
  await expect(page.getByRole('dialog', { name: 'Comprar activo' }).getByTestId('transaction-asset-name-input')).toBeVisible()

  await page.getByRole('dialog', { name: 'Comprar activo' }).getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.getByRole('dialog', { name: 'Comprar activo' })).toHaveCount(0)
  await page.evaluate(() => {
    window.__serverOptionLoad = { delayMs: 0, fail: true }
    history.pushState({}, '', '/dashboard')
    window.dispatchEvent(new Event('popstate'))
    window.__navigateMock?.('/dashboard')
    window.__fintrackFallbackOptions = {
      accounts: [], creditCards: [], creditors: [], debtors: [], pendingReceivables: [], pendingPayables: [],
      assetTypes: [], currencies: [], categories: { income: [], expense: [] },
    }
  })
  await page.getByRole('button', { name: 'Nuevo movimiento' }).waitFor()
  await page.getByRole('button', { name: 'Nuevo movimiento' }).click()
  await page.getByRole('menu', { name: 'Registrar una operación' }).getByRole('menuitem', { name: /^Recibir préstamo/ }).click()
  const failedLoadForm = page.getByTestId('transaction-form')
  await expect(failedLoadForm).toBeVisible()
  await expect(failedLoadForm).toHaveAttribute('data-operation-layout', 'payable_issue')
  await expect(page.getByRole('alert').filter({ hasText: 'No se pudieron cargar las opciones de transacción.' })).toBeVisible()
  expect(await page.evaluate(() => window.__unexpectedSupabaseCalls)).toBe(0)
})
