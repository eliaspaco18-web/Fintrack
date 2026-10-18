import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'
import postcss from 'postcss'

const reactPath = join(process.cwd(), 'node_modules/react/umd/react.development.js')
const reactDomPath = join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js')

function transpileClientSource(path: string, prelude: string, exportExpression: string, sourceOverride?: string): string {
  const source = (sourceOverride ?? readFileSync(join(process.cwd(), path), 'utf8'))
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
  'const { useEffect, useLayoutEffect, useRef, useState } = window.React;',
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
    const { Children, isValidElement, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } = window.React;
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

function baselineSource(path: string): string {
  return execFileSync('git', ['show', `HEAD:${path}`], { cwd: process.cwd(), encoding: 'utf8' })
}

function presenceScriptFor(source: string): string {
  return transpileClientSource(
    'lib/ui/use-v3-workbench-presence.ts',
    'const { useEffect, useLayoutEffect, useRef, useState } = window.React;',
    'window.useV3WorkbenchPresence = useV3WorkbenchPresence;',
    source,
  )
}

function recordModalScriptFor(source: string): string {
  return transpileClientSource(
    'components/ui/RecordModal.tsx',
    `
      const { Children, isValidElement, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } = window.React;
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
    source,
  )
}

const editRecordHookScript = transpileClientSource(
  'components/forms/use-transaction-edit-record.ts',
  'const { useCallback, useEffect, useRef, useState } = window.React;',
  'window.useTransactionEditRecord = useTransactionEditRecord;',
)

function editModalScriptFor(source: string): string {
  return transpileClientSource(
    'components/forms/TransactionEditModal.tsx',
    `
      const { useCallback, useEffect, useMemo, useState } = window.React;
      const TransactionForm = window.SyntheticTransactionForm;
      const RecordModal = window.RecordModal;
      const Button = window.SyntheticButton;
      const FormActions = window.SyntheticFormActions;
      const InlineFeedback = props => window.React.createElement('div', { role: 'alert' }, props.message);
      const styles = window.syntheticEditStyles;
      const incomeStyles = { operationFormActions: 'synthetic-form-actions' };
      const getTransactionEditPresentation = () => ({ title: 'Editar egreso', blocked: false });
      const firstLinkedRecord = () => null;
      const inferOperationType = () => 'expense';
      const toInitialValues = transaction => ({ amount: transaction?.amount, description: transaction?.description });
      const useTransactionEditRecord = window.useTransactionEditRecord;
    `,
    'window.TransactionEditModal = TransactionEditModal;',
    source,
  )
}

function editSkeletonCss(): string {
  const source = postcss.parse(readFileSync(join(process.cwd(), 'components/tables/TransactionsRound07.module.css'), 'utf8'))
  const output = postcss.root()
  const names = ['editSkeletonContainer', 'editSkeleton', 'editSkeletonLarge', 'editSkeletonWide', 'editFormReveal']
  source.walkRules(rule => {
    const name = names.find(candidate => rule.selector.includes(`.${candidate}`))
    if (name) output.append(rule.clone({ selector: rule.selector.replace(/\.[\w-]+/g, match => names.includes(match.slice(1)) ? `.${match.slice(1)}` : match) }))
  })
  source.walkAtRules(rule => {
    if (rule.name === 'keyframes' && ['editSkeletonReveal', 'editFormReveal'].includes(rule.params)) output.append(rule.clone())
  })
  return output.toString()
}

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

async function mountMeasuredWorkbench(
  page: import('@playwright/test').Page,
  presenceSource: string,
  modalSource: string,
) {
  await page.goto('/login')
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: presenceScriptFor(presenceSource) })
  await page.addScriptTag({ content: focusTrapScript })
  await page.addScriptTag({ content: modalBackgroundScript })
  await page.addScriptTag({ content: recordModalScriptFor(modalSource) })
  await page.addStyleTag({ content: `
    .form-overlay.app-modal-overlay { font-family: Manrope, system-ui, sans-serif; }
    .form-overlay[data-ft-v3][data-ft-workbench-overlay] .ft-v3-workbench-wrapper {
      width: min(580px, calc(100vw - 24px)); max-width: min(580px, calc(100vw - 24px));
      height: calc(100dvh - 52px); margin: 40px 12px 12px auto;
    }
    .form-overlay[data-ft-v3][data-ft-workbench-overlay] [data-record-modal-body] {
      padding: 22px 24px 24px; scrollbar-gutter: stable;
    }
    @media(max-width:767px) {
      .form-overlay[data-ft-v3][data-ft-workbench-overlay] .ft-v3-workbench-wrapper {
        width: calc(100vw - 16px); max-width: calc(100vw - 16px); height: calc(100dvh - 16px); margin: 8px;
      }
      .form-overlay[data-ft-v3][data-ft-workbench-overlay] [data-record-modal-body] { padding: 20px 18px; scrollbar-gutter: auto; }
    }
  ` })
  await page.addScriptTag({ content: `
    window.transitionTelemetry = { animations: [], frames: [], sampling: false };
    const nativeAnimate = Element.prototype.animate;
    Element.prototype.animate = function (keyframes, options) {
      const result = nativeAnimate.call(this, keyframes, options);
      window.transitionTelemetry.animations.push({
        target: this.getAttribute('data-ft-workbench') || this.getAttribute('data-ft-workbench-veil') || this.className,
        duration: typeof options === 'number' ? options : options?.duration,
      });
      return result;
    };
    window.sampleTransitionFrames = () => {
      window.transitionTelemetry.sampling = true;
      const sample = () => {
        if (!window.transitionTelemetry.sampling) return;
        const overlay = document.querySelector('[data-ft-workbench-overlay]');
        const panel = document.querySelector('[data-ft-workbench]');
        const body = document.querySelector('[data-record-modal-body]');
        const panelRect = panel?.getBoundingClientRect();
        const bodyRect = body?.getBoundingClientRect();
        window.transitionTelemetry.frames.push({
          t: Number(performance.now().toFixed(2)), phase: overlay?.getAttribute('data-phase') ?? 'absent',
          panelX: panelRect ? Number(panelRect.x.toFixed(2)) : null,
          panelY: panelRect ? Number(panelRect.y.toFixed(2)) : null,
          panelWidth: panelRect ? Number(panelRect.width.toFixed(2)) : null,
          panelHeight: panelRect ? Number(panelRect.height.toFixed(2)) : null,
          offsetWidth: panel?.offsetWidth ?? null, offsetHeight: panel?.offsetHeight ?? null,
          bodyRelativeY: panelRect && bodyRect ? Number((bodyRect.y - panelRect.y).toFixed(2)) : null,
          bodyClientHeight: body?.clientHeight ?? null, bodyScrollHeight: body?.scrollHeight ?? null,
          selectorVisible: !!document.querySelector('[data-testid="operation-selector"]'),
          formVisible: !!document.querySelector('[data-testid="income-form"]'),
          bodyOverflow: getComputedStyle(document.body).overflow,
        });
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    };
    function Harness() {
      const [open, setOpen] = React.useState(false);
      const [step, setStep] = React.useState('selector');
      const finishExit = React.useCallback(() => { if (!open) setStep('selector'); }, [open]);
      const select = () => { setStep('form'); setOpen(true); };
      const form = React.createElement('div', { 'data-testid': 'income-form', style: { minHeight: '520px' } },
        React.createElement('label', null, 'Monto', React.createElement('input', { value: '100.00', readOnly: true })),
        React.createElement('div', { style: { height: '420px' } }, 'Contenido de formulario sintético'),
        React.createElement(window.RecordModalFooter, null, React.createElement('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px' } },
          React.createElement('button', { id: 'cancel', onClick: () => setOpen(false) }, 'Cancelar'),
          React.createElement('button', { id: 'save', disabled: true }, 'Guardar cambios'))));
      return React.createElement(React.Fragment, null,
        React.createElement('button', { id: 'launch', onClick: () => { setStep('selector'); setOpen(true); } }, 'Nuevo movimiento'),
        React.createElement(window.RecordModal, {
          open, onClose: () => setOpen(false), onExitComplete: finishExit,
          title: step === 'form' ? 'Ingreso' : '¿Qué vas a registrar?', subtitle: 'Prueba de continuidad',
          widthClassName: 'max-w-[min(96vw,580px)]', presentation: 'workbench', motionSource: 'pointer',
          overlayClassName: 'form-overlay', testId: 'continuity-modal',
        }, step === 'selector' ? React.createElement('div', { 'data-testid': 'operation-selector' },
          React.createElement('button', { id: 'choose', onClick: select }, 'Ingreso')) : form));
    }
    const root = document.createElement('div'); root.id = 'measured-modal-harness'; document.body.append(root);
    ReactDOM.createRoot(root).render(React.createElement(Harness));
  ` })
  await page.locator('#launch').waitFor()
}

async function mountMeasuredEditModal(page: import('@playwright/test').Page, modalSource: string, editModalSource: string) {
  const browserErrors: string[] = []
  page.on('pageerror', error => browserErrors.push(error.message))
  await page.goto('/login')
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: presenceScript })
  await page.addScriptTag({ content: focusTrapScript })
  await page.addScriptTag({ content: modalBackgroundScript })
  await page.addScriptTag({ content: recordModalScriptFor(modalSource) })
  await page.addScriptTag({ content: editRecordHookScript })
  await page.addStyleTag({ content: editSkeletonCss() })
  await page.addScriptTag({ content: `
    window.editLoadTelemetry = [];
    window.editResolve = null;
    window.fetch = () => new Promise(resolve => { window.editResolve = () => resolve({
      ok: true,
      json: async () => ({ ok: true, data: {
        id: 'synthetic-expense', type: 'EXPENSE', transaction_date: '2026-10-18', amount: 125, currency: 'PEN',
        description: 'Dato sintético para medir distribución', source_account_id: 'synthetic-account',
      } }),
    }) });
    window.SyntheticButton = props => React.createElement('button', {
      type: props.type || 'button', onClick: props.onClick, disabled: props.disabled,
      className: props.className, 'data-testid': props['data-testid'],
    }, props.children);
    window.SyntheticFormActions = props => React.createElement('div', {
      className: props.className, 'data-testid': 'edit-actions',
      style: { display: 'flex', justifyContent: 'flex-end', gap: 8, minHeight: 48 },
    }, props.secondaryAction, props.primaryAction);
    window.syntheticEditStyles = {
      formOverlay: 'form-overlay', editSkeletonContainer: 'editSkeletonContainer', editSkeleton: 'editSkeleton',
      editSkeletonLarge: 'editSkeletonLarge', editSkeletonWide: 'editSkeletonWide', editFormReveal: 'editFormReveal',
    };
    window.SyntheticTransactionForm = props => React.createElement('form', {
      className: props.className, 'data-testid': 'synthetic-transaction-form',
      style: { minHeight: 460, display: 'grid', alignContent: 'start', gap: 20 },
    },
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 132px', gap: 12 } },
        React.createElement('div', { className: 'editSkeleton' }), React.createElement('div', { className: 'editSkeleton' })),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
        React.createElement('div', { className: 'editSkeleton' }), React.createElement('div', { className: 'editSkeleton' })),
      React.createElement('div', { style: { height: 88 } }),
      React.createElement(window.RecordModalFooter, null,
        React.createElement(window.SyntheticFormActions, {
          secondaryAction: React.createElement('button', { type: 'button', onClick: props.onCancel }, 'Cancelar'),
          primaryAction: React.createElement('button', { type: 'submit' }, 'Guardar cambios'),
        })));
    window.startEditFrameSampling = () => {
      const sample = () => {
        const dialog = document.querySelector('[data-testid="transaction-edit-modal"]');
        const body = dialog?.querySelector('[data-record-modal-body]');
        const footer = body?.nextElementSibling;
        window.editLoadTelemetry.push({
          t: Number(performance.now().toFixed(1)),
          panelHeight: dialog ? Number(dialog.getBoundingClientRect().height.toFixed(2)) : null,
          panelOffsetHeight: dialog?.offsetHeight ?? null,
          bodyTop: body ? Number(body.getBoundingClientRect().top.toFixed(2)) : null,
          bodyClientHeight: body?.clientHeight ?? null,
          bodyScrollHeight: body?.scrollHeight ?? null,
          bodyScrollTop: body?.scrollTop ?? null,
          externalFooterHeight: footer ? Number(footer.getBoundingClientRect().height.toFixed(2)) : 0,
          skeletonVisible: document.querySelector('[data-testid="transaction-edit-skeleton"]')?.getAttribute('data-visible') === 'true',
          formVisible: !!document.querySelector('[data-testid="synthetic-transaction-form"]'),
          recordId: document.querySelector('[data-testid="transaction-edit-form"]')?.textContent?.includes('Registro anterior') ? 'stale' : 'current-or-loading',
        });
        if (window.editSampling) requestAnimationFrame(sample);
      };
      window.editSampling = true;
      requestAnimationFrame(sample);
    };
    function Harness() {
      const [open, setOpen] = React.useState(false);
      return React.createElement(React.Fragment, null,
        React.createElement('button', { id: 'launch-edit', onClick: () => setOpen(true) }, 'Editar egreso'),
        React.createElement(window.TransactionEditModal, {
          open, transactionId: open ? 'synthetic-expense' : null, options: {}, initialOperationType: 'expense',
          onClose: () => setOpen(false),
        }));
    }
    window.mountEditHarness = () => {
      const root = document.createElement('div'); document.body.append(root);
      ReactDOM.createRoot(root).render(React.createElement(Harness));
    };
  ` })
  await page.addScriptTag({ content: editModalScriptFor(editModalSource) })
  await page.evaluate(() => window.mountEditHarness())
  try {
    await page.locator('#launch-edit').waitFor({ timeout: 1500 })
  } catch {
    throw new Error(`Edit-modal harness did not mount: ${browserErrors.join(' | ') || 'no browser exception'}`)
  }
}

async function runMeasuredTransition(
  page: import('@playwright/test').Page,
  version: 'before' | 'after',
  width: number,
  outputDirectory?: string,
) {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
  await mountMeasuredWorkbench(
    page,
    version === 'before' ? baselineSource('lib/ui/use-v3-workbench-presence.ts') : readFileSync(join(process.cwd(), 'lib/ui/use-v3-workbench-presence.ts'), 'utf8'),
    version === 'before' ? baselineSource('components/ui/RecordModal.tsx') : readFileSync(join(process.cwd(), 'components/ui/RecordModal.tsx'), 'utf8'),
  )
  await page.evaluate(() => window.sampleTransitionFrames())
  await page.locator('#launch').click()
  await expect(page.getByTestId('operation-selector')).toBeVisible()
  await expect(page.locator('[data-ft-workbench-overlay]')).toHaveAttribute('data-phase', 'opening')
  for (const frameTime of [16, 88, 184, 280]) {
    await page.waitForTimeout(frameTime === 16 ? 16 : frameTime - (frameTime === 88 ? 16 : frameTime === 184 ? 88 : 184))
    if (outputDirectory) {
      await page.screenshot({ path: join(outputDirectory, `modal-${version}-${width}-open-${frameTime}ms.png`) })
    }
  }
  await expect(page.locator('[data-ft-workbench-overlay]')).toHaveAttribute('data-phase', 'open', { timeout: 600 })
  await page.locator('#choose').click()
  await expect(page.getByTestId('income-form')).toBeVisible()
  await page.locator('#cancel').click()
  await expect(page.locator('[data-ft-workbench-overlay]')).toHaveAttribute('data-phase', 'closing')
  await expect(page.getByTestId('income-form')).toBeVisible()
  await expect(page.getByTestId('operation-selector')).toHaveCount(0)
  await page.waitForTimeout(70)
  if (outputDirectory) {
    await page.screenshot({ path: join(outputDirectory, `modal-${version}-${width}-closing-70ms.png`) })
  }
  await expect(page.locator('[data-ft-workbench-overlay]')).toHaveCount(0, { timeout: 600 })
  await page.evaluate(() => { window.transitionTelemetry.sampling = false })
  const telemetry = await page.evaluate(() => ({
    animations: window.transitionTelemetry.animations,
    frames: window.transitionTelemetry.frames,
  }))
  return telemetry
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

test('before/after frame sampling confirms a single stable workbench transition at desktop and mobile sizes', async ({ page }, testInfo) => {
  const outputDirectory = process.env.FINTRACK_LAYOUT_EVIDENCE_DIR
  if (outputDirectory) mkdirSync(outputDirectory, { recursive: true })
  const results: Array<{
    width: number
    before: Awaited<ReturnType<typeof runMeasuredTransition>>
    after: Awaited<ReturnType<typeof runMeasuredTransition>>
  }> = []

  for (const width of [1710, 1440, 834, 390]) {
    const before = await runMeasuredTransition(page, 'before', width, outputDirectory)
    const after = await runMeasuredTransition(page, 'after', width, outputDirectory)
    results.push({ width, before, after })

    const panelHeights = after.frames
      .filter(frame => frame.phase === 'opening' || frame.phase === 'open' || frame.phase === 'closing')
      .map(frame => frame.offsetHeight)
    expect(new Set(panelHeights).size).toBeLessThanOrEqual(1)
    const bodyOffsets = after.frames.filter(frame => frame.phase === 'opening').map(frame => frame.bodyRelativeY)
    const bodyOffsetRange = range(bodyOffsets)
    console.log(`modal body offset range ${width}px: ${bodyOffsetRange.toFixed(2)}px`)
    expect(bodyOffsetRange).toBeLessThanOrEqual(2)
    expect(after.animations).toHaveLength(4)
    expect(after.frames.filter(frame => frame.phase === 'closing').every(frame => !frame.selectorVisible && frame.formVisible)).toBe(true)
    expect(after.frames.some(frame => frame.phase === 'absent' && !frame.formVisible && !frame.selectorVisible)).toBe(true)
  }

  const report = results.map(result => ({
    width: result.width,
    before: {
      animationCount: result.before.animations.length,
      openBodyOffsetRange: range(result.before.frames.filter(frame => frame.phase === 'opening').map(frame => frame.bodyRelativeY)),
      openPanelOffsetHeightRange: range(result.before.frames.filter(frame => frame.phase === 'opening').map(frame => frame.offsetHeight)),
      phases: [...new Set(result.before.frames.map(frame => frame.phase))],
    },
    after: {
      animationCount: result.after.animations.length,
      openBodyOffsetRange: range(result.after.frames.filter(frame => frame.phase === 'opening').map(frame => frame.bodyRelativeY)),
      openPanelOffsetHeightRange: range(result.after.frames.filter(frame => frame.phase === 'opening').map(frame => frame.offsetHeight)),
      phases: [...new Set(result.after.frames.map(frame => frame.phase))],
    },
  }))
  await testInfo.attach('modal-transition-before-after-measurements.json', { body: JSON.stringify(report, null, 2), contentType: 'application/json' })
  console.log(`modal transition before/after: ${JSON.stringify(report)}`)
})

test('edit loading keeps the panel and action area stable until the complete record is ready', async ({ page }, testInfo) => {
  const outputDirectory = process.env.FINTRACK_LAYOUT_EVIDENCE_DIR
  if (outputDirectory) mkdirSync(outputDirectory, { recursive: true })
  const measurements: Array<{ version: 'before' | 'after'; samples: Window['editLoadTelemetry'] }> = []

  for (const version of ['before', 'after'] as const) {
    await page.setViewportSize({ width: 1440, height: 900 })
    await mountMeasuredEditModal(
      page,
      readFileSync(join(process.cwd(), 'components/ui/RecordModal.tsx'), 'utf8'),
      version === 'before'
        ? baselineSource('components/forms/TransactionEditModal.tsx')
        : readFileSync(join(process.cwd(), 'components/forms/TransactionEditModal.tsx'), 'utf8'),
    )
    await page.evaluate(() => window.startEditFrameSampling())
    await page.locator('#launch-edit').click()
    await page.waitForFunction(() => Boolean(window.editResolve))
    await page.waitForTimeout(300)
    if (outputDirectory) {
      await page.screenshot({ path: join(outputDirectory, `edit-${version}-loading-300ms.png`) })
    }
    await page.evaluate(() => window.editResolve?.())
    await expect(page.getByTestId('synthetic-transaction-form')).toBeVisible()
    await page.waitForTimeout(180)
    if (outputDirectory) {
      await page.screenshot({ path: join(outputDirectory, `edit-${version}-loaded.png`) })
    }
    const samples = await page.evaluate(() => {
      window.editSampling = false
      return window.editLoadTelemetry
    })
    measurements.push({ version, samples })
  }

  const report = measurements.map(({ version, samples }) => {
    const loading = samples.filter(sample => sample.t > 0 && !sample.formVisible)
    const loaded = samples.filter(sample => sample.formVisible)
    return {
      version,
      transformedPanelHeightRange: range(samples.map(sample => sample.panelHeight)),
      panelLayoutHeightRange: range(samples.map(sample => sample.panelOffsetHeight)),
      bodyClientHeightRange: range(samples.map(sample => sample.bodyClientHeight)),
      loadingBodyScrollHeight: loading.at(-1)?.bodyScrollHeight ?? null,
      loadedBodyScrollHeight: loaded[0]?.bodyScrollHeight ?? null,
      loadingExternalFooterHeight: loading.at(-1)?.externalFooterHeight ?? null,
      loadedExternalFooterHeight: loaded[0]?.externalFooterHeight ?? null,
      staleRecordExposure: samples.some(sample => sample.recordId === 'stale'),
      sampleCount: samples.length,
    }
  })
  await testInfo.attach('edit-load-before-after-measurements.json', { body: JSON.stringify(report, null, 2), contentType: 'application/json' })
  console.log(`edit load before/after: ${JSON.stringify(report)}`)

  const candidate = report.find(result => result.version === 'after')!
  expect(candidate.panelLayoutHeightRange).toBeLessThanOrEqual(1)
  expect(candidate.bodyClientHeightRange).toBeLessThanOrEqual(1)
  expect(candidate.loadingExternalFooterHeight).toBe(candidate.loadedExternalFooterHeight)
  expect(candidate.staleRecordExposure).toBe(false)
})

function range(values: Array<number | null>): number {
  const finite = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (finite.length === 0) return 0
  return Math.max(...finite) - Math.min(...finite)
}

declare global {
  interface Window {
    transitionTelemetry: {
      animations: Array<{ target: string; duration?: number }>
      frames: Array<{
        t: number
        phase: string
        panelX: number | null
        panelY: number | null
        panelWidth: number | null
        panelHeight: number | null
        offsetWidth: number | null
        offsetHeight: number | null
        bodyRelativeY: number | null
        bodyClientHeight: number | null
        bodyScrollHeight: number | null
        selectorVisible: boolean
        formVisible: boolean
        bodyOverflow: string
      }>
      sampling: boolean
    }
    sampleTransitionFrames: () => void
    editLoadTelemetry: Array<{
      t: number
      panelHeight: number | null
      panelOffsetHeight: number | null
      bodyTop: number | null
      bodyClientHeight: number | null
      bodyScrollHeight: number | null
      bodyScrollTop: number | null
      externalFooterHeight: number
      skeletonVisible: boolean
      formVisible: boolean
      recordId: string
    }>
    editResolve: (() => void) | null
    editSampling: boolean
    startEditFrameSampling: () => void
    mountEditHarness: () => void
  }
}
