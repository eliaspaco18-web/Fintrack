import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'

const managerSource = readFileSync(join(process.cwd(), 'components/management/BudgetsManager.tsx'), 'utf8')
const pickerSource = readFileSync(join(process.cwd(), 'components/management/BudgetMonthPicker.tsx'), 'utf8')
const shellSource = readFileSync(join(process.cwd(), 'components/layout/AppShell.tsx'), 'utf8')
const detailSource = readFileSync(join(process.cwd(), 'components/management/BudgetDetail.tsx'), 'utf8')
const detailCss = readFileSync(join(process.cwd(), 'components/management/BudgetDetail.module.css'), 'utf8')
const movementCss = readFileSync(join(process.cwd(), 'components/tables/TransactionsRound07.module.css'), 'utf8')
const detailCssFixture = detailCss.replace(/:global\(([^()]*)\)/g, '$1')
const movementCssFixture = movementCss.replace(/:global\(([^()]*)\)/g, '$1')

test('R5.2 keeps the budget header and summary aligned to the approved V3 page geometry', async ({ page }) => {
  await page.setContent(`
    <style>
      * { box-sizing: border-box; }
      :root { --ft-r07-line:#dce1e5; --ft-r07-muted:#59636d; --ft-r07-ink:#242a30; --ft-r07-surface:#fff; --ft-r07-hover:#f0f2f4; --ft-primary:#155e59; --ft-primary-hover:#104d49; --ft-text-on-primary:#fff; --ft-text-strong:#242a30; --ft-text-muted:#59636d; --ft-surface-muted:#f0f2f4; --ft-surface:#fff; --ft-surface-hover:#e9edef; --ft-text-subtle:#77818a; --ft-border:#dce1e5; --ft-focus-ring-color:rgb(21 94 89 / 28%); }
      html, body { margin:0; min-height:100%; font:13px Manrope, system-ui, sans-serif; }
      .shellContent { width:min(calc(100vw - var(--rail) - 48px), 1440px); margin-left:calc(var(--rail) + 24px); }
      .page { max-width:1440px; }
      .pageOverview > header { display:flex; justify-content:space-between; }
      .budgetHeaderActions { display:flex; flex:0 0 auto; align-items:center; justify-content:flex-end; gap:8px; }
      .headerPeriodControl { position:relative; width:164px; flex:0 1 164px; }
      .trigger { width:100%; height:36px; border:1px solid var(--ft-r07-line); border-radius:10px; background:var(--ft-r07-surface); color:var(--ft-r07-ink); font:600 12px/18px Manrope,system-ui,sans-serif; }
      .summaryCurrency { display:flex; width:100%; min-width:0; flex:1 1 100%; gap:36px; }
      .summaryCurrency > div { min-width:130px; }
      ${movementCssFixture}
      ${detailCssFixture}
    </style>
    <main class="shellContent">
      <section class="page pageOverview" data-testid="accounts-overview">
        <header><div><h1>Cuentas</h1><p>Descripción del módulo.</p></div></header>
        <section class="summary"><div class="summaryItem"><p>Saldos</p><div class="summaryValue">S/ 120.00</div></div><div class="summaryItem"><p>USD</p><div class="summaryValue">$ 30.00</div></div><div class="summaryItem"><p>Registro separado</p><div class="summaryValue">S/ 10.00</div></div></section>
      </section>
      <section class="page pageOverview" data-testid="movements-overview">
        <header><div><h1>Movimientos</h1><p>Descripción del módulo.</p></div></header>
        <section class="summary"><div class="summaryItem"><p>Ingresos</p><div class="summaryValue">S/ 120.00</div></div><div class="summaryItem"><p>Egresos</p><div class="summaryValue">$ 30.00</div></div><div class="summaryItem"><p>Resultado</p><div class="summaryValue">S/ 10.00</div></div></section>
      </section>
      <section class="page pageOverview v3ModuleContent" data-testid="budgets-overview">
        <header><div><h1>Presupuestos</h1><p>Descripción del módulo.</p></div><div class="budgetHeaderActions"><div class="headerPeriodControl"><button class="trigger">Octubre de 2026</button></div></div></header>
        <section class="summary budgetSummary"><div class="summaryCurrency"><div class="summaryItem"><p>Asignado · PEN</p><div class="summaryValue">S/ 120.00</div></div><div class="summaryItem"><p>Gastado · PEN</p><div class="summaryValue">S/ 30.00</div></div><div class="summaryItem"><p>Disponible · PEN</p><div class="summaryValue">S/ 90.00</div></div></div></section>
      </section>
    </main>`)

  for (const { width, rail } of [
    { width: 1440, rail: 256 },
    { width: 1710, rail: 256 },
  ]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.evaluate(value => document.documentElement.style.setProperty('--rail', `${value}px`), rail)
    const metrics = await page.evaluate(() => {
      const rect = (selector: string) => {
        const node = document.querySelector<HTMLElement>(selector)!
        const { left, right, top, bottom, width, height } = node.getBoundingClientRect()
        return { left, right, top, bottom, width, height }
      }
      const overviewTop = (selector: string) => {
        const overview = document.querySelector<HTMLElement>(selector)!
        return overview.getBoundingClientRect().top
      }
      return {
        accountsTitleTop: rect('[data-testid="accounts-overview"] h1').top - overviewTop('[data-testid="accounts-overview"]'),
        movementsTitleTop: rect('[data-testid="movements-overview"] h1').top - overviewTop('[data-testid="movements-overview"]'),
        budgetsTitleTop: rect('[data-testid="budgets-overview"] h1').top - overviewTop('[data-testid="budgets-overview"]'),
        accountsSubtitleTop: rect('[data-testid="accounts-overview"] header p').top - overviewTop('[data-testid="accounts-overview"]'),
        movementsSubtitleTop: rect('[data-testid="movements-overview"] header p').top - overviewTop('[data-testid="movements-overview"]'),
        budgetsSubtitleTop: rect('[data-testid="budgets-overview"] header p').top - overviewTop('[data-testid="budgets-overview"]'),
        accountsSummaryTop: rect('[data-testid="accounts-overview"] .summary').top - overviewTop('[data-testid="accounts-overview"]'),
        movementsSummaryTop: rect('[data-testid="movements-overview"] .summary').top - overviewTop('[data-testid="movements-overview"]'),
        budgetsSummaryTop: rect('[data-testid="budgets-overview"] .summary').top - overviewTop('[data-testid="budgets-overview"]'),
        budgetPeriod: rect('[data-testid="budgets-overview"] .trigger'),
      }
    })

    expect(metrics.budgetsTitleTop).toBeCloseTo(metrics.accountsTitleTop, 0)
    expect(metrics.budgetsTitleTop).toBeCloseTo(metrics.movementsTitleTop, 0)
    expect(metrics.budgetsSubtitleTop).toBeCloseTo(metrics.accountsSubtitleTop, 0)
    expect(metrics.budgetsSubtitleTop).toBeCloseTo(metrics.movementsSubtitleTop, 0)
    expect(metrics.budgetsSummaryTop).toBeCloseTo(metrics.accountsSummaryTop, 0)
    expect(metrics.budgetsSummaryTop).toBeCloseTo(metrics.movementsSummaryTop, 0)
    expect(metrics.budgetPeriod.height).toBe(36)
  }
})

test('R5.2 detail CSS keeps its content readable in a representative responsive layout', async ({ page }) => {
  expect(detailSource).toContain('widthClassName="w-[calc(100vw-40px)] max-w-[1320px]"')
  expect(detailSource).toContain('overlayClassName={styles.detailOverlay}')
  expect(detailCss).toContain('.detailOverlay:global([data-ft-v3][data-ft-workbench-overlay]) :global(.ft-v3-workbench-wrapper)')
  expect(detailSource).toContain('data-testid="budget-detail-layout"')
  expect(detailSource).toContain('onPeriodUpdated?.()')
  expect(detailSource).toContain('resolveBudgetPeriodTransactionsUrl(selectedBudget)')
  expect(detailCss).toContain('grid-template-columns: 286px minmax(0, 1fr)')
  expect(detailCss).toContain('@media (max-width: 1120px)')
  expect(detailCss).toContain('@media (max-width: 767px)')
  expect(detailCss).toContain('font-family: Manrope, system-ui, sans-serif')
  expect(detailCss).not.toContain('var(--c-')

  await page.setContent(`
    <style>
      * { box-sizing:border-box; }
      :root { --ft-text-strong:#242a30; --ft-text-muted:#59636d; --ft-text-subtle:#77818a; --ft-border:#dce1e5; --ft-surface:#fff; --ft-surface-muted:#f0f2f4; --ft-primary:#155e59; --ft-primary-hover:#104d49; --ft-success:#2b7356; --ft-success-soft:#e8f2e9; --ft-warning:#a36b12; --ft-warning-soft:#f9f1dc; --ft-danger:#ad4545; --ft-danger-soft:#f9eeee; --ft-focus-ring-color:rgb(21 94 89 / 28%); --ft-text-on-primary:#fff; }
      :root[data-theme='dark'] { --ft-text-strong:#edf0f2; --ft-text-muted:#b7bfc5; --ft-text-subtle:#a7afb6; --ft-border:#393f45; --ft-surface:#202327; --ft-surface-muted:#292d31; --ft-primary:#8ad1bf; --ft-primary-hover:#afe4d2; --ft-success:#95d6ad; --ft-success-soft:#283a30; --ft-warning:#e5c781; --ft-warning-soft:#3c3528; --ft-danger:#f2a09b; --ft-danger-soft:#402e30; --ft-focus-ring-color:rgb(138 209 191 / 35%); --ft-text-on-primary:#14352e; }
      html, body { width:100%; margin:0; font:13px Manrope,system-ui,sans-serif; color:var(--ft-text-strong); }
      .panel { width:min(calc(100vw - 40px),1320px); margin:20px auto; overflow:hidden; border:1px solid var(--ft-border); border-radius:14px; }
      ${detailCssFixture}
    </style>
    <main class="panel" data-testid="budget-detail-panel"><div class="detailLayout" data-testid="budget-detail-layout">
      <aside class="periodRail"><div class="periodRailHeader"><div class="periodRailTitleRow"><p class="sectionEyebrow">Períodos de la serie</p><span class="periodCount">14/14</span></div><div class="periodFilters"><button>2026</button><input class="periodSearch" value="" placeholder="Buscar período o estado" /></div></div><div class="periodList"><button class="periodOption" data-selected="true"><span class="periodOptionTop"><span class="periodOptionRange">01 ene. 2026 → 31 ene. 2026</span><span class="periodOptionDot toneOk"></span></span><span class="periodOptionAmounts"><span class="periodOptionAmount">S/ 2,987,654,321.00 · En rango</span><span class="periodOptionProgressLabel">62%</span></span><span class="progressTrack"><span class="progressFill fillOk" style="width:62%"></span></span></button></div></aside>
      <section class="detailMain"><div class="detailOverview"><div class="periodHeadingRow"><div class="selectedPeriodCopy"><p class="sectionEyebrow">Período seleccionado</p><h3 class="selectedPeriodDate">01 ene. 2026 → 31 ene. 2026</h3><p class="selectedStatusDescription">Disponible S/ 1,234.00</p></div><form class="amountForm"><label class="amountLabel">Importe del período</label><div class="amountControl"><input class="amountInput" value="2987654321.00"/><button class="saveAmountButton">Guardar</button></div></form></div><div class="detailMetrics"><div class="detailMetric"><p class="detailMetricLabel">Presupuesto</p><strong class="detailMetricValue">S/ 2,987,654,321.00</strong></div><div class="detailMetric"><p class="detailMetricLabel">Ejecutado</p><strong class="detailMetricValue">S/ 2,987,654,321.00</strong></div><div class="detailMetric"><p class="detailMetricLabel">Disponible</p><strong class="detailMetricValue">S/ 2,987,654,321.00</strong></div></div><div class="execution"><div class="executionHeading"><span>Ejecución del límite</span><strong class="executionPercent">62%</strong></div><div class="progressTrack"><div class="progressFill fillOk" style="width:62%"></div></div></div></div><div class="transactionToolbar"><div><h4 class="transactionTitle">Movimientos vinculados</h4><span class="transactionCount">1 movimiento</span></div><div class="transactionToolbarSearch"><input class="transactionSearch" placeholder="Buscar descripción, cuenta o destinatario"/></div></div><div class="transactionList"><div class="transactionHeader"><span>Fecha</span><span>Cuenta</span><span>Destinatario</span><span>Descripción</span><span>Importe</span></div><div class="transactionRow"><div class="transactionCell">19 oct. 2026</div><div class="transactionCell">Cuenta operativa con nombre descriptivo largo</div><div class="transactionCell">Proveedor de ejemplo</div><div class="transactionCell transactionDescription">Compra vinculada al presupuesto y detalle de referencia suficientemente largo.</div><div class="transactionCell transactionAmount toneDanger">−S/ 2,987,654,321.00</div></div></div><footer class="detailFooter"><div><p class="detailFooterLabel">Total gastado · 1 movimiento</p><p class="detailFooterValue">S/ 2,987,654,321.00</p></div><div class="detailFooterSecondary"><p class="detailFooterLabel">Límite del período</p><p class="detailFooterValue">S/ 2,987,654,321.00</p></div></footer></section>
    </div></main>`)

  for (const width of [390, 834, 1081, 1200, 1440, 1710]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 })
    const measured = await page.evaluate(() => {
      const panel = document.querySelector<HTMLElement>('[data-testid="budget-detail-panel"]')!
      const layout = document.querySelector<HTMLElement>('[data-testid="budget-detail-layout"]')!
      const rect = panel.getBoundingClientRect()
      const layoutStyle = getComputedStyle(layout)
      const overflows = Array.from(document.querySelectorAll<HTMLElement>('.detailLayout *')).filter(element => {
        const box = element.getBoundingClientRect()
        return box.width > 0 && (box.left < rect.left - 1 || box.right > rect.right + 1)
      }).length
      return {
        panelWidth: rect.width,
        panelRight: rect.right,
        documentWidth: document.documentElement.scrollWidth,
        display: getComputedStyle(layout).display,
        columns: layoutStyle.gridTemplateColumns,
        internalOverflowCount: overflows,
        font: getComputedStyle(document.querySelector('.detailMetricValue')!).fontFamily,
        metricWidths: Array.from(document.querySelectorAll<HTMLElement>('.detailMetricValue')).map(node => ({ client: node.clientWidth, scroll: node.scrollWidth })),
      }
    })
    expect(measured.documentWidth, `${width}px page should not overflow`).toBeLessThanOrEqual(width)
    expect(measured.panelWidth).toBeLessThanOrEqual(width)
    expect(measured.panelRight).toBeLessThanOrEqual(width + 0.5)
    expect(measured.internalOverflowCount, `${width}px detail descendants should stay within the panel`).toBe(0)
    expect(measured.font.toLowerCase()).toContain('manrope')
    expect(measured.metricWidths.every(metric => metric.scroll <= metric.client + 2)).toBe(true)
    if (width <= 767) expect(measured.display).toBe('flex')
    else if (width <= 1120) expect(measured.columns).not.toContain('286px')
    else expect(measured.columns).toContain('286px')
  }

  await page.locator('html').evaluate(element => element.setAttribute('data-theme', 'dark'))
  await expect(page.locator('.detailMain')).toHaveCSS('background-color', 'rgb(32, 35, 39)')
  await expect(page.locator('.periodRail')).toHaveCSS('background-color', 'rgb(41, 45, 49)')
  await expect(page.locator('.detailMetricValue').first()).toHaveCSS('color', 'rgb(237, 240, 242)')
})

test('R5.2.1 keeps the period action explanation in one budget-scoped accessible tooltip', () => {
  const actionSource = readFileSync(join(process.cwd(), 'components/management/BudgetViewPeriodAction.tsx'), 'utf8')
  expect(managerSource).toContain('<BudgetViewPeriodAction')
  expect(actionSource).toContain('role="tooltip"')
  expect(actionSource).toContain('aria-describedby={id}')
  expect(actionSource).toContain("event.key === 'Escape'")
  expect(actionSource).toContain('document.body')
})

test('R5.2.1 period control uses a month calendar while preserving the periodMonth key', () => {
  expect(managerSource).toContain('value={periodMonth}')
  expect(managerSource).toContain('onChange={setPeriodMonth}')
  expect(managerSource).toContain('<BudgetMonthPicker')
  expect(pickerSource).toContain('month: \'long\', year: \'numeric\'')
  expect(pickerSource).toContain('length: 12')
  expect(pickerSource).toContain('role="dialog"')
  expect(pickerSource).not.toContain('role="searchbox"')
  expect(shellSource).toContain("pathname === '/transactions' || pathname === '/portfolio' || pathname === '/budgets'")
  expect(managerSource).toContain('className={`${movementPageStyles.v3ModulePrimaryAction} w-full sm:w-auto`}')
})

test('budget summary reserves the same real secondary-line rhythm as approved V3 summaries', () => {
  expect(managerSource.match(/className=\{movementPageStyles\.summaryDetail\}/g)).toHaveLength(3)
  expect(managerSource).toContain('currentPeriodRows.filter(row => row.budget.currency === summary.currency).length')
  expect(managerSource).toContain('Egresos vinculados')
  expect(managerSource).toContain('Asignado menos gasto')
  expect(movementCss).toContain('.summaryDetail {')
  expect(movementCss).toContain('line-height: 18px;')
})
