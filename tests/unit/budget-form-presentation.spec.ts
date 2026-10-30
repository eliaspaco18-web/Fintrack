import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'

const managerSource = readFileSync(join(process.cwd(), 'components/management/BudgetsManager.tsx'), 'utf8')
const budgetCss = readFileSync(join(process.cwd(), 'components/management/BudgetsManager.module.css'), 'utf8')
const movementPageCss = readFileSync(join(process.cwd(), 'components/tables/TransactionsRound07.module.css'), 'utf8')
const formPrimitivesSource = readFileSync(join(process.cwd(), 'components/forms/primitives.tsx'), 'utf8')

test('budget creation, editing and continuation retain the approved controls and financial fields', () => {
  expect(managerSource).toContain('<RecordModal')
  expect(managerSource).toContain('<IncomeDatePicker')
  expect(managerSource).toContain('<AppSelect')
  expect(managerSource).toContain('onInvalidInput={setDateInputError}')
  expect(managerSource).toContain('handlePeriodOrDateChange({ period_type: value as BudgetPeriod })')
  expect(managerSource).toContain('handlePeriodOrDateChange({ start_date: value })')
  expect(managerSource).toContain('data-testid="budget-name-input"')
  expect(managerSource).toContain('data-testid="budget-amount-input"')
  expect(managerSource).toContain('data-testid="budget-continuation-amount-input"')
  expect(managerSource).toContain('Guardar solo este periodo')
  expect(managerSource).toContain('Crear siguiente período')
  expect(managerSource).toContain('Información adicional')
  expect(managerSource).toContain("['description', 'Descripción', form.description]")
  expect(managerSource).toContain("['notes', 'Notas', form.notes]")
  expect(managerSource).toContain('aria-expanded={isOpen}')
  expect(managerSource).not.toContain('<OptionalSection')
})

test('budget form and controls remain usable without horizontal overflow from mobile through desktop', async ({ page }) => {
  await page.setContent(`
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; width: 100%; font: 13px Manrope, Arial, sans-serif; }
      body { padding: 16px; color: #242a30; }
      .modal { width: min(calc(100vw - 32px), 720px); margin: 0 auto; }
      .toolbar { display: flex; flex-wrap: wrap; gap: 8px; }
      .toolbar > * { min-width: 0; }
      .periods { display: flex; gap: 12px; }
      .filters-control { width: 150px; flex: 0 0 auto; min-height: 40px; border: 1px solid #dfe3e7; border-radius: 8px; background: white; }
      .search-control { min-height: 40px; border: 1px solid #dfe3e7; border-radius: 8px; }
      .statusFilters button, .viewToggle, .countBadge { min-height: 34px; padding: 0 10px; border: 1px solid #dfe3e7; border-radius: 8px; background: white; }
      .budgetFormSection { display: grid; gap: 14px; }
      .budgetFormSection > div:last-child { display: grid; }
      .field { display: grid; gap: 6px; min-width: 0; }
      .fieldLabelRow { display: flex; min-height: 24px; align-items: center; gap: 6px; }
      .control { width: 100%; min-height: 42px; border: 1px solid #dfe3e7; border-radius: 8px; padding: 8px; }
      .tooltipButton { width: 24px; height: 24px; flex: 0 0 24px; }
      .v3ModuleContent { max-width: 1440px; margin: 0 auto; }
      ${movementPageCss}
      ${budgetCss}
    </style>
    <main class="v3ModuleContent">
      <div class="pageOverview" data-testid="budget-header-fixture">
        <header><div><h1>Presupuestos</h1><p>Límites que puedes revisar antes de tu próximo gasto.</p></div><button class="v3ModulePrimaryAction">Crear presupuesto</button></header>
        <section class="summary" data-testid="budget-summary-fixture"><div class="summaryCurrency"><div class="summaryItem"><p>Asignado · PEN</p><strong class="summaryValue">S/ 1,234,567.89</strong></div><div class="summaryItem"><p>Gasto vinculado · PEN</p><strong class="summaryValue">S/ 876,543.21</strong></div><div class="summaryItem"><p>Disponible · PEN</p><strong class="summaryValue">S/ 358,024.68</strong></div></div></section>
      </div>
      <section class="modal" data-testid="budget-modal-fixture">
      <section class="budgetControls" data-testid="budget-controls-fixture">
        <div class="budgetPeriodNavigation">
          <nav class="budgetTabs"><button class="budgetTab" data-active="true">Este período <span class="budgetTabCount">8</span></button><button class="budgetTab">Excedidos <span class="budgetTabCount">2</span></button><button class="budgetTab">Otros períodos</button></nav>
          <div class="periodControls"><span class="periodControlsLabel">Período</span><button class="filters-control">Octubre</button><button class="filters-control">2026</button><button>Actualizar</button></div>
        </div>
        <div class="budgetFilterToolbar">
          <div class="statusFilters"><button>Activos</button><button>Inactivos</button><button>Todos</button></div>
          <div class="budgetSearch"><input class="search-control" aria-label="Buscar presupuestos" placeholder="Buscar presupuesto"></div>
          <button class="filters-control">Moneda</button><button class="filters-control">Periodicidad</button><button class="filters-control">Categoría</button>
          <button class="viewToggle">Tarjetas</button><span class="countBadge">8 presupuestos</span>
        </div>
      </section>
      <div class="budgetFormSections">
        <section class="budgetFormSection">
          <h2>Datos del presupuesto</h2>
          <div>
            <label class="field"><span class="fieldLabelRow"><span>Nombre</span><button class="tooltipButton" aria-label="Ayuda sobre el nombre">!</button></span><input class="control" value="Servicios del hogar"></label>
            <div class="identityFields">
              <label class="field">Categoría<button class="control">General</button></label>
              <label class="field">Periodicidad<button class="control">Mensual</button></label>
            </div>
          </div>
        </section>
        <section class="budgetFormSection">
          <h2>Límite y vigencia</h2>
          <div>
            <div class="amountFields"><label class="field">Monto<input class="control" value="1250.00"></label><label class="field">Moneda<button class="control">PEN</button></label></div>
            <div class="dateFields"><label class="field">Fecha de inicio<button class="control">01/10/2026</button></label><label class="field">Fecha de fin calculada<div class="control">31/10/2026</div></label></div>
          </div>
        </section>
        <section class="incomeOptionalSection"><h2>Información adicional</h2><button>Descripción</button><button>Notas</button></section>
      </div>
      </section>
    </main>`)

  for (const width of [390, 768, 834, 1440, 1710]) {
    await page.setViewportSize({ width, height: 900 })
    const geometry = await page.evaluate(() => {
      const modal = document.querySelector<HTMLElement>('[data-testid="budget-modal-fixture"]')
      const toolbar = document.querySelector<HTMLElement>('[data-testid="budget-controls-fixture"]')
      const header = document.querySelector<HTMLElement>('[data-testid="budget-header-fixture"]')
      const summary = document.querySelector<HTMLElement>('[data-testid="budget-summary-fixture"]')
      const action = document.querySelector<HTMLElement>('.v3ModulePrimaryAction')
      const fields = Array.from(document.querySelectorAll<HTMLElement>('.control, .tooltipButton'))
      if (!modal || !toolbar || !header || !summary || !action) throw new Error('Budget form fixture did not render')
      const rect = modal.getBoundingClientRect()
      const toolbarRect = toolbar.getBoundingClientRect()
      const headerRect = header.getBoundingClientRect()
      const summaryRect = summary.getBoundingClientRect()
      const actionRect = action.getBoundingClientRect()
      return {
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        modalLeft: rect.left,
        modalRight: rect.right,
        toolbarLeft: toolbarRect.left,
        toolbarRight: toolbarRect.right,
        toolbarHeight: toolbarRect.height,
        headerRight: headerRect.right,
        summaryRight: summaryRect.right,
        actionHeight: actionRect.height,
        fieldRects: fields.map(field => {
          const fieldRect = field.getBoundingClientRect()
          return { left: fieldRect.left, right: fieldRect.right, width: fieldRect.width }
        }),
      }
    })
    expect(geometry.documentWidth, `${width}px page should not overflow horizontally`).toBeLessThanOrEqual(width)
    expect(geometry.modalLeft).toBeGreaterThanOrEqual(0)
    expect(geometry.modalRight).toBeLessThanOrEqual(width)
    expect(geometry.toolbarLeft).toBeGreaterThanOrEqual(0)
    expect(geometry.toolbarRight).toBeLessThanOrEqual(width)
    expect(geometry.toolbarHeight).toBeGreaterThan(0)
    expect(geometry.headerRight).toBeLessThanOrEqual(width)
    expect(geometry.summaryRight).toBeLessThanOrEqual(width)
    expect(geometry.actionHeight).toBe(36)
    expect(geometry.fieldRects.every(rect => rect.width > 0 && rect.left >= 0 && rect.right <= width)).toBe(true)
  }
})

test('budget summary labels and full amounts fit their indicators on narrow mobile widths', async ({ page }) => {
  await page.setContent(`
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; width: 100%; font: 13px Manrope, Arial, sans-serif; }
      main { width: 100%; padding: 16px; }
      ${movementPageCss}
      ${budgetCss}
    </style>
    <main>
      <section class="summary" aria-label="Resumen de presupuestos">
        <div class="summaryCurrency" data-testid="budget-currency-indicators">
          <div class="summaryItem"><p>Asignado · PEN</p><div class="summaryValue">S/ 12,345,678.90</div></div>
          <div class="summaryItem"><p>Gasto vinculado · PEN</p><div class="summaryValue">S/ 987,654,321.09</div></div>
          <div class="summaryItem"><p>Disponible · PEN</p><div class="summaryValue">S/ 1,234,567.89</div></div>
        </div>
      </section>
    </main>`)

  for (const width of [320, 360, 390, 421, 480, 520, 560]) {
    await page.setViewportSize({ width, height: 900 })
    const geometry = await page.evaluate(() => {
      const indicators = document.querySelector<HTMLElement>('[data-testid="budget-currency-indicators"]')
      if (!indicators) throw new Error('Budget currency indicators did not render')
      const items = Array.from(indicators.querySelectorAll<HTMLElement>('.summaryItem'))
      const columns = getComputedStyle(indicators).gridTemplateColumns.split(' ').length
      const measuredItems = items.map(item => {
        const label = item.querySelector<HTMLElement>('p')
        const value = item.querySelector<HTMLElement>('.summaryValue')
        if (!label || !value) throw new Error('Budget summary label or value is missing')
        const labelRange = document.createRange()
        labelRange.selectNodeContents(label)
        const valueRange = document.createRange()
        valueRange.selectNodeContents(value)
        const itemRect = item.getBoundingClientRect()
        const labelRects = Array.from(labelRange.getClientRects()).map(rect => ({ left: rect.left, right: rect.right }))
        const valueRects = Array.from(valueRange.getClientRects()).map(rect => ({ left: rect.left, right: rect.right }))
        return {
          item: { left: itemRect.left, right: itemRect.right, top: itemRect.top, bottom: itemRect.bottom },
          labelRects,
          valueRects,
          valueClientWidth: value.clientWidth,
          valueScrollWidth: value.scrollWidth,
          labelClientWidth: label.clientWidth,
          labelScrollWidth: label.scrollWidth,
        }
      })
      return {
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        columns,
        indicatorRect: (() => { const rect = indicators.getBoundingClientRect(); return { left: rect.left, right: rect.right } })(),
        items: measuredItems,
      }
    })

    expect(geometry.documentWidth, `${width}px viewport must not overflow`).toBeLessThanOrEqual(width)
    expect(geometry.indicatorRect.left).toBeGreaterThanOrEqual(0)
    expect(geometry.indicatorRect.right).toBeLessThanOrEqual(width)
    expect(geometry.items).toHaveLength(3)
    if (width <= 390) expect(geometry.columns, `${width}px should stack the currency indicators`).toBe(1)
    if (width >= 421) expect(geometry.columns, `${width}px should use readable multi-column indicators`).toBeGreaterThanOrEqual(2)
    for (const item of geometry.items) {
      expect(item.valueScrollWidth, `${width}px amount should not overflow its value control`).toBeLessThanOrEqual(item.valueClientWidth)
      expect(item.labelScrollWidth, `${width}px label should not overflow its control`).toBeLessThanOrEqual(item.labelClientWidth)
      for (const rect of [...item.labelRects, ...item.valueRects]) {
        expect(rect.left).toBeGreaterThanOrEqual(item.item.left - 0.5)
        expect(rect.right).toBeLessThanOrEqual(item.item.right + 0.5)
      }
    }
    for (let index = 1; index < geometry.items.length; index += 1) {
      const previous = geometry.items[index - 1]?.item
      const current = geometry.items[index]?.item
      if (!previous || !current) throw new Error('Budget indicator geometry is incomplete')
      const overlaps = previous.left < current.right && current.left < previous.right && previous.top < current.bottom && current.top < previous.bottom
      expect(overlaps, `${width}px indicator items must not overlap`).toBe(false)
    }
  }
})

test('budget information hints sit beside their field labels and optional fields do not claim saved state', () => {
  expect(formPrimitivesSource).toContain('labelAdornment?: ReactNode')
  expect(managerSource).toContain('labelAdornment={<BudgetInfoHint label="Ayuda sobre el nombre">')
  expect(managerSource).toContain('labelAdornment={<BudgetInfoHint label="Ayuda sobre la categoría">')
  expect(managerSource).toContain('labelAdornment={<BudgetInfoHint label="Ayuda sobre la periodicidad">')
  expect(managerSource).toContain('labelAdornment={<BudgetInfoHint label="Ayuda sobre la fecha de fin">')
  expect(managerSource).not.toContain('fieldWithHint')
  expect(managerSource).not.toContain('Guardado')
  expect(managerSource).toContain("data-has-value={value.trim() ? 'true' : 'false'}")
})
