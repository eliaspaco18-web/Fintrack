import { expect, test } from '@playwright/test'
import { join } from 'node:path'

for (const { name, width, expectedMovementRow } of [
  { name: 'desktop', width: 1440, expectedMovementRow: 48 },
  { name: 'tablet', width: 834, expectedMovementRow: 56 },
  { name: 'mobile', width: 390, expectedMovementRow: 56 },
] as const) {
  test(`V3 register uses ${name} row density and explicit financial direction`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/login')
    await page.evaluate(() => {
      const fixture = document.createElement('div')
      fixture.setAttribute('data-ft-v3', '')
      fixture.id = 'v3-register-fixture'
      Object.assign(fixture.style, {
        position: 'fixed', zIndex: '1000', inset: '24px auto auto 24px',
        width: 'min(800px, calc(100vw - 48px))', padding: '12px',
        background: 'var(--ft-canvas)', borderRadius: '18px',
      })
      fixture.innerHTML = `
        <section data-ft-density="movement">
          <table><thead><tr><th>Movimiento</th><th data-ft-amount-cell>Importe</th></tr></thead>
            <tbody>
              <tr><td>Ingreso registrado</td><td data-ft-amount-cell><span data-ft-amount-direction="income">+10.00</span></td></tr>
              <tr><td>Egreso registrado</td><td data-ft-amount-cell><span data-ft-amount-direction="expense">−10.00</span></td></tr>
              <tr><td>Transferencia registrada</td><td data-ft-amount-cell><span data-ft-amount-direction="transfer">10.00</span></td></tr>
            </tbody>
          </table>
        </section>
        <section data-ft-density="standard" style="margin-top:16px"><table><tbody><tr><td>Registro estándar</td></tr></tbody></table></section>
        <section data-ft-density="credit" style="margin-top:16px"><table><tbody><tr><td>Producto de crédito</td></tr></tbody></table></section>
      `
      document.body.append(fixture)
    })
    const movement = page.locator('[data-ft-density="movement"] tbody tr').first()
    const standard = page.locator('[data-ft-density="standard"] tbody tr')
    const credit = page.locator('[data-ft-density="credit"] tbody tr')
    expect(await movement.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(expectedMovementRow)
    expect(await standard.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(56)
    expect(await credit.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(name === 'mobile' ? 80 : 68)
    if (name === 'desktop') {
      expect(await page.locator('[data-ft-density="movement"] thead tr').evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(34)
    }
    await expect.poll(() => page.locator('[data-ft-amount-direction="income"]').evaluate(element => getComputedStyle(element).color)).toBe('rgb(43, 115, 86)')
    await expect.poll(() => page.locator('[data-ft-amount-direction="expense"]').evaluate(element => getComputedStyle(element).color)).toBe('rgb(173, 69, 69)')
    await expect.poll(() => page.locator('[data-ft-amount-direction="transfer"]').evaluate(element => getComputedStyle(element).color)).toBe('rgb(36, 42, 48)')
    await expect.poll(() => page.locator('[data-ft-amount-cell]').last().evaluate(element => getComputedStyle(element).textAlign)).toBe('right')

    if (process.env.V3_CAPTURE_REGISTER === '1' && name === 'desktop') {
      await page.locator('#v3-register-fixture').screenshot({ path: join(process.cwd(), 'docs/redesign-v3/implementation/stage5-register-light-1440.png') })
      await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
      await expect.poll(() => page.locator('[data-ft-amount-direction="income"]').evaluate(element => getComputedStyle(element).color)).toBe('rgb(149, 214, 173)')
      await page.locator('#v3-register-fixture').screenshot({ path: join(process.cwd(), 'docs/redesign-v3/implementation/stage5-register-dark-1440.png') })
    }
  })
}
