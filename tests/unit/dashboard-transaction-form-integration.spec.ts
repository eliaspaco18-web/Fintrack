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
    __serverOptionLoad: { delayMs: number; fail: boolean; optionsLoaded?: boolean }
    __formOptionsRequests: number
    __browserErrors: string[]
    __navigateMock?: (path: string) => void
    __mountAssetsWorkspace?: () => void
    __mountUsdTransactionForm?: () => void
    __routeDebug?: { path: string; search: string }
    __transactionRoot?: { render: (node: unknown) => void }
    __duplicateFixture?: Record<string, unknown>
    __duplicateCreates?: Array<Record<string, unknown>>
    __mountRealDuplicateModal?: () => void
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
    const sidebar = { ingresos_categoria: [], egresos_categoria: [] };
    const overview = {
      summary: { data: summary, error: null },
      sidebar: { data: sidebar, error: null },
    };
    const dashboardOverview = {
      summary: { data: summary, error: null, isLoading: false },
      sidebar: { data: sidebar, error: null, isLoading: false },
      mutate: async () => undefined,
    };
    window.__fintrackModules['@/components/dashboard/useDashboardOverview'] = { useDashboardOverview: () => dashboardOverview };
    window.__fintrackModules['./useDashboardOverview'] = window.__fintrackModules['@/components/dashboard/useDashboardOverview'];
    window.__fintrackModules['swr'] = {
      default: key => {
        let data = [];
        if (typeof key === 'string' && key.includes('/dashboard/overview')) data = overview;
        else if (typeof key === 'string' && (key.includes('/dashboard/summary') || key.includes('/transactions/month-summary'))) data = summary;
        else if (typeof key === 'string' && key.includes('/dashboard/money-flow')) data = { series: [] };
        else if (typeof key === 'string' && key.includes('/dashboard/sidebar')) data = sidebar;
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
    window.__fintrackModules['@/components/management/BudgetMonthPicker'] = { BudgetMonthPicker: () => null };
    window.__fintrackModules['@/lib/transactions-month-summary'] = { monthBounds: month => ({ start: month + '-01', end: month + '-31' }) };
    window.__fintrackModules['@/components/tables/TransactionTable'] = {
      TransactionTable: ({ workspaceHeader, toolbarActions }) => React.createElement('div', { 'data-testid': 'transaction-table-stub' }, typeof workspaceHeader === 'function' ? workspaceHeader({ month: '2026-10', periodLabel: '2026-10-01 – 2026-10-31', completeMonth: true, selectMonth: () => {} }) : workspaceHeader, toolbarActions),
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
    window.__fintrackModules['@/lib/finance/exchange-rate-verification'] = { getVerifiedUsdPenRate: () => null };
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
    const Select = React.forwardRef((props, ref) => React.createElement('select', { ...props, ref, 'aria-label': props['aria-label'] ?? props.label }, props.children));
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
      CategoryKeys: new Proxy({}, { get: (_target, key) => String(key) }), getModuleTrigger: () => null, isLockedCategorySystemKey: () => false,
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
    window.__duplicateCreates = [];
    window.__fintrackModules['@/app/actions/transaction.actions'] = {
      updateTransactionAction: async () => ({ ok: false }),
      createTransactionAction: async payload => {
        window.__duplicateCreates.push(payload);
        return { ok: true, data: { id: 'synthetic-created-transaction' } };
      },
    };
    window.__fintrackModules['./form.orchestrator'] = window.__fintrackFormOrchestrator;
    window.__fintrackModules['@/components/forms/transaction-edit-presentation'] = { getTransactionEditPresentation: () => ({ blocked: false }) };
    window.__fintrackModules['./NestedRecordCreationModals'] = { NestedAccountCreateModal: () => null, NestedCategoryCreateModal: () => null };
    window.__fintrackModules['@/components/finance'] = { StatusBadge: () => null };
    window.__fintrackModules['@/components/forms/TransactionForm/IncomeDatePicker'] = { IncomeDatePicker: props => React.createElement('input', {
      value: props.value ?? '', type: 'date', 'data-testid': props.inputTestId ?? 'transaction-date-input',
      onChange: event => props.onChange?.(event.target.value), 'aria-label': props.inputLabel ?? 'Fecha',
    }) };
    window.__fintrackModules['./IncomeDatePicker'] = window.__fintrackModules['@/components/forms/TransactionForm/IncomeDatePicker'];
    window.__fintrackModules['@/modules/attachments/attachment-client'] = { getAttachmentAvailabilityOutcome: () => ({ available: false }), requestAttachmentUpload: async () => ({}) };
    window.__fintrackModules['@/modules/attachments/attachment-integrity'] = { MAX_FINANCIAL_ATTACHMENT_BYTES: 5_000_000 };
    window.__fintrackModules['@/lib/supabase.server'] = { createClient: () => { window.__unexpectedSupabaseCalls += 1; throw new Error('Unexpected server client access in isolated harness'); } };
    window.__fintrackModules['@/lib/catalog/catalog-normalization'] = { dedupeAssetTypes: items => items };
    window.__fintrackModules['@/modules/assets/asset-purchase-payload'] = {};
    window.__fintrackModules['@/lib/server/observability'] = { measureServerOperation: (_name, fn) => fn() };
    window.__unexpectedSupabaseCalls = 0;
    window.__formOptionsRequests = 0;
    window.__browserErrors = [];
    window.addEventListener('error', event => window.__browserErrors.push(event.message));
    window.addEventListener('unhandledrejection', event => window.__browserErrors.push(String(event.reason)));
    window.__fintrackModules['@/lib/client/fetch-with-timeout'] = {
      fetchWithTimeout: async input => {
        if (input !== '/api/transactions/form-options') throw new Error('Unexpected client request: ' + String(input));
        window.__formOptionsRequests += 1;
        const optionLoad = window.__serverOptionLoad;
        if (optionLoad.delayMs > 0) await new Promise(resolve => window.setTimeout(resolve, optionLoad.delayMs));
        if (optionLoad.fail) return { ok: false, json: async () => ({ ok: false }) };
        return { ok: true, json: async () => ({ ok: true, data: window.__fintrackOptions }) };
      },
    };
    window.__serverOptionLoad = { delayMs: 0, fail: false, optionsLoaded: true };
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
    window.__transactionRoot = root;
    window.__mountAssetsWorkspace = () => root.render(React.createElement(window.__fintrackExports.AssetsWorkspace, { demoAllowed: false }));
    window.__mountUsdTransactionForm = () => root.render(React.createElement(window.__fintrackExports.TransactionForm, {
      options: window.__fintrackOptions,
      initialValues: {
        type: 'EXPENSE',
        currency: 'USD',
        source_account_id: window.__fintrackOptions.accounts.find(account => account.meta?.currency === 'USD')?.value ?? 'synthetic-account',
        transaction_date: '2026-10-25',
      },
      operationType: 'expense',
      hideTypeSelector: true,
    }));
    window.__navigateMock = path => {
      window.__routeDebug = { path: location.pathname, search: location.search };
      if (new URL(path, location.href).pathname === '/dashboard') {
        root.render(React.createElement(window.__fintrackExports.DashboardRound07));
        return;
      }
      const params = Object.fromEntries(new URLSearchParams(new URL(path, location.href).search));
      const optionLoad = window.__serverOptionLoad ?? { delayMs: 0, fail: false, optionsLoaded: true };
      const optionsLoaded = optionLoad.optionsLoaded ?? true;
      const routeOptions = optionsLoaded ? window.__fintrackOptions : window.__fintrackFallbackOptions;
      const renderWorkspace = () => window.__fintrackExports.resolveTransactionInitialValues(params, 'synthetic-user', routeOptions)
        .then(initialValues => root.render(React.createElement(window.__fintrackExports.TransactionsWorkspace, {
          options: routeOptions,
          optionsLoaded,
          initialValues,
          preloadWarnings: optionLoad.fail ? [{ area: 'options', message: 'No se pudieron cargar las opciones de transacción.', detail: 'Las opciones sintéticas no están disponibles.', affectedOptions: ['accounts'] }] : [],
        })))
        .catch(error => { window.__routeError = String(error); });
      window.setTimeout(renderWorkspace, 0);
    };
  })()` })

  await page.getByRole('button', { name: 'Nuevo movimiento' }).waitFor({ timeout: 5000 }).catch(() => {
    throw new Error(`Integrated dashboard did not mount: ${pageErrors.join(' | ') || 'no browser exception captured'}`)
  })
  return pageErrors
}

async function installRealDuplicateModal(page: Page) {
  await page.evaluate(() => {
    window.__fintrackModules['@/components/forms/TransactionForm/FormFields'] = window.__fintrackModules['./FormFields']
  })
  await page.addScriptTag({ content: compileComponent('components/forms/transaction-edit-data.ts', 'firstLinkedRecord', 'firstLinkedRecord', ['inferOperationType', 'toInitialValues']) })
  await page.addScriptTag({ content: `window.__fintrackModules['@/components/forms/transaction-edit-data'] = {
    firstLinkedRecord: window.__fintrackExports.firstLinkedRecord,
    inferOperationType: window.__fintrackExports.inferOperationType,
    toInitialValues: window.__fintrackExports.toInitialValues,
  };` })
  await page.addScriptTag({ content: compileComponent('modules/transactions/transaction-duplication.ts', 'buildTransactionDuplicationPlan', 'buildTransactionDuplicationPlan', ['getTransactionDuplicationBlockReason']) })
  await page.addScriptTag({ content: `window.__fintrackModules['@/modules/transactions/transaction-duplication'] = {
    buildTransactionDuplicationPlan: window.__fintrackExports.buildTransactionDuplicationPlan,
    getTransactionDuplicationBlockReason: window.__fintrackExports.getTransactionDuplicationBlockReason,
  };` })
  await page.evaluate(() => {
    const module = window.__fintrackModules['@/modules/transactions/transaction-duplication']
    const build = module.buildTransactionDuplicationPlan
    module.buildTransactionDuplicationPlan = (...args: any[]) => {
      const plan = build(...args)
      ;(window as any).__lastDuplicatePlan = plan
      return plan
    }
  })
  await page.addScriptTag({ content: compileComponent('components/forms/use-transaction-edit-record.ts', 'useTransactionEditRecord', 'useTransactionEditRecord') })
  await page.addScriptTag({ content: `window.__fintrackModules['@/components/forms/use-transaction-edit-record'] = { useTransactionEditRecord: window.__fintrackExports.useTransactionEditRecord };` })
  await page.addScriptTag({ content: compileComponent('components/forms/TransactionEditModal.tsx', 'TransactionEditModal', 'TransactionEditModal') })
  await page.addScriptTag({ content: `window.__fintrackModules['@/components/forms/TransactionEditModal'] = { TransactionEditModal: window.__fintrackExports.TransactionEditModal };` })
  await page.evaluate(() => {
    const React = (window as any).React
    const fixture = {
      id: 'synthetic-original-1', type: 'EXPENSE', amount: 84.25, amount_pen: 84.25, currency: 'PEN',
      description: 'Compra ficticia de validación', transaction_date: '2026-10-18', category_id: 'expense-category',
      category: { id: 'expense-category', system_key: null }, notes: 'Nota de prueba completa',
      payment_method: 'DEBIT', source_account_id: 'synthetic-account', destination_account_id: null,
      budget_id: null, is_recurring: false, recurring_transaction_id: null, attachment_url: 'must-not-copy.pdf',
      sub_type: null, linked_asset: null, linked_receivable: null, linked_payable: null, linked_credit: null, linked_loan: null,
    }
    window.__duplicateFixture = fixture
    window.__fintrackModules['@/components/forms/TransactionForm'] = { TransactionForm: window.__fintrackExports.TransactionForm }
    window.__transactionRoot?.render(React.createElement(function RealDuplicateHarness() {
      const [open, setOpen] = React.useState(false)
      const [transactionId, setTransactionId] = React.useState(null as string | null)
      return React.createElement(React.Fragment, null,
        React.createElement('button', { type: 'button', onClick: () => { setTransactionId('synthetic-original-1'); setOpen(true) } }, 'Duplicar movimiento ficticio'),
        React.createElement('button', { type: 'button', onClick: () => { setTransactionId('synthetic-original-2'); setOpen(true) } }, 'Duplicar segundo movimiento ficticio'),
        React.createElement(window.__fintrackExports.TransactionEditModal, {
          open, transactionId, intent: 'duplicate', options: window.__fintrackOptions,
          onClose: () => setOpen(false), onCreated: () => {},
        }))
    }))
    window.__mountRealDuplicateModal = () => {}
  })
}

async function expectNoBrowserErrors(page: Page) {
  await expect.poll(() => page.evaluate(() => window.__browserErrors)).toEqual([])
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
    await expectNoBrowserErrors(page)
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
  await expectNoBrowserErrors(page)
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
  await expectNoBrowserErrors(page)
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

test('USD transaction does not auto-apply the numeric context fallback when the accounting rate is unavailable', async ({ page }) => {
  await mountIntegratedFlow(page)
  await page.evaluate(() => {
    ;(window.__fintrackOptions as typeof formOptions).accounts.push({
      value: 'synthetic-usd-account',
      label: 'Cuenta USD sintética',
      meta: { currency: 'USD', type: 'CHECKING', balance: 1000 },
    })
    window.__mountUsdTransactionForm?.()
  })

  const form = page.getByTestId('transaction-form')
  await expect(form).toBeVisible()
  await expect(form.getByTestId('transaction-currency-select')).toHaveValue('USD')
  const exchangeRateInput = form.getByTestId('transaction-exchange-rate-input')
  await expect(exchangeRateInput).toBeVisible()
  await expect(exchangeRateInput).toHaveValue('')
  await expect(form.getByText('Tipo de cambio no disponible')).toBeVisible()
  await expect(form.getByText('No disponible').first()).toBeVisible()
  expect(await page.evaluate(() => window.__unexpectedSupabaseCalls)).toBe(0)
})

test('duplicate opens the real TransactionForm with API fixture data, creates independently, cancels cleanly, and resets between records', async ({ page }, testInfo) => {
  const fixtures: Record<string, Record<string, unknown>> = {
    'synthetic-original-1': {
      id: 'synthetic-original-1', type: 'EXPENSE', amount: 84.25, amount_pen: 84.25, currency: 'PEN',
      description: 'Compra ficticia de validación', transaction_date: '2026-10-18', category_id: 'expense-category',
      category: { id: 'expense-category', system_key: null }, notes: 'Nota de prueba completa', payment_method: 'DEBIT',
      source_account_id: 'synthetic-account', destination_account_id: null, budget_id: null, is_recurring: false,
      attachment_url: 'must-not-copy.pdf', recurring_transaction_id: null, sub_type: null,
      linked_asset: null, linked_receivable: null, linked_payable: null, linked_credit: null, linked_loan: null,
    },
    'synthetic-original-2': {
      id: 'synthetic-original-2', type: 'EXPENSE', amount: 18.5, amount_pen: 18.5, currency: 'PEN',
      description: 'Otro gasto de prueba', transaction_date: '2026-10-03', category_id: 'expense-category-2',
      category: { id: 'expense-category-2', system_key: null }, notes: 'Nota del segundo movimiento', payment_method: 'DEBIT',
      source_account_id: 'synthetic-account-2', destination_account_id: null, budget_id: null, is_recurring: false,
      attachment_url: null, recurring_transaction_id: null, sub_type: null,
      linked_asset: null, linked_receivable: null, linked_payable: null, linked_credit: null, linked_loan: null,
    },
  }
  const browserErrors = await mountIntegratedFlow(page)
  await page.route('**/api/transactions/synthetic-original-*', async route => {
    const id = new URL(route.request().url()).pathname.split('/').pop()
    const data = fixtures[id ?? '']
    if (!data) throw new Error(`Missing synthetic transaction fixture for ${id}`)
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data }) })
  })
  await page.route('**/api/budgets?**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) }))
  await page.evaluate(() => {
    const options = window.__fintrackOptions as typeof formOptions
    options.accounts.push({ value: 'synthetic-account-2', label: 'Segunda cuenta ficticia', meta: { currency: 'PEN', type: 'CHECKING', balance: 900 } })
    options.categories.expense.push({ value: 'expense-category-2', label: 'Transporte', system_key: null })
  })
  await installRealDuplicateModal(page)
  const formCss = readFileSync(join(process.cwd(), 'components/forms/TransactionForm/IncomeTransactionForm.module.css'), 'utf8')
    .replace(/:global\(([^()]*)\)/g, '$1')
  await page.addStyleTag({ content: formCss })
  await page.addStyleTag({ content: `
    body { margin:0; padding:20px; background:#f3f6f4; color:#26352d; font:14px/1.5 Manrope,Inter,system-ui,sans-serif; }
    .max-h-0 { max-height:0 !important; } .opacity-0 { opacity:0 !important; } .w-0 { width:0 !important; } .overflow-hidden { overflow:hidden !important; }
    [role=dialog] { width:min(620px,96vw); max-height:none; overflow:visible; margin:2vh auto; padding:24px; border:1px solid #dbe5df; border-radius:18px; background:white; box-shadow:0 18px 60px #18382925; color:#26352d; font:14px/1.5 Manrope,Inter,system-ui,sans-serif; }
    [role=dialog] form[data-testid=transaction-form] { display:grid; gap:14px; }
    [role=dialog] input:not([type=checkbox]), [role=dialog] select, [role=dialog] textarea { width:100%; min-height:42px; padding:9px 11px; border:1px solid #d6e0da; border-radius:9px; background:white; color:#203128; font:14px/1.4 Manrope,Inter,system-ui,sans-serif; }
    [role=dialog] textarea { min-height:70px; }
    [role=dialog] label { display:grid; gap:6px; color:#53635a; font-size:12px; font-weight:600; }
    [role=dialog] h2, [role=dialog] h3 { margin:12px 0 4px; font:700 15px/1.35 Manrope,Inter,system-ui,sans-serif; color:#26352d; }
    [role=dialog] button { min-height:38px; padding:6px 12px; border:1px solid #d6e0da; border-radius:9px; background:#fff; color:#26352d; font:600 13px Manrope,Inter,system-ui,sans-serif; }
    [role=dialog] button[type=submit] { background:#245c42; border-color:#245c42; color:white; }
    @media(max-width:520px) { body { padding:8px; } [role=dialog] { margin:1vh auto; padding:18px 14px; border-radius:14px; } }
  ` })

  await page.getByRole('button', { name: 'Duplicar movimiento ficticio' }).waitFor({ timeout: 3000 }).catch(async () => {
    throw new Error(`Real duplicate harness did not mount; root=${await page.locator('#root').innerHTML()}; errors=${JSON.stringify(await page.evaluate(() => window.__browserErrors))}`)
  })
  await page.getByRole('button', { name: 'Duplicar movimiento ficticio' }).click()
  const modal = page.getByRole('dialog', { name: 'Duplicar movimiento' })
  const form = modal.getByTestId('transaction-form')
  await expect(form).toBeVisible().catch(async () => {
    throw new Error(`Duplicate form did not load: body=${(await page.locator('body').innerText()).slice(0, 1200)}; errors=${JSON.stringify(await page.evaluate(() => window.__browserErrors))}`)
  })
  await expect(form).toHaveAttribute('data-operation-layout', 'expense')
  await expect(form).not.toHaveAttribute('data-transaction-id')
  await expect(form.getByTestId('transaction-amount-input')).toHaveValue('84.25')
  await expect(form.getByTestId('transaction-date-input')).toHaveValue('2026-10-18')
  await expect(form.getByTestId('transaction-description-input')).toHaveValue('Compra ficticia de validación')
  await expect(form.getByTestId('transaction-source-account-select')).toHaveValue('synthetic-account')
  await expect(form.getByTestId('transaction-category-select')).toHaveValue('expense-category')
  await form.getByRole('button', { name: 'Notas' }).click()
  await expect(form.getByTestId('transaction-notes-input')).toHaveValue('Nota de prueba completa')
  expect(await page.evaluate(() => window.__unexpectedSupabaseCalls)).toBe(0)

  await page.setViewportSize({ width: 1440, height: 1000 })
  await modal.evaluate(element => { (element as HTMLElement).scrollTop = 0 })
  await page.locator('#root > button').evaluateAll(elements => elements.forEach(element => { (element as HTMLElement).style.visibility = 'hidden' }))
  await page.screenshot({ path: testInfo.outputPath('duplicate-real-form-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await modal.evaluate(element => { (element as HTMLElement).scrollTop = 0 })
  await page.screenshot({ path: testInfo.outputPath('duplicate-real-form-mobile.png'), fullPage: true })
  await page.locator('#root > button').evaluateAll(elements => elements.forEach(element => { (element as HTMLElement).style.visibility = '' }))

  await form.getByTestId('transaction-amount-input').fill('96.40')
  await form.getByTestId('transaction-date-input').fill('2026-10-22')
  await form.getByTestId('transaction-description-input').fill('Gasto editado antes de crear')
  await form.getByTestId('transaction-source-account-select').selectOption('synthetic-account-2')
  await form.getByTestId('transaction-category-select').selectOption('expense-category-2')
  await form.getByTestId('transaction-notes-input').fill('Nota nueva editada')
  await modal.getByRole('button', { name: 'Cancelar' }).click()
  await expect(modal).toHaveCount(0)
  expect(await page.evaluate(() => window.__duplicateCreates)).toHaveLength(0)

  await page.getByRole('button', { name: 'Duplicar segundo movimiento ficticio' }).click()
  const secondModal = page.getByRole('dialog', { name: 'Duplicar movimiento' })
  const secondForm = secondModal.getByTestId('transaction-form')
  await expect(secondForm.getByTestId('transaction-amount-input')).toHaveValue('18.5')
  expect(await page.evaluate(() => (window as any).__lastDuplicatePlan?.initialValues)).toMatchObject({ category_id: 'expense-category-2' })
  await expect(secondForm.getByTestId('transaction-date-input')).toHaveValue('2026-10-03')
  await expect(secondForm.getByTestId('transaction-description-input')).toHaveValue('Otro gasto de prueba')
  await expect(secondForm.getByTestId('transaction-source-account-select')).toHaveValue('synthetic-account-2')
  await expect(secondForm.getByTestId('transaction-category-select')).toHaveValue('expense-category-2')
  await secondForm.getByRole('button', { name: 'Notas' }).click()
  await expect(secondForm.getByTestId('transaction-notes-input')).toHaveValue('Nota del segundo movimiento')
  await secondForm.getByTestId('transaction-amount-input').fill('27.75')
  await secondForm.getByTestId('transaction-date-input').fill('2026-10-24')
  await secondForm.getByTestId('transaction-description-input').fill('Segundo duplicado independiente')
  await secondForm.getByTestId('transaction-source-account-select').selectOption('synthetic-account')
  await secondForm.getByTestId('transaction-category-select').selectOption('expense-category')
  await secondForm.getByTestId('transaction-notes-input').fill('Notas actualizadas del segundo')
  await secondForm.getByRole('button', { name: 'Registrar', exact: true }).click()

  await expect(secondModal).toHaveCount(0)
  const created = await page.evaluate(() => window.__duplicateCreates ?? [])
  expect(created).toHaveLength(1)
  const createdPayload = created[0] as Record<string, unknown>
  expect(createdPayload).toMatchObject({
    type: 'EXPENSE', amount: 27.75, currency: 'PEN', transaction_date: '2026-10-24',
    description: 'Segundo duplicado independiente', source_account_id: 'synthetic-account',
    category_id: 'expense-category', notes: 'Notas actualizadas del segundo',
  })
  expect(createdPayload).not.toHaveProperty('id')
  expect(createdPayload).not.toHaveProperty('attachment_url')
  expect(createdPayload).not.toHaveProperty('recurring_transaction_id')
  expect(createdPayload.exchange_rate).toBeUndefined()
  await expect.poll(() => browserErrors).toEqual([])
})

test('Assets Registrar activo opens the approved Comprar activo form directly', async ({ page }) => {
  await mountIntegratedFlow(page)
  await page.evaluate(() => window.__mountAssetsWorkspace?.())
  await page.getByTestId('assets-create-button').click()

  await expect(page).toHaveURL(/\/transactions\?new=transaction&module=asset&type=EXPENSE$/)
  const dialog = page.getByRole('dialog', { name: 'Comprar activo' })
  await expect(dialog).toBeVisible()
  await expectNoBrowserErrors(page)
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

test('deep links wait for delayed form options, safely block incomplete forms and retry after an option error', async ({ page }) => {
  await mountIntegratedFlow(page)
  await page.evaluate(() => {
    window.__serverOptionLoad = { delayMs: 300, fail: false, optionsLoaded: false }
    window.__fintrackFallbackOptions = {
      accounts: [], creditCards: [], creditors: [], debtors: [], pendingReceivables: [], pendingPayables: [],
      assetTypes: [], currencies: [], categories: { income: [], expense: [] },
    }
    const path = '/transactions?new=transaction&module=asset&type=EXPENSE'
    history.pushState({}, '', path)
    window.__navigateMock?.(path)
  })

  await expect(page).toHaveURL(/\/transactions\?new=transaction&module=asset&type=EXPENSE/)
  await expect(page.getByRole('status').getByText('Cargando opciones del formulario…')).toBeVisible()
  await expect(page.getByTestId('transaction-form')).toHaveCount(0)
  const delayedForm = page.getByTestId('transaction-form')
  await expect(delayedForm).toBeVisible()
  await expect(delayedForm).toHaveAttribute('data-operation-layout', 'asset_purchase')
  await expect(page.getByRole('dialog', { name: 'Comprar activo' }).getByTestId('transaction-asset-name-input')).toBeVisible()
  expect(await page.evaluate(() => window.__formOptionsRequests)).toBe(1)
  await expectNoBrowserErrors(page)

  await page.getByRole('dialog', { name: 'Comprar activo' }).getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.getByRole('dialog', { name: 'Comprar activo' })).toHaveCount(0)
  await page.evaluate(() => {
    window.__serverOptionLoad = { delayMs: 0, fail: true, optionsLoaded: false }
    history.pushState({}, '', '/dashboard')
    window.dispatchEvent(new Event('popstate'))
    window.__navigateMock?.('/dashboard')
  })
  await page.getByRole('button', { name: 'Nuevo movimiento' }).waitFor()
  await page.evaluate(() => {
    const path = '/transactions?new=transaction&module=payable&type=INCOME'
    history.pushState({}, '', path)
    window.dispatchEvent(new Event('popstate'))
    window.__navigateMock?.(path)
  })
  await expect(page).toHaveURL(/\/transactions\?new=transaction&module=payable&type=INCOME/)
  await expect(page.getByRole('alert').filter({ hasText: 'No se pudieron cargar las opciones para registrar movimientos.' })).toBeVisible()
  await expect(page.getByTestId('transaction-form')).toHaveCount(0)
  expect(await page.evaluate(() => window.__formOptionsRequests)).toBe(2)

  await page.evaluate(() => { window.__serverOptionLoad = { delayMs: 0, fail: false, optionsLoaded: false } })
  await page.getByRole('dialog', { name: 'Recibir préstamo' }).getByRole('button', { name: 'Reintentar' }).click()
  const failedLoadForm = page.getByTestId('transaction-form')
  await expect(failedLoadForm).toBeVisible()
  await expect(failedLoadForm).toHaveAttribute('data-operation-layout', 'payable_issue')
  await expect(page.getByTestId('transaction-payable-creditor-select')).toBeVisible()
  expect(await page.evaluate(() => window.__formOptionsRequests)).toBe(3)
  await expectNoBrowserErrors(page)
  expect(await page.evaluate(() => window.__unexpectedSupabaseCalls)).toBe(0)
})
