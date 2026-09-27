import { expect, test } from '@playwright/test'
import { join } from 'node:path'

for (const config of [
  { name: 'light-desktop', theme: 'light', width: 1440, height: 900 },
  { name: 'dark-desktop', theme: 'dark', width: 1440, height: 900 },
  { name: 'light-mobile', theme: 'light', width: 390, height: 844 },
] as const) {
  test(`V3 filter workbench and applied chips keep usable material at ${config.name}`, async ({ page }) => {
    await page.setViewportSize({ width: config.width, height: config.height })
    await page.addInitScript(value => localStorage.setItem('fintrack.theme.v1', value), config.theme)
    await page.goto('/login')
    await page.evaluate(() => {
      const overlay = document.createElement('div')
      overlay.className = 'app-modal-overlay z-modal'
      overlay.setAttribute('data-ft-v3', '')
      overlay.setAttribute('data-ft-workbench-overlay', '')
      overlay.innerHTML = `
        <div class="ft-v3-workbench-veil" aria-hidden="true"></div>
        <div class="ft-v3-workbench-wrapper">
          <div role="dialog" aria-modal="true" aria-labelledby="filter-title" data-ft-workbench="ordinary"
            class="flex flex-col overflow-hidden">
            <div class="flex shrink-0 items-start justify-between border-b">
              <div><p>Movimientos</p><h2 id="filter-title">Filtros</h2><p>Ajusta la búsqueda antes de aplicar</p></div>
              <button data-ft-button data-size="icon-md" aria-label="Cerrar panel">×</button>
            </div>
            <div data-record-modal-body="true" class="min-h-0 flex-1 overflow-y-auto">
              <div class="ft-v3-filter-fields">
                <label>Buscar<input class="field-base" value="Alquiler" /></label>
                <label>Cuenta<input class="field-base" value="Cuenta principal · PEN" /></label>
                <label>Desde<input class="field-base" type="date" value="2026-09-01" /></label>
                <div class="ft-v3-scope-chips" role="group" aria-label="Filtros aplicados">
                  <span class="ft-v3-scope-chip"><span class="ft-v3-scope-chip-label">Cuenta principal</span>
                    <button class="ft-v3-scope-chip-remove" aria-label="Quitar filtro: Cuenta principal">×</button></span>
                  <span class="ft-v3-scope-chip"><span class="ft-v3-scope-chip-label">Desde: 1 sep</span>
                    <button class="ft-v3-scope-chip-remove" aria-label="Quitar filtro: Desde: 1 sep">×</button></span>
                  <button class="ft-v3-scope-clear">Limpiar todo</button>
                </div>
              </div>
            </div>
            <div class="shrink-0 border-t">
              <div class="ft-v3-filter-footer"><button>Limpiar filtros</button>
                <div class="ft-v3-filter-footer-actions"><button>Cancelar</button><button>Aplicar filtros</button></div>
              </div>
            </div>
          </div>
        </div>`
      document.body.append(overlay)
    })

    const dialog = page.getByRole('dialog', { name: 'Filtros' })
    const surface = config.theme === 'dark' ? 'rgb(32, 35, 39)' : 'rgb(255, 255, 255)'
    await expect.poll(() => dialog.evaluate(element => getComputedStyle(element).backgroundColor)).toBe(surface)
    await expect(page.getByRole('button', { name: 'Aplicar filtros' })).toBeInViewport()
    const removeTarget = page.getByRole('button', { name: 'Quitar filtro: Cuenta principal' })
    expect(await removeTarget.evaluate(element => element.getBoundingClientRect().height))
      .toBe(config.width < 768 ? 44 : 30)
    if (process.env.V3_CAPTURE_FILTERS === '1') {
      await page.screenshot({
        path: join(process.cwd(), `docs/redesign-v3/implementation/stage5-filters-${config.name}.png`),
      })
    }
  })
}
