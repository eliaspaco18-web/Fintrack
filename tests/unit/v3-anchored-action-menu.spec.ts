import { expect, test } from '@playwright/test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

const reactPath = join(process.cwd(), 'node_modules/react/umd/react.development.js')
const reactDomPath = join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js')

function menuSource(): string {
  const source = readFileSync(join(process.cwd(), 'components/ui/AnchoredActionMenu.tsx'), 'utf8')
    .replace(/^'use client'\s*/, '')
    .replace(/import \* as React from 'react'/, '')
    .replace(/import\s*\{[\s\S]*?\}\s*from 'react'/,
      'const React = window.React; const { useCallback, useEffect, useId, useRef, useState } = React')
    .replace(/import \{ createPortal \} from 'react-dom'/, 'const { createPortal } = window.ReactDOM')
    .replace(/export interface /g, 'interface ')
    .replace(/export function /g, 'function ')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React },
  }).outputText
  return `${compiled}\nwindow.FinTrackActionMenu = AnchoredActionMenu;`
}

async function mount(page: import('@playwright/test').Page, insideDialog = false) {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setContent('<style>.ft-v3-action-menu-item{display:block;height:44px}</style><div id="root" data-ft-v3=""></div>')
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: menuSource() })
  await page.addScriptTag({ content: `
    window.selectedActions = [];
    function Harness() {
      const menu = React.createElement(window.FinTrackActionMenu, {
        label: 'Acciones',
        actions: [
          { id: 'inspect', label: 'Ver detalle', onSelect: () => window.selectedActions.push('inspect') },
          { id: 'blocked', label: 'No disponible', disabled: true, onSelect: () => window.selectedActions.push('blocked') },
          { id: 'edit', label: 'Editar', detail: 'Conservar ID', onSelect: () => window.selectedActions.push('edit') },
          { id: 'delete', label: 'Eliminar', destructive: true, onSelect: () => window.selectedActions.push('delete') },
        ],
      });
      const controls = React.createElement(React.Fragment, null,
        React.createElement('button', { id: 'before' }, 'Anterior'), menu,
        React.createElement('button', { id: 'after' }, 'Siguiente'));
      return ${insideDialog
        ? `React.createElement('div', { role: 'dialog', 'aria-label': 'Registro', style: {
            position: 'fixed', top: '270px', right: '8px', width: '280px', height: '170px',
          } }, controls)`
        : 'controls'};
    }
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
  ` })
  try {
    await page.getByRole('button', { name: 'Acciones' }).waitFor({ timeout: 1500 })
  } catch {
    throw new Error(`Action menu harness did not mount: ${errors.join(' | ') || 'no browser exception'}`)
  }
}

test('keyboard menu keeps exact actions, skips disabled rows, restores focus and tabs locally', async ({ page }) => {
  await mount(page)
  if (process.env.V3_CAPTURE_MENU === '1') {
    const cssDirectory = join(process.cwd(), '.next/static/css')
    const cssName = readdirSync(cssDirectory, { recursive: true }).map(String).find(name => name.endsWith('.css') &&
      readFileSync(join(cssDirectory, name), 'utf8').includes('ft-v3-action-menu-enter'))
    if (!cssName) throw new Error('Build V3 CSS before capturing the action menu')
    await page.addStyleTag({ content: readFileSync(join(cssDirectory, cssName), 'utf8') })
    await page.addStyleTag({ content: '#root{width:360px;margin:80px 0 0 48px}' })
  }
  const trigger = page.getByRole('button', { name: 'Acciones' })
  await trigger.focus()
  await trigger.press('ArrowDown')
  const menu = page.getByRole('menu', { name: 'Acciones' })
  await expect(menu).toBeVisible()
  if (process.env.V3_CAPTURE_MENU === '1') {
    await page.waitForTimeout(180)
    await page.screenshot({ path: join(process.cwd(), 'docs/redesign-v3/implementation/stage4-action-menu-light.png') })
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
    await expect.poll(() => menu.evaluate(element => ({
      v3: element.hasAttribute('data-ft-v3'),
      surface: getComputedStyle(element).getPropertyValue('--ft-surface').trim(),
      background: getComputedStyle(element).backgroundColor,
    }))).toEqual({ v3: true, surface: '#202327', background: 'rgb(32, 35, 39)' })
    await expect.poll(() => page.getByRole('menuitem', { name: /Editar/ }).evaluate(element =>
      getComputedStyle(element).color)).toBe('rgb(237, 240, 242)')
    await page.screenshot({ path: join(process.cwd(), 'docs/redesign-v3/implementation/stage4-action-menu-dark.png') })
  }
  await expect(page.getByRole('menuitem', { name: 'Ver detalle' })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('menuitem', { name: /Editar/ })).toBeFocused()
  await page.keyboard.press('End')
  await expect(page.getByRole('menuitem', { name: 'Eliminar' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(trigger).toBeFocused()

  await trigger.press('ArrowDown')
  await expect(page.getByRole('menuitem', { name: 'Ver detalle' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.locator('#after')).toBeFocused()
  await expect(menu).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'selectedActions'))).toEqual([])
})

test('popover flips and clamps inside its owning dialog, preserving action identity', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 450 })
  await mount(page, true)
  const trigger = page.getByRole('button', { name: 'Acciones' })
  await trigger.click()
  const menu = page.getByRole('menu', { name: 'Acciones' })
  await expect(menu).toBeVisible()
  expect(await menu.evaluate(element => element.parentElement?.getAttribute('aria-label'))).toBe('Registro')
  const triggerBox = await trigger.boundingBox()
  const menuBox = await menu.boundingBox()
  expect(triggerBox).not.toBeNull()
  expect(menuBox).not.toBeNull()
  expect(menuBox!.y).toBeLessThan(triggerBox!.y)
  expect(menuBox!.x).toBeGreaterThanOrEqual(12)
  expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(378)
  await page.getByRole('menuitem', { name: /Editar/ }).click()
  expect(await page.evaluate(() => Reflect.get(window, 'selectedActions'))).toEqual(['edit'])
})

test('pointer exit is interruptible and reduced motion/keyboard exit is immediate', async ({ page }) => {
  await page.clock.install()
  await mount(page)
  const trigger = page.getByRole('button', { name: 'Acciones' })
  await trigger.click()
  await page.getByRole('menuitem', { name: 'Ver detalle' }).click()
  await expect(page.locator('.ft-v3-action-menu[data-motion="exit"]')).toHaveCount(1)
  await trigger.click()
  await page.clock.runFor(120)
  await expect(page.getByRole('menu', { name: 'Acciones' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Ver detalle' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await trigger.click()
  await page.getByRole('menuitem', { name: 'Eliminar' }).click()
  await expect(page.getByRole('menu')).toHaveCount(0)
  expect(await page.evaluate(() => Reflect.get(window, 'selectedActions'))).toEqual(['inspect', 'delete'])
})

test('Registrar opt-ins group existing actions and leave pointer focus at the trigger', async ({ page }) => {
  await page.setContent('<style>.ft-v3-action-menu-item{display:block;height:44px}</style><div id="root"></div>')
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: menuSource() })
  await page.addScriptTag({ content: `
    function Harness() {
      return React.createElement(React.Fragment, null,
        React.createElement(window.FinTrackActionMenu, {
          label: 'Registrar', focusFirstOnPointer: false, dismissOnFocusExit: true,
          renderTriggerContent: open => open ? 'Cerrar' : 'Abrir',
          actions: [
            { id: 'expense', label: 'Egreso', groupLabel: 'Movimiento', onSelect: () => {} },
            { id: 'income', label: 'Ingreso', onSelect: () => {} },
            { id: 'pay', label: 'Registrar pago', groupLabel: 'Compromisos', onSelect: () => {} },
          ],
        }),
        React.createElement('button', { id: 'next' }, 'Siguiente'));
    }
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
  ` })
  const trigger = page.getByRole('button', { name: 'Registrar' })
  await trigger.click()
  await expect(page.getByRole('menu', { name: 'Registrar' })).toBeVisible()
  await expect(trigger).toBeFocused()
  await expect(page.locator('.ft-v3-action-menu-group')).toHaveText(['Movimiento', 'Compromisos'])
  await trigger.press('Tab')
  await expect(page.locator('#next')).toBeFocused()
  await expect(page.getByRole('menu')).toHaveCount(0)
})
