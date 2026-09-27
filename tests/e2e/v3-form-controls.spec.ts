import { expect, test } from '@playwright/test'
import { join } from 'node:path'

for (const theme of ['light', 'dark'] as const) {
  test(`V3 form controls preserve field geometry and accessible states in ${theme}`, async ({ page }) => {
    await page.addInitScript(value => localStorage.setItem('fintrack.theme.v1', value), theme)
    await page.goto('/login')
    await page.evaluate(() => {
      const fixture = document.createElement('section')
      fixture.id = 'v3-field-fixture'
      fixture.setAttribute('data-ft-v3', '')
      fixture.setAttribute('aria-label', 'Synthetic V3 control fixture')
      fixture.innerHTML = `
        <label for="v3-name">Nombre</label>
        <input id="v3-name" class="field-base ft-form-input" placeholder="Cuenta de ahorro" />
        <label for="v3-amount">Importe</label>
        <input id="v3-amount" class="field-base ft-form-amount-input" value="1,250.50" />
        <label for="v3-notes">Notas</label>
        <textarea id="v3-notes" class="field-base ft-form-textarea"></textarea>
        <label for="v3-error">Campo con error</label>
        <input id="v3-error" class="field-base ft-form-input" aria-invalid="true" aria-describedby="v3-error-help" />
        <span id="v3-error-help">Revisa este campo</span>
        <label for="v3-disabled">No disponible</label>
        <input id="v3-disabled" class="field-base ft-form-input" disabled value="Conservado" />
      `
      Object.assign(fixture.style, {
        position: 'fixed', zIndex: '1000', left: '24px', top: '24px', width: '360px',
        display: 'grid', gap: '6px', padding: '20px', borderRadius: '18px',
        background: 'var(--ft-surface)', color: 'var(--ft-text-strong)',
      })
      document.body.append(fixture)
    })

    const name = page.locator('#v3-name')
    const amount = page.locator('#v3-amount')
    const notes = page.locator('#v3-notes')
    const invalid = page.locator('#v3-error')
    const disabled = page.locator('#v3-disabled')
    const expectedSurface = theme === 'dark' ? 'rgb(32, 35, 39)' : 'rgb(255, 255, 255)'
    const expectedDanger = theme === 'dark' ? 'rgb(242, 160, 155)' : 'rgb(173, 69, 69)'

    await expect.poll(() => name.evaluate(element => getComputedStyle(element).backgroundColor)).toBe(expectedSurface)
    expect(await name.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)
    expect(await amount.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(64)
    expect(await amount.evaluate(element => getComputedStyle(element).fontSize)).toBe('28px')
    expect(await notes.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(88)
    await expect.poll(() => invalid.evaluate(element => getComputedStyle(element).borderTopColor)).toBe(expectedDanger)
    await expect(invalid).toHaveAttribute('aria-describedby', 'v3-error-help')
    await expect(disabled).toBeDisabled()
    expect(await disabled.evaluate(element => getComputedStyle(element).opacity)).toBe('1')
    await name.focus()
    await expect.poll(() => name.evaluate(element => getComputedStyle(element).outlineStyle)).toBe('solid')

    if (process.env.V3_CAPTURE_FIELDS === '1') {
      await page.locator('#v3-field-fixture').screenshot({
        path: join(process.cwd(), `docs/redesign-v3/implementation/stage4-fields-${theme}.png`),
      })
    }
  })
}
