import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'

const managerSource = readFileSync(join(process.cwd(), 'components/management/BudgetsManager.tsx'), 'utf8')
const budgetCss = readFileSync(join(process.cwd(), 'components/management/BudgetsManager.module.css'), 'utf8')
const movementPageCss = readFileSync(join(process.cwd(), 'components/tables/TransactionsRound07.module.css'), 'utf8')

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
            <div class="fieldWithHint"><label class="field">Nombre<input class="control" value="Servicios del hogar"></label><span class="fieldHint"><button class="tooltipButton" aria-label="Ayuda sobre el nombre">!</button></span></div>
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
