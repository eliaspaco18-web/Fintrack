import { expect, test } from '@playwright/test'

const legacy = {
  light: { background: 'rgb(250, 250, 247)', font: 'Geist' },
  dark: { background: 'rgb(22, 22, 21)', font: 'Geist' },
} as const

const approved = {
  light: { canvas: '#F5F6F7', surface: '#FFFFFF', primary: '#155E59', radius: '18px' },
  dark: { canvas: '#17191C', surface: '#202327', primary: '#8AD1BF', radius: '18px' },
} as const

for (const theme of ['light', 'dark'] as const) {
  test(`V3 foundation is isolated and correct in ${theme}`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem('fintrack.theme.v1', value), theme)
    await page.goto('/login')

    const before = await page.locator('body').evaluate((body) => ({
      background: getComputedStyle(body).backgroundColor,
      font: getComputedStyle(body).fontFamily,
      opted: body.hasAttribute('data-ft-v3'),
    }))
    expect(before.opted).toBe(false)
    expect(before.background).toBe(legacy[theme].background)
    expect(before.font).toContain(legacy[theme].font)

    const sentinel = await page.evaluate(async () => {
      const section = document.createElement('section')
      section.setAttribute('data-ft-v3', '')
      section.setAttribute('aria-label', 'V3 foundation sentinel')
      section.textContent = 'S/ 1,234.50 · US$ 98.00'
      document.body.append(section)
      const css = getComputedStyle(section)
      await document.fonts.load(`600 20px ${css.fontFamily}`)
      return {
        canvas: css.getPropertyValue('--ft-canvas').trim(),
        surface: css.getPropertyValue('--ft-surface').trim(),
        primary: css.getPropertyValue('--ft-primary').trim(),
        radius: css.getPropertyValue('--ft-radius-surface').trim(),
        font: css.fontFamily,
        loaded: document.fonts.check(`600 20px ${css.fontFamily}`),
        legacyBackground: getComputedStyle(document.body).backgroundColor,
      }
    })

    expect(sentinel).toMatchObject({
      ...approved[theme],
      loaded: true,
      legacyBackground: legacy[theme].background,
    })
    expect(sentinel.font).toContain('__fintrackV3Font')
  })
}
