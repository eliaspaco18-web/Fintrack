import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

const reactPath = join(process.cwd(), 'node_modules/react/umd/react.development.js')
const reactDomPath = join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js')

function initialValuesHookSource(): string {
  const source = readFileSync(join(process.cwd(), 'components/transactions/use-transaction-modal-initial-values.ts'), 'utf8')
    .replace(/^'use client'\s*/, '')
    .replace(/import \{ useMemo \} from 'react'/, 'const { useMemo } = window.React')
    .replace(/import \{ operationTypeToFormConfig, type OperationType \} from '@\/components\/transactions\/OperationTypeSelector'/, 'const operationTypeToFormConfig = window.operationTypeToFormConfig')
    .replace(/export function /g, 'function ')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
  }).outputText
  return `(() => { var exports = {};\n${compiled}\nwindow.useTransactionModalInitialValues = useTransactionModalInitialValues; })()`
}

test('query synchronization does not replace selected create defaults or reset a visible form during exit', async ({ page }) => {
  await page.setContent('<div id="root"></div>')
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: `window.operationTypeToFormConfig = type => ({ type: type === 'income' ? 'INCOME' : 'EXPENSE' })` })
  await page.addScriptTag({ content: initialValuesHookSource() })
  await page.addScriptTag({ content: `
    window.resetCount = 0;
    function Harness() {
      const [queryOpen, setQueryOpen] = React.useState(true);
      const [operationType, setOperationType] = React.useState('expense');
      const initialValues = React.useMemo(() => ({ amount: 125, transaction_date: '2026-10-18' }), []);
      const values = window.useTransactionModalInitialValues(initialValues, queryOpen, true, operationType);
      React.useEffect(() => { window.resetCount += 1; }, [values]);
      return React.createElement(React.Fragment, null,
        React.createElement('button', { id: 'clear-query', onClick: () => setQueryOpen(false) }, 'Clear query'),
        React.createElement('button', { id: 'change-operation', onClick: () => setOperationType('income') }, 'Change operation'),
        React.createElement('span', { id: 'form-value', 'data-amount': values?.amount, 'data-type': values?.type }, 'Form remains mounted'));
    }
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
  ` })

  await expect(page.locator('#form-value')).toHaveAttribute('data-amount', '125')
  await expect.poll(() => page.evaluate(() => window.resetCount)).toBe(1)
  await page.locator('#clear-query').click()
  await expect(page.locator('#form-value')).toHaveAttribute('data-amount', '125')
  await expect.poll(() => page.evaluate(() => window.resetCount)).toBe(1)

  await page.locator('#change-operation').click()
  await expect(page.locator('#form-value')).toHaveAttribute('data-type', 'INCOME')
  await expect.poll(() => page.evaluate(() => window.resetCount)).toBe(2)
})

declare global {
  interface Window {
    resetCount: number
    operationTypeToFormConfig: (type: string) => Record<string, unknown>
    useTransactionModalInitialValues: (
      initialValues: Record<string, unknown>,
      openFromQuery: boolean,
      hasPrefillParams: boolean,
      selectedOperationType: string | null,
    ) => Record<string, unknown> | undefined
  }
}
