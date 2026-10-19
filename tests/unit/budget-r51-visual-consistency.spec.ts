import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'

const managerSource = readFileSync(join(process.cwd(), 'components/management/BudgetsManager.tsx'), 'utf8')
const budgetCss = readFileSync(join(process.cwd(), 'components/management/BudgetsManager.module.css'), 'utf8')
const movementCss = readFileSync(join(process.cwd(), 'components/tables/TransactionsRound07.module.css'), 'utf8')
const movementCssFixture = movementCss.replace(/:global\(([^()]*)\)/g, '$1')
const budgetCssFixture = budgetCss.replace(/:global\(([^()]*)\)/g, '$1')

test('budgets opts into shared V3 header, tokens and primary action without local button variants', () => {
  expect(managerSource).toContain('className={`max-w-none !gap-0 ${movementPageStyles.v3ModuleContent}`}')
  expect(managerSource).toContain('label="Crear presupuesto"')
  expect(managerSource).not.toContain('className={movementPageStyles.v3ModulePrimaryAction}')
  expect(managerSource).not.toContain('budgetCreateButton')
  expect(managerSource).toContain('className={`${movementPageStyles.controls} ${styles.budgetFilterToolbar}`}')
  expect(managerSource).toContain('movementPageStyles.controlsMain')
  expect(managerSource).toContain('movementPageStyles.controlsActions')
  expect(managerSource).toContain('value={periodMonth}')
  expect(managerSource).toContain('onChange={setPeriodMonth}')
  expect(managerSource).toContain('ariaLabel="Filtrar por moneda"')
  expect(managerSource).toContain('ariaLabel="Filtrar por periodicidad"')
  expect(managerSource).toContain('ariaLabel="Filtrar por categoría"')
  expect(managerSource).toContain('label="Activos"')
  expect(managerSource).toContain('label="Inactivos"')
  expect(managerSource).toContain('label="Todos"')
  expect(budgetCss).not.toContain('.budgetCreateButton')
})

test('budget header, summary and filter toolbar follow shared V3 geometry at desktop, tablet and mobile widths', async ({ page }) => {
  await page.setContent(`
    <style>
      * { box-sizing: border-box; }
      :root { --ft-r07-surface: #fff; --ft-r07-line: #e4e7e9; --ft-r07-ink: #242a30; --ft-r07-muted: #59636d; --ft-r07-hover: #f5f6f7; --ft-primary: #18764f; --ft-text-on-primary: #fff; --ft-control: #dce1e4; --ft-text-strong: #242a30; --ft-text-subtle: #77818a; }
      :root[data-theme='dark'] { --ft-r07-surface: #1f2529; --ft-r07-line: #3b444a; --ft-r07-ink: #edf1f3; --ft-r07-muted: #abb5bb; --ft-r07-hover: #2b3338; --ft-primary: #54b88b; --ft-text-on-primary: #12251b; --ft-control: #48535a; --ft-text-strong: #edf1f3; --ft-text-subtle: #9aa6ad; }
      html, body { margin: 0; min-height: 100%; width: 100%; font: 13px Manrope, system-ui, sans-serif; color: var(--ft-r07-ink); }
      .shellContent { width: min(calc(100vw - var(--rail) - 48px), 1440px); margin-left: calc(var(--rail) + 24px); padding: 22px 0 40px; }
      .module-create-btn { height: 40px; min-height: 40px; }
      .summaryCurrency { display: flex; min-width: 0; width: 100%; flex: 1 1 100%; flex-wrap: wrap; align-items: flex-start; justify-content: flex-start; gap: 24px 36px; }
      .summaryCurrency > div { flex: 0 1 auto; min-width: min(176px, 100%); }
      .summaryValue { font-variant-numeric: tabular-nums; white-space: nowrap; }
      .headerPeriodControl { position: relative; width: 164px; min-width: 0; flex: 0 1 164px; }
      .headerPeriodSelect { width: 100%; min-width: 0; }
      .headerPeriodTrigger { height: 36px; min-height: 36px; border: 1px solid var(--ft-r07-line); border-radius: 10px; background: var(--ft-r07-surface); padding: 0 11px 0 34px; color: var(--ft-r07-ink); font: 600 12px/18px Manrope, system-ui, sans-serif; }
      .budgetHeaderActions { display: flex; flex: 0 0 auto; align-items: center; justify-content: flex-end; gap: 8px; }
      .budgetFilterToolbar.budgetFilterToolbar { min-width: 0; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
      .budgetFilterMain { flex-wrap: wrap; }
      .budgetSearchControl { min-width: 0; }
      .budgetFilterToolbar .budgetCurrencyFilter { width: 132px; max-width: 132px; flex: 0 0 132px; }
      .budgetFilterToolbar .budgetPeriodFilter { width: 148px; max-width: 148px; flex: 0 0 148px; }
      .budgetFilterToolbar .budgetCategoryFilter { width: 208px; max-width: 208px; flex: 0 0 208px; }
      .budgetFilterToolbar .app-select-trigger-compact { height: 38px; min-height: 38px; border: 1px solid var(--ft-r07-line); border-radius: 10px; background: var(--ft-r07-surface); color: var(--ft-r07-ink); font: 500 12px/18px Manrope, system-ui, sans-serif; }
      .budgetFilterToolbar input[data-testid='budgets-search-input'] { height: 20px; min-width: 0; border: 0; border-radius: 0; background: transparent; padding: 0; color: var(--ft-r07-ink); font-size: 12px; line-height: 18px; }
      .statusFilters { display: flex; min-width: 0; flex-wrap: wrap; gap: 5px; }
      .statusFilters > button { height: 38px; min-height: 38px; }
      .budgetFilterActions { display: flex; flex-wrap: wrap; gap: 8px; min-width: 0; }
      .budgetFilterActions > button { min-height: 36px; }
      ${movementCssFixture}
      ${budgetCssFixture}
      @media (max-width: 767px) {
        .shellContent { width: 100%; margin: 0; padding: 16px; }
      }
    </style>
    <main class="v3ModuleContent shellContent" data-testid="budgets-module">
      <div class="pageOverview budgetOverview" data-testid="budgets-page-overview">
        <header><div><h1>Presupuestos</h1><p>Control de límites por período.</p></div><div class="budgetHeaderActions"><div class="headerPeriodControl"><button class="headerPeriodTrigger">Octubre 2026</button></div><button class="module-create-btn" data-testid="budgets-create-button">Crear presupuesto</button></div></header>
        <section class="summary budgetSummary" data-testid="budgets-summary"><div class="summaryCurrency"><div class="summaryItem"><p>Asignado · PEN</p><div class="summaryValue">S/ 1,234.00</div></div><div class="summaryItem"><p>Gastado · PEN</p><div class="summaryValue">S/ 456.00</div></div><div class="summaryItem"><p>Disponible · PEN</p><div class="summaryValue">S/ 778.00</div></div></div></section>
      </div>
      <nav class="tabs"><button>Este período</button><button>Excedidos</button><button>Otros períodos</button></nav>
      <div class="controls budgetFilterToolbar" data-testid="budgets-filter-toolbar">
        <div class="controlsMain budgetFilterMain"><label class="searchControl budgetSearchControl"><span aria-hidden="true">⌕</span><input data-testid="budgets-search-input" placeholder="Buscar presupuestos"></label><button class="budgetCurrencyFilter app-select-trigger-compact">Moneda</button><button class="budgetPeriodFilter app-select-trigger-compact">Periodicidad</button><button class="budgetCategoryFilter app-select-trigger-compact">Categoría</button></div>
        <div class="controlsActions budgetFilterActions"><div class="statusFilters"><button>Activos</button><button>Inactivos</button><button>Todos</button></div><button>Actualizar</button><span>8 presupuestos</span></div>
      </div>
    </main>`)

  const widths = [
    { width: 390, rail: 0 },
    { width: 834, rail: 0 },
    { width: 1081, rail: 256 },
    { width: 1200, rail: 256 },
    { width: 1280, rail: 256 },
    { width: 1440, rail: 256 },
    { width: 1710, rail: 256 },
  ]

  for (const { width, rail } of widths) {
    await page.setViewportSize({ width, height: 1000 })
    await page.evaluate(railWidth => document.documentElement.style.setProperty('--rail', `${railWidth}px`), rail)
    const geometry = await page.evaluate(() => {
      const rect = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector)
        if (!element) throw new Error(`Missing ${selector}`)
        const { left, right, top, bottom, width, height } = element.getBoundingClientRect()
        return { left, right, top, bottom, width, height }
      }
      const summary = document.querySelector<HTMLElement>('[data-testid="budgets-summary"]')
      const firstIndicator = document.querySelector<HTMLElement>('.summaryItem')
      const lastIndicator = document.querySelectorAll<HTMLElement>('.summaryItem').item(2)
      if (!summary || !firstIndicator || !lastIndicator) throw new Error('Missing budget summary indicators')
      const summaryRect = summary.getBoundingClientRect()
      const firstRect = firstIndicator.getBoundingClientRect()
      const lastRect = lastIndicator.getBoundingClientRect()
      const triggers = Array.from(document.querySelectorAll<HTMLElement>('.budgetCurrencyFilter, .budgetPeriodFilter, .budgetCategoryFilter'))
      return {
        documentWidth: document.documentElement.scrollWidth,
        module: rect('[data-testid="budgets-module"]'),
        header: rect('[data-testid="budgets-page-overview"]'),
        action: rect('[data-testid="budgets-create-button"]'),
        period: rect('.headerPeriodTrigger'),
        toolbar: rect('[data-testid="budgets-filter-toolbar"]'),
        search: rect('.budgetSearchControl'),
        summary: { left: summaryRect.left, right: summaryRect.right },
        firstIndicator: { left: firstRect.left, right: firstRect.right },
        lastIndicator: { left: lastRect.left, right: lastRect.right },
        triggers: triggers.map(trigger => ({ height: trigger.getBoundingClientRect().height, font: getComputedStyle(trigger).fontFamily })),
      }
    })

    expect(geometry.documentWidth, `${width}px viewport should not overflow`).toBeLessThanOrEqual(width)
    expect(geometry.module.left).toBeGreaterThanOrEqual(0)
    expect(geometry.module.right).toBeLessThanOrEqual(width + 0.5)
    expect(geometry.action.height).toBe(40)
    expect(geometry.period.height).toBe(width <= 520 ? 40 : 36)
    expect(geometry.toolbar.left).toBeGreaterThanOrEqual(geometry.module.left - 0.5)
    expect(geometry.toolbar.right).toBeLessThanOrEqual(geometry.module.right + 0.5)
    expect(geometry.search.height).toBe(width <= 767 ? 44 : 38)
    expect(geometry.triggers).toHaveLength(3)
    expect(geometry.triggers.every(trigger => trigger.height === (width <= 767 ? 44 : 38))).toBe(true)
    expect(geometry.triggers.every(trigger => trigger.font.toLowerCase().includes('manrope'))).toBe(true)
    expect(geometry.firstIndicator.left).toBeGreaterThanOrEqual(geometry.summary.left - 0.5)
    expect(geometry.firstIndicator.left).toBeLessThanOrEqual(geometry.summary.left + 1)
    if (width >= 1280) {
      expect(geometry.lastIndicator.right).toBeLessThan(geometry.summary.right - 100)
    }
  }
})

test('budget header and filter controls keep their light/dark theme surfaces token-driven', async ({ page }) => {
  await page.setContent(`
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; min-height: 100%; width: 100%; font: 13px Manrope, system-ui, sans-serif; }
      ${movementCssFixture}
      ${budgetCssFixture}
    </style>
    <main class="v3ModuleContent"><div class="headerPeriodControl"><button class="headerPeriodTrigger">Octubre 2026</button></div></main>`)
  const trigger = page.locator('.headerPeriodTrigger')
  await expect(trigger).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(trigger).toHaveCSS('border-radius', '10px')
  await expect(trigger).toHaveCSS('font-family', /Manrope/)
  await page.locator('html').evaluate(element => element.setAttribute('data-theme', 'dark'))
  await expect(trigger).toHaveCSS('background-color', 'rgb(32, 35, 39)')
  await expect(trigger).toHaveCSS('color', 'rgb(237, 240, 242)')
})
