import { expect, test } from '@playwright/test'
import { join } from 'node:path'

const sizes = [
  { name: 'desktop', width: 1440, height: 900, inset: 12, panelWidth: 580 },
  { name: 'tablet', width: 834, height: 1112, inset: 12, panelWidth: 580 },
  { name: 'mobile', width: 390, height: 844, inset: 8, panelWidth: 374 },
  { name: 'narrow-mobile', width: 320, height: 680, inset: 8, panelWidth: 304 },
] as const

for (const size of sizes) {
  test(`V3 ordinary workbench keeps detached geometry and a reachable footer at ${size.name}`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height })
    await page.goto('/login')
    await page.evaluate(() => {
      const overlay = document.createElement('div')
      overlay.className = 'app-modal-overlay z-modal'
      overlay.setAttribute('data-ft-v3', '')
      overlay.setAttribute('data-ft-workbench-overlay', '')
      overlay.innerHTML = `
        <div class="ft-v3-workbench-veil" data-ft-workbench-veil="" aria-hidden="true"></div>
        <div class="ft-v3-workbench-wrapper">
          <div role="dialog" aria-modal="true" aria-labelledby="v3-workbench-title"
            data-ft-workbench="ordinary"
            class="flex flex-col overflow-hidden rounded-panel border bg-[var(--ft-modal-bg)] shadow-elevation-xl">
            <div class="flex shrink-0 items-start justify-between border-b">
              <div><p>Movimiento · Detalle</p><h2 id="v3-workbench-title" tabindex="-1">Ingreso registrado</h2>
                <p>Cuenta principal</p></div>
              <button data-ft-button data-size="icon-md" aria-label="Cerrar panel">×</button>
            </div>
            <div data-record-modal-body="true" class="min-h-0 flex-1 overflow-y-auto">
              <p>Importe original: S/ 1,250.50</p>
              <div style="height:1600px">Contenido sintético largo</div>
              <p id="last-field">Último campo</p>
            </div>
            <div class="shrink-0 border-t"><p>Registro verificado</p><button>Guardar cambios</button></div>
          </div>
        </div>`
      document.body.append(overlay)
    })

    const panel = page.locator('[data-ft-workbench="ordinary"]')
    const bounds = await panel.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.x + bounds!.width).toBeCloseTo(size.width - size.inset, 0)
    expect(bounds!.y).toBeCloseTo(size.inset, 0)
    expect(bounds!.width).toBeCloseTo(size.panelWidth, 0)
    expect(bounds!.height).toBeCloseTo(size.height - size.inset * 2, 0)
    await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeInViewport()
    expect(await panel.evaluate(element => getComputedStyle(element).borderTopLeftRadius)).toBe('24px')

    if (process.env.V3_CAPTURE_WORKBENCH === '1' && size.name !== 'narrow-mobile') {
      await page.screenshot({
        path: join(process.cwd(), `docs/redesign-v3/implementation/stage5-workbench-${size.name}.png`),
      })
    }

    await panel.locator('[data-record-modal-body]').evaluate(element => { element.scrollTop = element.scrollHeight })
    await expect(page.locator('#last-field')).toBeInViewport()
    await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeInViewport()
  })
}

test('V3 schedule workbench uses its bounded 960px width', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/login')
  await page.evaluate(() => {
    const overlay = document.createElement('div')
    overlay.className = 'app-modal-overlay z-modal'
    overlay.setAttribute('data-ft-v3', '')
    overlay.setAttribute('data-ft-workbench-overlay', '')
    overlay.innerHTML = '<div class="ft-v3-workbench-veil" data-ft-workbench-veil=""></div><div class="ft-v3-workbench-wrapper"><div data-ft-workbench="schedule"></div></div>'
    document.body.append(overlay)
  })
  expect(await page.locator('[data-ft-workbench="schedule"]').evaluate(element => element.getBoundingClientRect().width)).toBe(960)
})
