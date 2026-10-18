import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

const reactPath = join(process.cwd(), 'node_modules/react/umd/react.development.js')
const reactDomPath = join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js')

function transpileClientSource(path: string, prelude: string, exportExpression: string): string {
  const source = readFileSync(join(process.cwd(), path), 'utf8')
    .replace(/^'use client'\s*/, '')
    .replace(/import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];?/g, '')
    .replace(/export function /g, 'function ')
    .replace(/export interface /g, 'interface ')
    .replace(/export type /g, 'type ')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React },
  }).outputText
  return `(() => { var exports = {};\n${prelude}\n${compiled}\n${exportExpression}\n})();`
}

const presenceScript = transpileClientSource(
  'lib/ui/use-v3-workbench-presence.ts',
  'const { useEffect, useRef, useState } = window.React;',
  'window.useV3WorkbenchPresence = useV3WorkbenchPresence;',
)

const focusTrapScript = transpileClientSource(
  'components/ui/accessibility.tsx',
  'const { useEffect, useRef, useState, useCallback } = window.React;',
  'window.FocusTrap = FocusTrap;',
)

const modalBackgroundScript = transpileClientSource(
  'lib/ui/v3-modal-background.ts',
  '',
  'window.acquireV3ModalBackground = acquireV3ModalBackground;',
)

const recordModalScript = transpileClientSource(
  'components/ui/RecordModal.tsx',
  `
    const { Children, isValidElement, useEffect, useId, useMemo, useRef, useState } = window.React;
    const createPortal = window.ReactDOM.createPortal;
    const useV3WorkbenchPresence = window.useV3WorkbenchPresence;
    const acquireV3ModalBackground = window.acquireV3ModalBackground;
    const Button = props => window.React.createElement('button', {
      type: props.type || 'button', onClick: props.onClick, disabled: props.disabled,
      'aria-label': props.ariaLabel, 'data-testid': props.testId,
      'data-ft-button': '', 'data-size': props.size, className: props.className,
    }, props.children);
    const FocusTrap = window.FocusTrap;
  `,
  'window.RecordModal = RecordModal; window.RecordModalFooter = RecordModalFooter;',
)

async function mount(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: presenceScript })
  await page.addScriptTag({ content: focusTrapScript })
  await page.addScriptTag({ content: modalBackgroundScript })
  await page.addScriptTag({ content: recordModalScript })
  await page.addScriptTag({ content: `
    function Harness() {
      const [open, setOpen] = React.useState(false);
      const [step, setStep] = React.useState('selector');
      const presence = window.useV3WorkbenchPresence(open, true, 'pointer', () => {
        if (!open) setStep('selector');
      });
      const select = () => { setStep('form'); setOpen(true); };
      return React.createElement(React.Fragment, null,
        React.createElement('button', { id: 'launch', onClick: () => { setStep('selector'); setOpen(true); } }, 'Abrir movimiento'),
        React.createElement(window.RecordModal, {
          open, onClose: () => setOpen(false),
          onExitComplete: () => { if (!open) setStep('selector'); },
          title: step === 'form' ? 'Ingreso' : '¿Qué vas a registrar?',
          subtitle: step === 'form' ? 'Completa los datos del movimiento.' : 'Elige una operación.',
          widthClassName: 'max-w-[min(96vw,580px)]', presentation: 'workbench', motionSource: 'pointer',
          testId: 'record-modal',
        }, step === 'selector'
          ? React.createElement('div', { 'data-testid': 'operation-selector' },
              React.createElement('button', { id: 'choose', onClick: select }, 'Ingreso'))
          : React.createElement('div', { 'data-testid': 'income-form' },
              React.createElement('label', null, 'Monto', React.createElement('input', { value: '100.00', readOnly: true })),
              React.createElement('button', { id: 'cancel', onClick: () => setOpen(false) }, 'Cancelar'))));
    }
    const root = document.createElement('div');
    root.id = 'modal-harness-root';
    document.body.append(root);
    ReactDOM.createRoot(root).render(React.createElement(Harness));
  ` })
  await page.getByRole('button', { name: 'Abrir movimiento' }).waitFor()
}

async function openForm(page: import('@playwright/test').Page) {
  await page.locator('#launch').click()
  await page.locator('#choose').click()
  await expect(page.getByTestId('income-form')).toBeVisible()
}

async function assertFormStaysVisibleUntilExit(page: import('@playwright/test').Page, capture = false) {
  const overlay = page.locator('[data-ft-workbench-overlay]')
  await expect(overlay).toHaveAttribute('data-phase', 'closing')
  await expect(page.getByTestId('income-form')).toBeVisible()
  await expect(page.getByTestId('operation-selector')).toHaveCount(0)
  if (capture) {
    await page.screenshot({ path: '/private/tmp/fintrack-modal-closing-form.png' })
  }
  await expect(overlay).toHaveCount(0, { timeout: 1500 })
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('launch')
}

test('RecordModal keeps the selected form intact through Cancel, X, Escape, and outside-click exits', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await mount(page)
  const originalBodyOverflow = await page.evaluate(() => document.body.style.overflow)

  await openForm(page)
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')
  await page.evaluate(() => {
    const nativeAnimate = Element.prototype.animate
    Element.prototype.animate = function (keyframes, options) {
      const adjusted = typeof options === 'number'
        ? options * 3
        : (() => {
            const settings = options ?? {}
            const duration = settings.duration
            return {
              ...settings,
              duration: typeof duration === 'number' ? duration * 3 : 0,
            }
          })()
      return nativeAnimate.call(this, keyframes, adjusted)
    }
  })
  await page.locator('#cancel').click()
  await assertFormStaysVisibleUntilExit(page, true)
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe(originalBodyOverflow)

  await openForm(page)
  await page.getByRole('button', { name: 'Cerrar panel' }).click()
  await assertFormStaysVisibleUntilExit(page)

  await openForm(page)
  await page.keyboard.press('Escape')
  await assertFormStaysVisibleUntilExit(page)

  await openForm(page)
  await page.locator('[data-ft-workbench-veil]').click({ position: { x: 8, y: 8 } })
  await assertFormStaysVisibleUntilExit(page)
})

test('mobile reduced-motion workbench stays usable and resets only after its immediate exit', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' })
  await mount(page)
  await openForm(page)
  await page.locator('#cancel').click()
  await expect(page.locator('[data-ft-workbench-overlay]')).toHaveCount(0)
  await page.locator('#launch').click()
  await expect(page.getByTestId('operation-selector')).toBeVisible()
})
