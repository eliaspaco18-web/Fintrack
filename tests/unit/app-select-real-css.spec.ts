import { expect, test } from '@playwright/test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

const componentPath = join(process.cwd(), 'components/ui/AppSelect.tsx')
const reactPath = join(process.cwd(), 'node_modules/react/umd/react.development.js')
const reactDomPath = join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js')
const cssDirectory = join(process.cwd(), '.next/static/css')
function v3FontToken(css: string): string {
  const match = css.match(/\.__variable_[^{}]+\{--font-fintrack-v3:([^}]+)\}/)
  if (!match?.[1]) throw new Error('Could not find Next local Manrope variable token in built CSS')
  return match[1]
}

function v3FontFamily(css: string): string {
  const match = v3FontToken(css).match(/"([^"]+)"/)
  if (!match?.[1]) throw new Error('Could not find Next local Manrope family name in built CSS')
  return match[1]
}

function v3Document(content: string, css: string, theme: 'light' | 'dark' = 'light'): string {
  // RootLayout puts next/font/local's --font-fintrack-v3 token on body. The
  // portaled menu is attached to body, so omitting that token falsely made it
  // fall back to the legacy Geist stack in this CSS harness.
  const fontToken = v3FontToken(css).replaceAll('"', '&quot;')
  return `<html data-theme="${theme}"><head><base href="http://fintrack.test/"></head><body class="font-body antialiased" style="--font-fintrack-v3:${fontToken}">${content}</body></html>`
}

async function routeV3FontAssets(page: import('@playwright/test').Page) {
  const generatedMedia = new Set(readdirSync(join(process.cwd(), '.next/static/media')))
  await page.route('http://fintrack.test/**', async route => {
    const pathname = new URL(route.request().url()).pathname
    const publicFont = pathname.match(/^\/fonts\/v3\/(manrope-(?:regular|semibold|bold)\.ttf)$/)
    const nextFont = pathname.match(/^\/_next\/static\/media\/([A-Za-z0-9._-]+)$/)
    const file = publicFont?.[1]
      ? join(process.cwd(), 'public/fonts/v3', publicFont[1])
      : nextFont?.[1] && generatedMedia.has(nextFont[1])
        ? join(process.cwd(), '.next/static/media', nextFont[1])
        : null
    if (!file) return route.abort()
    await route.fulfill({
      body: readFileSync(file),
      contentType: 'font/ttf',
      headers: { 'access-control-allow-origin': '*' },
    })
  })
}

function builtCss(): string {
  const files = readdirSync(cssDirectory).filter(file => file.endsWith('.css')).sort()
  if (files.length === 0) throw new Error('Build the application before running real-CSS selector integration tests')
  return files.map(file => readFileSync(join(cssDirectory, file), 'utf8')).join('\n')
}

function moduleClass(css: string, localName: string): string {
  const match = css.match(new RegExp(`([A-Za-z0-9_-]*_${localName}__[A-Za-z0-9_-]+)`))
  if (!match?.[1]) throw new Error(`Could not find the built CSS-module class for ${localName}`)
  return match[1]
}

function browserComponentSource(): string {
  const source = readFileSync(componentPath, 'utf8')
    .replace(/^'use client'\s*/, '')
    .replace(/import\s*\{[\s\S]*?\}\s*from 'react'/, 'const React = window.React; const { useCallback, useEffect, useId, useMemo, useRef, useState } = React')
    .replace(/import \{ createPortal \} from 'react-dom'/, 'const { createPortal } = window.ReactDOM')
    .replace(/export type /g, 'type ')
    .replace(/export function /g, 'function ')
  return `(() => { ${ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React },
  }).outputText}\nwindow.FinTrackTestAppSelect = AppSelect; })();`
}

async function preparePage(page: import('@playwright/test').Page, css: string) {
  page.on('pageerror', error => console.log('AppSelect browser error:', error.message))
  page.on('console', message => { if (message.type() === 'error') console.log('AppSelect console error:', message.text()) })
  await routeV3FontAssets(page)
  await page.setContent(v3Document('<div id="root" class="fin-shell" data-ft-v3 data-ft-v3-shell></div>', css))
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: browserComponentSource() })
  await page.evaluate(async family => {
    await Promise.all([document.fonts.load('500 13px Manrope'), document.fonts.load(`500 13px "${family}"`)])
    await document.fonts.ready
  }, v3FontFamily(css))
}

test('portfolio filter menus render at trigger width with built V3 CSS and body portal', async ({ page }) => {
  const css = builtCss()
  const classes = {
    controls: moduleClass(css, 'controls'),
    bar: moduleClass(css, 'portfolioFilterBar'),
    filter: moduleClass(css, 'portfolioFilter'),
    currency: moduleClass(css, 'portfolioFilterCurrency'),
    type: moduleClass(css, 'portfolioFilterType'),
    institution: moduleClass(css, 'portfolioFilterInstitution'),
  }

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 834, height: 900 },
    { width: 1440, height: 900 },
    { width: 1710, height: 1000 },
  ]) {
    await page.setViewportSize(viewport)
    await preparePage(page, css)
    await page.addScriptTag({ content: `(() => {
      const classes = ${JSON.stringify(classes)};
      const definitions = [
        { id: 'portfolio-currency-filter', label: 'Moneda', className: classes.currency, value: 'PEN', options: [
          { value: 'PEN', label: 'PEN' }, { value: 'USD', label: 'USD' },
        ] },
        { id: 'portfolio-type-filter', label: 'Tipo', className: classes.type, value: 'CHECKING', options: [
          { value: 'CHECKING', label: 'Cuenta corriente con una denominación extensa para probar truncado' },
          { value: 'SAVINGS', label: 'Cuenta ahorros' },
        ] },
        { id: 'portfolio-institution-filter', label: 'Institución', className: classes.institution, value: 'all', options: [
          { value: 'all', label: 'Todas' }, { value: 'long', label: 'Institución financiera con nombre suficientemente largo para medir geometría' },
        ] },
      ];
      function Harness() {
        const [values, setValues] = React.useState(Object.fromEntries(definitions.map(item => [item.id, item.value])));
        return React.createElement('div', { className: classes.controls + ' ' + classes.bar + ' min-w-0', id: 'portfolio-toolbar' },
          ...definitions.map(item => React.createElement(window.FinTrackTestAppSelect, {
            key: item.id, options: item.options, value: values[item.id], onChange: value => setValues(current => ({ ...current, [item.id]: value })),
            ariaLabel: item.label, compact: true, matchTriggerWidth: true,
            className: classes.filter + ' ' + item.className + ' filters-control', testId: item.id,
            searchPlaceholder: 'Buscar ' + item.label.toLowerCase() + '…',
          }))
        );
      }
      ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
    })();` })

    for (const filter of [
      { id: 'portfolio-currency-filter', label: 'Moneda', longOption: false },
      { id: 'portfolio-type-filter', label: 'Tipo', longOption: true },
      { id: 'portfolio-institution-filter', label: 'Institución', longOption: true },
    ]) {
      const trigger = page.getByTestId(filter.id)
      await trigger.click()
      const menu = page.getByRole('dialog', { name: filter.label })
      await expect(menu).toBeVisible()
      await expect(page.getByRole('combobox', { name: filter.label })).toBeVisible()
      await page.waitForTimeout(500)

      const beforeFix = await menu.evaluate(element => {
        element.classList.remove('app-select-menu-match-trigger-width')
        const rect = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        return { width: rect.width, minWidth: style.minWidth, right: rect.right }
      })
      await menu.evaluate(element => element.classList.add('app-select-menu-match-trigger-width'))

      const measured = await page.evaluate(() => {
        const menuElement = document.querySelector<HTMLElement>('.app-select-menu')
        const triggerElement = document.querySelector<HTMLElement>('[aria-expanded="true"]')
        const selectElement = triggerElement?.closest<HTMLElement>('.app-select')
        if (!menuElement || !triggerElement) throw new Error('Expected an open AppSelect trigger and its menu')
        const menuRect = menuElement.getBoundingClientRect()
        const triggerRect = triggerElement.getBoundingClientRect()
        const menuStyle = getComputedStyle(menuElement)
        return {
          triggerWidth: triggerRect.width,
          triggerLeft: triggerRect.left,
          selectWidth: selectElement?.getBoundingClientRect().width,
          selectClasses: selectElement?.className,
          selectParentClasses: selectElement?.parentElement?.className,
          menuWidth: menuRect.width,
          left: menuRect.left,
          right: menuRect.right,
          viewportWidth: window.innerWidth,
          minWidth: menuStyle.minWidth,
          cssWidth: menuStyle.width,
          maxWidth: menuStyle.maxWidth,
          parentIsBody: menuElement.parentElement === document.body,
        }
      })

      console.log(`AppSelect ${filter.label} ${viewport.width}px`, JSON.stringify({ beforeFix, afterFix: measured }))
      expect(beforeFix.minWidth).toBe('100%')
      expect(beforeFix.width).toBeGreaterThan(measured.triggerWidth + 2)
      expect(Math.abs(measured.menuWidth - measured.triggerWidth), `${filter.label} at ${viewport.width}px: ${JSON.stringify(measured)}`).toBeLessThanOrEqual(2)
      expect(measured.minWidth).toBe('0px')
      expect(Number.parseFloat(measured.cssWidth)).toBeCloseTo(measured.triggerWidth, 0)
      expect(Number.parseFloat(measured.maxWidth)).toBeLessThanOrEqual(measured.triggerWidth + 0.5)
      expect(measured.left).toBeGreaterThanOrEqual(0)
      expect(measured.right).toBeLessThanOrEqual(measured.viewportWidth)
      expect(measured.left).toBeCloseTo(Math.max(8, Math.min(measured.triggerLeft, measured.viewportWidth - measured.menuWidth - 8)), 0)
      expect(measured.parentIsBody).toBe(true)

      if (filter.longOption) {
        const longLabel = menu.locator('.app-select-option-label').first()
        await expect(longLabel).toHaveCSS('text-overflow', 'ellipsis')
        await expect(longLabel).toHaveCSS('overflow', 'hidden')
      }

      const search = page.getByRole('combobox', { name: filter.label })
      await search.press('Escape')
      await expect(menu).toHaveCount(0)
      await expect(trigger).toBeFocused()
    }
  }
})

test('adaptive portfolio menus size from rendered option text and remain capped within the viewport', async ({ page }) => {
  const css = builtCss()
  const classes = {
    controls: moduleClass(css, 'controls'),
    bar: moduleClass(css, 'portfolioFilterBar'),
    filter: moduleClass(css, 'portfolioFilter'),
    currency: moduleClass(css, 'portfolioFilterCurrency'),
    type: moduleClass(css, 'portfolioFilterType'),
    institution: moduleClass(css, 'portfolioFilterInstitution'),
  }

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 834, height: 900 },
    { width: 1440, height: 900 },
    { width: 1710, height: 1000 },
  ]) {
    await page.setViewportSize(viewport)
    await preparePage(page, css)
    await page.locator('html').evaluate((element, dark) => {
      if (dark) element.setAttribute('data-theme', 'dark')
      else element.removeAttribute('data-theme')
    }, viewport.width === 390)
    await page.addScriptTag({ content: `(() => {
      const classes = ${JSON.stringify(classes)};
      const definitions = [
        { id: 'adaptive-currency', label: 'Moneda', className: classes.currency, value: 'PEN', options: [
          { value: 'PEN', label: 'PEN' }, { value: 'USD', label: 'USD' },
        ] },
        { id: 'adaptive-type', label: 'Tipo', className: classes.type, value: 'CHECKING', options: [
          { value: 'CHECKING', label: 'Cuenta corriente para empresas' }, { value: 'SAVINGS', label: 'Cuenta de ahorro' },
        ] },
        { id: 'adaptive-institution', label: 'Institución', className: classes.institution, value: 'all', options: [
          { value: 'all', label: 'Todas' },
          { value: 'medium', label: 'Caja Municipal de Arequipa' },
          { value: 'long', label: 'Cooperativa Financiera de Ahorro y Crédito con denominación extensa' },
        ] },
      ];
      function Harness() {
        const [values, setValues] = React.useState(Object.fromEntries(definitions.map(item => [item.id, item.value])));
        return React.createElement('div', { className: classes.controls + ' ' + classes.bar + ' min-w-0' },
          ...definitions.map(item => React.createElement(window.FinTrackTestAppSelect, {
            key: item.id, options: item.options, value: values[item.id], onChange: value => setValues(current => ({ ...current, [item.id]: value })),
            ariaLabel: item.label, compact: true, adaptiveMenuWidth: true,
            className: classes.filter + ' ' + item.className + ' filters-control', testId: item.id,
            searchPlaceholder: 'Buscar ' + item.label.toLowerCase() + '…',
          }))
        );
      }
      ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
    })();` })

    for (const filter of [
      { id: 'adaptive-currency', label: 'Moneda', expectedExpansion: false, capped: false },
      { id: 'adaptive-type', label: 'Tipo', expectedExpansion: true, capped: false },
      { id: 'adaptive-institution', label: 'Institución', expectedExpansion: true, capped: true },
    ]) {
      const trigger = page.getByTestId(filter.id)
      await trigger.click()
      const menu = page.getByRole('dialog', { name: filter.label })
      await expect(menu).toBeVisible()
      await page.waitForTimeout(500)
      const dimensions = await page.evaluate(() => {
        const menuElement = document.querySelector<HTMLElement>('.app-select-menu')!
        const triggerElement = document.querySelector<HTMLElement>('[aria-expanded="true"]')!
        const triggerRect = triggerElement.getBoundingClientRect()
        const menuRect = menuElement.getBoundingClientRect()
        const style = getComputedStyle(menuElement)
        return {
          triggerWidth: triggerRect.width,
          triggerLeft: triggerRect.left,
          menuWidth: menuRect.width,
          left: menuRect.left,
          right: menuRect.right,
          viewportWidth: innerWidth,
          cssWidth: style.width,
          minWidth: style.minWidth,
          maxWidth: style.maxWidth,
          background: style.backgroundColor,
        }
      })
      console.log(`Adaptive AppSelect ${filter.label} ${viewport.width}px`, JSON.stringify(dimensions))
      expect(dimensions.menuWidth).toBeGreaterThanOrEqual(dimensions.triggerWidth - 0.5)
      expect(dimensions.menuWidth).toBeLessThanOrEqual(296)
      expect(dimensions.menuWidth).toBeLessThanOrEqual(dimensions.viewportWidth - 16)
      expect(dimensions.left).toBeGreaterThanOrEqual(0)
      expect(dimensions.right).toBeLessThanOrEqual(dimensions.viewportWidth)
      expect(dimensions.minWidth).toBe('0px')
      expect(dimensions.background).not.toBe('rgba(0, 0, 0, 0)')
      expect(Math.abs(Number.parseFloat(dimensions.cssWidth) - dimensions.menuWidth)).toBeLessThanOrEqual(1.5)
      expect(Math.abs(Number.parseFloat(dimensions.maxWidth) - dimensions.menuWidth)).toBeLessThanOrEqual(1.5)
      if (filter.expectedExpansion) expect(dimensions.menuWidth).toBeGreaterThan(dimensions.triggerWidth + 1)
      if (!filter.expectedExpansion) expect(Math.abs(dimensions.menuWidth - dimensions.triggerWidth)).toBeLessThanOrEqual(2)
      if (filter.capped) {
        expect(dimensions.menuWidth).toBeCloseTo(296, 0)
        await expect(menu.locator('.app-select-option-label').last()).toHaveCSS('text-overflow', 'ellipsis')
      }

      const search = page.getByRole('combobox', { name: filter.label })
      if (filter.id === 'adaptive-type') {
        await search.press('ArrowDown')
        await search.press('Enter')
        await expect(trigger).toContainText('Cuenta de ahorro')
      } else {
        await search.press('Escape')
        await expect(menu).toHaveCount(0)
        await expect(trigger).toBeFocused()
      }
    }
  }
})

test('adaptive institution menu shows medium labels completely and truncates only over-limit labels', async ({ page }) => {
  const css = builtCss()
  const classes = {
    controls: moduleClass(css, 'controls'),
    bar: moduleClass(css, 'portfolioFilterBar'),
    filter: moduleClass(css, 'portfolioFilter'),
    institution: moduleClass(css, 'portfolioFilterInstitution'),
    workspace: moduleClass(css, 'workspace'),
  }

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 834, height: 900 },
    { width: 1440, height: 900 },
    { width: 1710, height: 1000 },
  ]) {
    await page.setViewportSize(viewport)
    await preparePage(page, css)
    await page.locator('#root').evaluate((element, workspaceClass) => element.classList.add(workspaceClass), classes.workspace)
    await page.addScriptTag({ content: `(() => {
      const classes = ${JSON.stringify(classes)};
      const mediumLabel = 'Banco Andino Round 07';
      function Harness() {
        const [options, setOptions] = React.useState([
          { value: 'all', label: 'Todas' },
          { value: 'andino', label: mediumLabel },
        ]);
        const [value, setValue] = React.useState('all');
        window.setInstitutionOptions = setOptions;
        window.setInstitutionValue = setValue;
        return React.createElement('div', { className: classes.controls + ' ' + classes.bar + ' min-w-0' },
          React.createElement(window.FinTrackTestAppSelect, {
            options, value, onChange: setValue, ariaLabel: 'Institución', compact: true,
            adaptiveMenuWidth: true, className: classes.filter + ' ' + classes.institution + ' filters-control',
            testId: 'institution-dynamic-width', searchPlaceholder: 'Buscar institución…',
          })
        );
      }
      ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
    })();` })

    const trigger = page.getByTestId('institution-dynamic-width')
    await trigger.click()
    const menu = page.getByRole('dialog', { name: 'Institución' })
    await expect(menu).toBeVisible()
    await page.waitForTimeout(300)

    const medium = await page.evaluate(() => {
      const menuElement = document.querySelector<HTMLElement>('.app-select-menu')!
      const triggerElement = document.querySelector<HTMLElement>('[data-testid="institution-dynamic-width"]')!
      const label = [...menuElement.querySelectorAll<HTMLElement>('.app-select-option-label')]
        .find(element => element.textContent?.trim() === 'Banco Andino Round 07')!
      const labelStyle = getComputedStyle(label)
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')!
      context.font = labelStyle.font
      const naturalCanvasWidth = context.measureText(label.textContent ?? '').width
      const range = document.createRange()
      range.selectNodeContents(label)
      const textRect = range.getBoundingClientRect()
      const effectiveFontFamily = labelStyle.fontFamily.split(',')[0]?.replaceAll('"', '') ?? labelStyle.fontFamily
      const menuRect = menuElement.getBoundingClientRect()
      const triggerRect = triggerElement.getBoundingClientRect()
      const menuStyle = getComputedStyle(menuElement)
      const triggerLabelStyle = getComputedStyle(triggerElement.querySelector<HTMLElement>('.app-select-trigger-label')!)
      const optionStyle = getComputedStyle(menuElement.querySelector<HTMLElement>('.app-select-option')!)
      return {
        triggerWidth: triggerRect.width,
        menuWidth: menuRect.width,
        menuCssWidth: menuStyle.width,
        menuLeft: menuRect.left,
        menuRight: menuRect.right,
        menuBorderWidth: menuStyle.borderLeftWidth,
        optionPadding: optionStyle.paddingLeft,
        menuHasV3Layer: menuElement.hasAttribute('data-ft-v3'),
        triggerFontFamily: getComputedStyle(triggerElement).fontFamily,
        triggerLabelFontFamily: triggerLabelStyle.fontFamily,
        triggerLabelFontSize: triggerLabelStyle.fontSize,
        triggerLabelFontWeight: triggerLabelStyle.fontWeight,
        triggerLabelColor: triggerLabelStyle.color,
        menuFontFamily: getComputedStyle(menuElement).fontFamily,
        menuFontSize: menuStyle.fontSize,
        menuFontWeight: menuStyle.fontWeight,
        menuColor: menuStyle.color,
        menuSmoothing: menuStyle.getPropertyValue('-webkit-font-smoothing'),
        naturalCanvasWidth,
        labelClientWidth: label.clientWidth,
        labelScrollWidth: label.scrollWidth,
        textRectWidth: textRect.width,
        font: labelStyle.font,
        fontFamily: labelStyle.fontFamily,
        fontSize: labelStyle.fontSize,
        fontWeight: labelStyle.fontWeight,
        color: labelStyle.color,
        smoothing: labelStyle.getPropertyValue('-webkit-font-smoothing'),
        fontLoaded: document.fonts.check(`500 13px ${effectiveFontFamily}`),
        bodyFontToken: getComputedStyle(document.body).getPropertyValue('--font-fintrack-v3').trim(),
        textOverflow: labelStyle.textOverflow,
      }
    })
    console.log(`Banco Andino medium option ${viewport.width}px`, JSON.stringify(medium))
    expect(medium.menuWidth).toBeGreaterThanOrEqual(medium.triggerWidth - 0.5)
    expect(medium.menuWidth).toBeLessThanOrEqual(296)
    expect(medium.menuRight).toBeLessThanOrEqual(viewport.width)
    expect(Number.parseFloat(medium.menuCssWidth)).toBeGreaterThanOrEqual(medium.naturalCanvasWidth + 26)
    expect(medium.labelScrollWidth).toBeLessThanOrEqual(medium.labelClientWidth + 1)
    expect(medium.textOverflow).toBe('ellipsis')
    expect(medium.bodyFontToken).toContain('__fintrackV3Font_')
    expect(medium.triggerLabelFontFamily).toContain('__fintrackV3Font_')
    expect(medium.triggerLabelFontFamily).toBe(medium.menuFontFamily)
    expect(medium.menuFontFamily).toContain('__fintrackV3Font_')
    expect(medium.fontFamily).toBe(medium.menuFontFamily)
    expect(medium.menuFontFamily).not.toContain('Geist')
    expect(medium.menuFontSize).toBe('15px')
    expect(medium.menuFontWeight).toBe('400')
    expect(medium.menuColor).toBe(medium.triggerLabelColor)
    expect(medium.menuSmoothing).toBe('auto')
    expect(medium.fontSize).toBe('13px')
    expect(medium.fontWeight).toBe('500')
    expect(medium.color).toBe(medium.triggerLabelColor)
    expect(medium.smoothing).toBe('auto')
    expect(medium.fontLoaded).toBe(true)

    await page.evaluate(() => {
      (window as Window & { setInstitutionValue?: (value: string) => void }).setInstitutionValue?.('andino')
    })
    await page.waitForTimeout(100)
    const selected = await page.evaluate(() => {
      const menuElement = document.querySelector<HTMLElement>('.app-select-menu')!
      const label = [...menuElement.querySelectorAll<HTMLElement>('.app-select-option-label')]
        .find(element => element.textContent?.trim() === 'Banco Andino Round 07')!
      const check = menuElement.querySelector<SVGElement>('.app-select-option-check')!
      return {
        menuWidth: getComputedStyle(menuElement).width,
        checkWidth: check.getBoundingClientRect().width,
        labelClientWidth: label.clientWidth,
        labelScrollWidth: label.scrollWidth,
      }
    })
    expect(selected.checkWidth).toBe(16)
    expect(Number.parseFloat(selected.menuWidth)).toBeGreaterThanOrEqual(medium.naturalCanvasWidth + 50)
    expect(selected.labelScrollWidth).toBeLessThanOrEqual(selected.labelClientWidth + 1)

    await page.evaluate(() => {
      (window as Window & { setInstitutionOptions?: (options: Array<{ value: string; label: string }>) => void }).setInstitutionOptions?.([
        { value: 'all', label: 'Todas' },
        { value: 'andino', label: 'Banco Andino Round 07' },
        { value: 'long', label: 'Cooperativa Financiera Internacional con una denominación que excede ampliamente el límite autorizado' },
      ])
    })
    await page.waitForTimeout(100)
    const long = await page.evaluate(() => {
      const menuElement = document.querySelector<HTMLElement>('.app-select-menu')!
      const label = [...menuElement.querySelectorAll<HTMLElement>('.app-select-option-label')]
        .find(element => element.textContent?.trim().startsWith('Cooperativa Financiera'))!
      const menuRect = menuElement.getBoundingClientRect()
      const triggerElement = document.querySelector<HTMLElement>('[data-testid="institution-dynamic-width"]')!
      const triggerRect = triggerElement.getBoundingClientRect()
      return {
        triggerWidth: triggerRect.width,
        menuWidth: menuRect.width,
        menuLeft: menuRect.left,
        menuRight: menuRect.right,
        labelClientWidth: label.clientWidth,
        labelScrollWidth: label.scrollWidth,
        textOverflow: getComputedStyle(label).textOverflow,
      }
    })
    console.log(`Long institution option ${viewport.width}px`, JSON.stringify(long))
    expect(long.menuWidth).toBeGreaterThanOrEqual(long.triggerWidth - 0.5)
    expect(long.menuWidth).toBeLessThanOrEqual(296)
    expect(long.menuRight).toBeLessThanOrEqual(viewport.width)
    expect(long.labelScrollWidth).toBeGreaterThan(long.labelClientWidth)
    expect(long.textOverflow).toBe('ellipsis')
    await page.getByRole('combobox', { name: 'Institución' }).press('Escape')
  }
})

test('budget filters render the shared Accounts controls and adaptive AppSelect menus with built V3 CSS', async ({ page }) => {
  const css = builtCss()
  const classes = {
    controls: moduleClass(css, 'controls'),
    controlsMain: moduleClass(css, 'controlsMain'),
    portfolioBar: moduleClass(css, 'portfolioFilterBar'),
    portfolioFilter: moduleClass(css, 'portfolioFilter'),
    portfolioCurrency: moduleClass(css, 'portfolioFilterCurrency'),
    portfolioType: moduleClass(css, 'portfolioFilterType'),
    portfolioInstitution: moduleClass(css, 'portfolioFilterInstitution'),
    budgetToolbar: moduleClass(css, 'budgetFilterToolbar'),
    budgetMain: moduleClass(css, 'budgetFilterMain'),
    budgetPeriod: moduleClass(css, 'budgetPeriodFilter'),
    budgetCategory: moduleClass(css, 'budgetCategoryFilter'),
  }

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 834, height: 900 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport)
    await preparePage(page, css)
    await page.addScriptTag({ content: `(() => {
      const classes = ${JSON.stringify(classes)};
      const reference = [
        { id: 'ref-currency', value: 'all', className: classes.portfolioCurrency, options: [{ value: 'all', label: 'Todas' }, { value: 'PEN', label: 'PEN' }] },
        { id: 'ref-type', value: 'all', className: classes.portfolioType, options: [{ value: 'all', label: 'Todos' }, { value: 'MONTHLY', label: 'Cuenta mensual' }] },
        { id: 'ref-institution', value: 'all', className: classes.portfolioInstitution, options: [{ value: 'all', label: 'Todas' }, { value: 'bank', label: 'Banco de referencia' }] },
      ];
      const budgets = [
        { id: 'budget-currency', value: 'all', className: classes.portfolioCurrency, options: [{ value: 'all', label: 'Todas' }, { value: 'PEN', label: 'PEN' }] },
        { id: 'budget-period', value: 'all', className: classes.budgetPeriod, options: [{ value: 'all', label: 'Todas' }, { value: 'MONTHLY', label: 'Mensual' }] },
        { id: 'budget-category', value: 'all', className: classes.budgetCategory, options: [{ value: 'all', label: 'Todas' }, { value: 'category', label: 'Categoría con etiqueta extensa de prueba' }] },
      ];
      function SelectGroup({ definitions, id, budget = false }) {
        const [values, setValues] = React.useState(Object.fromEntries(definitions.map(item => [item.id, item.value])));
        return React.createElement('div', { className: classes.controls + ' ' + classes.portfolioBar + (budget ? ' ' + classes.budgetToolbar : ''), id },
          React.createElement('div', { className: classes.controlsMain + (budget ? ' ' + classes.budgetMain : '') },
            ...definitions.map(item => React.createElement(window.FinTrackTestAppSelect, {
              key: item.id, options: item.options, value: values[item.id], onChange: value => setValues(current => ({ ...current, [item.id]: value })),
              ariaLabel: item.id, compact: true, adaptiveMenuWidth: true,
              className: classes.portfolioFilter + ' ' + item.className + ' filters-control', testId: item.id,
            })),
          ),
        );
      }
      function Harness() {
        return React.createElement(React.Fragment, null,
          React.createElement(SelectGroup, { definitions: reference, id: 'reference-toolbar' }),
          React.createElement(SelectGroup, { definitions: budgets, id: 'budget-toolbar', budget: true }),
        );
      }
      ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
    })();` })

    const sharedGeometry = await page.evaluate(() => {
      const pick = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector)!
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        return { width: rect.width, height: rect.height, borderRadius: style.borderRadius, borderColor: style.borderColor, background: style.backgroundColor, fontFamily: style.fontFamily, fontSize: style.fontSize }
      }
      const reference = ['ref-currency', 'ref-type', 'ref-institution'].map(id => pick(`[data-testid="${id}"]`))
      const budgets = ['budget-currency', 'budget-period', 'budget-category'].map(id => pick(`[data-testid="${id}"]`))
      return { reference, budgets }
    })
    console.log(`Shared budget filter control geometry ${viewport.width}px`, JSON.stringify(sharedGeometry))

    for (let index = 0; index < 3; index += 1) {
      expect(sharedGeometry.budgets[index]!.height, `${viewport.width}px filter height`).toBe(sharedGeometry.reference[index]!.height)
      expect(sharedGeometry.budgets[index]!.borderRadius).toBe(sharedGeometry.reference[index]!.borderRadius)
      expect(sharedGeometry.budgets[index]!.borderColor).toBe(sharedGeometry.reference[index]!.borderColor)
      expect(sharedGeometry.budgets[index]!.background).toBe(sharedGeometry.reference[index]!.background)
      expect(sharedGeometry.budgets[index]!.fontFamily).toBe(sharedGeometry.reference[index]!.fontFamily)
      expect(sharedGeometry.budgets[index]!.fontSize).toBe(sharedGeometry.reference[index]!.fontSize)
      // Currency shares the exact Accounts slot. Period and category keep the shared
      // control treatment, but their longer semantic labels need their own compact width.
      if (index === 0) {
        expect(Math.abs(sharedGeometry.budgets[index]!.width - sharedGeometry.reference[index]!.width)).toBeLessThanOrEqual(1)
      } else if (viewport.width > 767) {
        const expectedWidth = index === 1 ? 148 : 208
        expect(Math.abs(sharedGeometry.budgets[index]!.width - expectedWidth)).toBeLessThanOrEqual(1)
      } else {
        // The two budget-specific controls share the available mobile grid tracks.
        expect(sharedGeometry.budgets[index]!.width).toBeLessThanOrEqual(viewport.width - 32)
      }
    }

    await page.getByTestId('budget-category').click()
    const menu = page.getByRole('dialog', { name: 'budget-category' })
    await expect(menu).toBeVisible()
    const menuGeometry = await page.evaluate(() => {
      const trigger = document.querySelector<HTMLElement>('[data-testid="budget-category"]')!
      const menu = document.querySelector<HTMLElement>('.app-select-menu')!
      const triggerRect = trigger.getBoundingClientRect()
      const menuRect = menu.getBoundingClientRect()
      const style = getComputedStyle(menu)
      return { triggerWidth: triggerRect.width, menuWidth: menuRect.width, minWidth: style.minWidth, left: menuRect.left, right: menuRect.right, viewport: innerWidth }
    })
    expect(menuGeometry.menuWidth).toBeGreaterThanOrEqual(menuGeometry.triggerWidth - 0.5)
    expect(menuGeometry.menuWidth).toBeLessThanOrEqual(296)
    expect(menuGeometry.minWidth).toBe('0px')
    expect(menuGeometry.left).toBeGreaterThanOrEqual(0)
    expect(menuGeometry.right).toBeLessThanOrEqual(menuGeometry.viewport)
    await menu.getByRole('combobox').fill('extensa')
    await expect(menu.getByRole('option')).toContainText('Categoría con etiqueta extensa de prueba')
    await expect(menu.getByRole('option')).toHaveCount(1)
  }
})

test('matched menu flips upward near the viewport bottom and keeps dark V3 surfaces', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const css = builtCss()
  await routeV3FontAssets(page)
  await page.setContent(v3Document('<div id="root" class="fin-shell" data-ft-v3 data-ft-v3-shell></div>', css, 'dark'))
  await page.addStyleTag({ content: css + '.test-bottom-anchor { position: fixed; left: 24px; bottom: 12px; width: 180px; }' })
  await page.evaluate(async family => {
    await document.fonts.load(`500 13px "${family}"`)
    await document.fonts.ready
  }, v3FontFamily(css))
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: browserComponentSource() })
  await page.addScriptTag({ content: `(() => {
    function Harness() {
      return React.createElement('div', { className: 'test-bottom-anchor' }, React.createElement(window.FinTrackTestAppSelect, {
        options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }, { value: 'c', label: 'C' }],
        value: 'a', onChange: () => {}, ariaLabel: 'Filtro inferior', compact: true, matchTriggerWidth: true, testId: 'bottom-filter',
      }))
    }
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
  })();` })

  const trigger = page.getByTestId('bottom-filter')
  await trigger.click()
  const menu = page.getByRole('dialog', { name: 'Filtro inferior' })
  await expect(menu).toBeVisible()
  const geometry = await page.evaluate(() => {
    const triggerElement = document.querySelector<HTMLElement>('[data-testid="bottom-filter"]')!
    const menuElement = document.querySelector<HTMLElement>('.app-select-menu')!
    const triggerRect = triggerElement.getBoundingClientRect()
    const menuRect = menuElement.getBoundingClientRect()
    return {
      triggerTop: triggerRect.top,
      menuTop: menuRect.top,
      menuBottom: menuRect.bottom,
      menuWidth: menuRect.width,
      triggerWidth: triggerRect.width,
      background: getComputedStyle(menuElement).backgroundColor,
      viewportHeight: innerHeight,
    }
  })
  console.log('AppSelect bottom anchor dark mode 390px', JSON.stringify(geometry))
  expect(Math.abs(geometry.menuWidth - geometry.triggerWidth)).toBeLessThanOrEqual(2)
  expect(geometry.menuBottom).toBeLessThanOrEqual(geometry.triggerTop - 4)
  expect(geometry.menuTop).toBeGreaterThanOrEqual(0)
  expect(geometry.menuBottom).toBeLessThanOrEqual(geometry.viewportHeight)
  expect(geometry.background).not.toBe('rgba(0, 0, 0, 0)')
})

test('adaptive menu grows from its anchor, flips upward, and stays visible in dark mode', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const css = builtCss()
  await routeV3FontAssets(page)
  await page.setContent(v3Document('<div id="root" class="fin-shell" data-ft-v3 data-ft-v3-shell></div>', css, 'dark'))
  await page.addStyleTag({ content: css + '.test-adaptive-bottom-anchor { position: fixed; left: 24px; bottom: 12px; width: 180px; }' })
  await page.evaluate(async family => {
    await document.fonts.load(`500 13px "${family}"`)
    await document.fonts.ready
  }, v3FontFamily(css))
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: browserComponentSource() })
  await page.addScriptTag({ content: `(() => {
    function Harness() {
      return React.createElement('div', { className: 'test-adaptive-bottom-anchor' }, React.createElement(window.FinTrackTestAppSelect, {
        options: [{ value: 'all', label: 'Todas' }, { value: 'long', label: 'Caja Municipal de Arequipa' }],
        value: 'all', onChange: () => {}, ariaLabel: 'Institución adaptable', compact: true, adaptiveMenuWidth: true, testId: 'adaptive-bottom-filter',
      }))
    }
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
  })();` })

  const trigger = page.getByTestId('adaptive-bottom-filter')
  await trigger.click()
  const menu = page.getByRole('dialog', { name: 'Institución adaptable' })
  await expect(menu).toBeVisible()
  const geometry = await page.evaluate(() => {
    const triggerElement = document.querySelector<HTMLElement>('[data-testid="adaptive-bottom-filter"]')!
    const menuElement = document.querySelector<HTMLElement>('.app-select-menu')!
    const triggerRect = triggerElement.getBoundingClientRect()
    const menuRect = menuElement.getBoundingClientRect()
    return {
      triggerTop: triggerRect.top,
      triggerWidth: triggerRect.width,
      menuTop: menuRect.top,
      menuBottom: menuRect.bottom,
      menuWidth: menuRect.width,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      background: getComputedStyle(menuElement).backgroundColor,
    }
  })
  expect(geometry.menuWidth).toBeGreaterThan(geometry.triggerWidth + 1)
  expect(geometry.menuWidth).toBeLessThanOrEqual(296)
  expect(geometry.menuBottom).toBeLessThanOrEqual(geometry.triggerTop - 4)
  expect(geometry.menuTop).toBeGreaterThanOrEqual(0)
  expect(geometry.menuBottom).toBeLessThanOrEqual(geometry.viewportHeight)
  expect(geometry.menuWidth + 16).toBeLessThanOrEqual(geometry.viewportWidth)
  expect(geometry.background).not.toBe('rgba(0, 0, 0, 0)')
})

test('trigger-matched selector in the account modal portal keeps measured width and keyboard behavior', async ({ page }) => {
  await page.setViewportSize({ width: 834, height: 700 })
  const css = builtCss()
  await routeV3FontAssets(page)
  await page.setContent(v3Document(`
    <div class="fin-shell" data-ft-v3 data-ft-v3-shell>
      <div class="test-overlay"><div class="test-focus-scope" data-app-select-portal-root>
        <section role="dialog" aria-modal="true" aria-label="Añadir cuenta" class="test-account-modal">
          <button id="before-select">Anterior</button><div id="root"></div><button id="after-select">Siguiente</button>
        </section>
      </div></div>
    </div>
  `, css))
  await page.addStyleTag({ content: css + `
    .test-overlay { position: fixed; inset: 0; z-index: 120; background: rgb(0 0 0 / .24); }
    .test-focus-scope { position: relative; z-index: 1; width: 100%; height: 100%; }
    .test-account-modal { position: absolute; left: 200px; top: 180px; width: 420px; height: 260px; overflow: hidden; background: var(--ft-surface); padding: 24px; }
  ` })
  await page.evaluate(async family => {
    await document.fonts.load(`500 13px "${family}"`)
    await document.fonts.ready
  }, v3FontFamily(css))
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: browserComponentSource() })
  await page.addScriptTag({ content: `(() => {
    function Harness() {
      const [value, setValue] = React.useState('PEN');
      return React.createElement(window.FinTrackTestAppSelect, {
        options: [{ value: 'PEN', label: 'Sol peruano' }, { value: 'USD', label: 'Dólar estadounidense' }],
        value, onChange: setValue, ariaLabel: 'Moneda de la cuenta', compact: true, matchTriggerWidth: true, testId: 'account-modal-currency',
      });
    }
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
  })();` })

  const trigger = page.getByTestId('account-modal-currency')
  await trigger.click()
  const menu = page.getByRole('dialog', { name: 'Moneda de la cuenta' })
  await expect(menu).toBeVisible()
  await page.waitForTimeout(500)
  const dimensions = await menu.evaluate(element => {
    const menuRect = element.getBoundingClientRect()
    const triggerElement = document.querySelector<HTMLElement>('[data-testid="account-modal-currency"]')
    const triggerRect = triggerElement!.getBoundingClientRect()
    return {
      width: menuRect.width,
      triggerWidth: triggerRect.width,
      minWidth: getComputedStyle(element).minWidth,
      parentIsFocusScope: element.parentElement?.hasAttribute('data-app-select-portal-root'),
      right: menuRect.right,
    }
  })
  expect(Math.abs(dimensions.width - dimensions.triggerWidth)).toBeLessThanOrEqual(2)
  expect(dimensions.minWidth).toBe('0px')
  expect(dimensions.parentIsFocusScope).toBe(true)
  expect(dimensions.right).toBeLessThanOrEqual(834)

  const search = page.getByRole('combobox', { name: 'Moneda de la cuenta' })
  await search.fill('dólar')
  await search.press('Enter')
  await expect(menu).toHaveCount(0)
  await expect(trigger).toContainText('Dólar estadounidense')
  await expect(trigger).toBeFocused()
})
