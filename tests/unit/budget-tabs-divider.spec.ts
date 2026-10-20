import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'

const managerSource = readFileSync(join(process.cwd(), 'components/management/BudgetsManager.tsx'), 'utf8')
const budgetCss = readFileSync(join(process.cwd(), 'components/management/BudgetsManager.module.css'), 'utf8')
const movementCss = readFileSync(join(process.cwd(), 'components/tables/TransactionsRound07.module.css'), 'utf8')
const budgetCssFixture = budgetCss.replace(/:global\(([^()]*)\)/g, '$1')
const movementCssFixture = movementCss.replace(/:global\(([^()]*)\)/g, '$1')

test('budget tab baseline spans the content while the selected underline stays under its tab', async ({ page }) => {
  expect(managerSource).toContain('<div className={styles.budgetPeriodNavigation}>')
  expect(managerSource).toContain('className={`${styles.budgetTabs} ${movementPageStyles.tabs}`}')
  expect(managerSource).toContain('className={styles.budgetTab}')
  expect(budgetCss).toContain('border-bottom: 1px solid var(--ft-r07-line);')
  expect(budgetCss).toContain('.budgetTabs.budgetTabs')

  await page.setContent(`
    <style>
      * { box-sizing: border-box; }
      :root { --ft-r07-line: #dce1e5; --ft-r07-muted: #59636d; --ft-r07-ink: #242a30; --ft-primary: #155e59; --ft-focus-ring-color: rgb(21 94 89 / 28%); }
      html, body { margin: 0; width: 100%; font: 13px Manrope, system-ui, sans-serif; }
      .content { width: min(100%, 1440px); margin: 0 auto; }
      ${movementCssFixture}
      ${budgetCssFixture}
    </style>
    <main class="content" data-testid="content">
      <div class="budgetPeriodNavigation" data-testid="period-navigation">
        <nav class="budgetTabs tabs" aria-label="Vistas de presupuestos" data-testid="budget-tabs">
          <button class="budgetTab" data-active="true">Este período</button>
          <button class="budgetTab" data-active="false">Excedidos</button>
          <button class="budgetTab" data-active="false">Otros períodos</button>
        </nav>
      </div>
      <div data-testid="filter-toolbar">Filtros</div>
    </main>`)

  for (const width of [1440, 834, 390]) {
    await page.setViewportSize({ width, height: 900 })
    const layout = await page.evaluate(() => {
      const rect = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector)
        if (!element) throw new Error(`Missing ${selector}`)
        const { left, right, top, bottom, width, height } = element.getBoundingClientRect()
        return { left, right, top, bottom, width, height }
      }
      const navigation = document.querySelector<HTMLElement>('[data-testid="period-navigation"]')!
      const tabs = document.querySelector<HTMLElement>('[data-testid="budget-tabs"]')!
      const selected = tabs.querySelector<HTMLElement>('[data-active="true"]')!
      const navStyle = getComputedStyle(navigation)
      const tabsStyle = getComputedStyle(tabs)
      const selectedUnderline = getComputedStyle(selected, '::after')
      return {
        content: rect('[data-testid="content"]'),
        navigation: rect('[data-testid="period-navigation"]'),
        tabs: rect('[data-testid="budget-tabs"]'),
        selected: rect('[data-active="true"]'),
        filterToolbar: rect('[data-testid="filter-toolbar"]'),
        baselineWidth: Number.parseFloat(navStyle.borderBottomWidth),
        baselineColor: navStyle.borderBottomColor,
        tabsBorderWidth: Number.parseFloat(tabsStyle.borderBottomWidth),
        tabsMarginBottom: Number.parseFloat(tabsStyle.marginBottom),
        tabsOverflowX: tabsStyle.overflowX,
        selectedUnderlineWidth: Number.parseFloat(selectedUnderline.width),
        selectedUnderlineColor: selectedUnderline.backgroundColor,
        documentWidth: document.documentElement.scrollWidth,
      }
    })

    expect(layout.documentWidth).toBeLessThanOrEqual(width)
    expect(layout.navigation.left).toBeCloseTo(layout.content.left, 0)
    expect(layout.navigation.right).toBeCloseTo(layout.content.right, 0)
    expect(layout.tabs.left).toBeCloseTo(layout.navigation.left, 0)
    expect(layout.tabs.right).toBeCloseTo(layout.navigation.right, 0)
    expect(layout.baselineWidth).toBe(1)
    expect(layout.baselineColor).toBe('rgb(220, 225, 229)')
    expect(layout.tabsBorderWidth).toBe(0)
    expect(layout.tabsMarginBottom).toBe(0)
    expect(layout.selectedUnderlineWidth).toBeCloseTo(layout.selected.width, 1)
    expect(layout.selectedUnderlineColor).toBe('rgb(21, 94, 89)')
    expect(layout.filterToolbar.top).toBeGreaterThanOrEqual(layout.navigation.bottom)
    expect(layout.tabsOverflowX).toBe('auto')
  }
})
