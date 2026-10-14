import { expect, test } from '@playwright/test'
import {
  getTriggerMatchedMenuStyle,
  resolveAppSelectPortalRoot,
} from '../../components/ui/AppSelect'

test.describe('AppSelect trigger-matched menu layout', () => {
  test('keeps the menu aligned to the trigger and uses its exact width', () => {
    const style = getTriggerMatchedMenuStyle(
      { left: 96, top: 120, bottom: 164, width: 236 },
      { left: 0, top: 0, width: 1024, height: 768 },
      280,
    )

    expect(style.left).toBe(96)
    expect(style.width).toBe(236)
    expect(style.maxWidth).toBe(236)
    expect(style.top).toBe(172)
  })

  test('clamps a trigger near the right edge without changing its available width', () => {
    const style = getTriggerMatchedMenuStyle(
      { left: 740, top: 120, bottom: 164, width: 260 },
      { left: 0, top: 0, width: 800, height: 768 },
      240,
    )

    expect(style.left).toBe(532)
    expect(style.width).toBe(260)
  })

  test('flips above the trigger when the lower viewport space is insufficient', () => {
    const style = getTriggerMatchedMenuStyle(
      { left: 40, top: 332, bottom: 372, width: 220 },
      { left: 0, top: 0, width: 390, height: 400 },
      220,
    )

    expect(style.top).toBe(104)
    expect(style.transformOrigin).toBe('bottom center')
  })

  test('clamps width and height to a narrow visual viewport', () => {
    const style = getTriggerMatchedMenuStyle(
      { left: 18, top: 16, bottom: 60, width: 360 },
      { left: 0, top: 0, width: 320, height: 480 },
      700,
    )

    expect(style.left).toBe(8)
    expect(style.width).toBe(304)
    expect(style.maxWidth).toBe(304)
    expect(style.maxHeight).toBe(404)
    expect(style.top).toBe(68)
  })

  test('keeps a trigger-matched menu in the modal focus scope instead of behind its overlay', () => {
    const focusScope = {
      hasAttribute: (name: string) => name === 'data-app-select-portal-root',
    }
    const dialog = { parentElement: focusScope }
    const wrapper = { closest: (selector: string) => selector === '[role="dialog"]' ? dialog : null }
    const body = {} as HTMLElement

    expect(resolveAppSelectPortalRoot(
      wrapper as unknown as HTMLElement,
      body,
      true,
    )).toBe(focusScope)
    expect(resolveAppSelectPortalRoot(
      wrapper as unknown as HTMLElement,
      body,
      false,
    )).toBe(dialog)
  })

  test('retains the body fallback when a matching-width select is outside a modal', () => {
    const body = {} as HTMLElement
    const wrapper = { closest: () => null }

    expect(resolveAppSelectPortalRoot(
      wrapper as unknown as HTMLElement,
      body,
      true,
    )).toBe(body)
  })

  test('renders above the dialog and remains inside its focus-trap scope', async ({ page }) => {
    await page.setContent(`
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; }
        .overlay { position: fixed; inset: 0; z-index: 120; background: rgb(0 0 0 / .35); }
        .focus-scope { position: relative; z-index: 1; width: 100%; height: 100%; }
        .dialog { position: absolute; inset: 15% 20%; overflow: hidden; background: white; }
        .dialog-content { position: relative; z-index: 1; height: 100%; }
        .menu { position: fixed; z-index: 40; left: 40%; top: 35%; width: 220px; height: 120px; background: white; border: 1px solid; }
      </style>
      <div class="overlay">
        <div class="focus-scope" data-app-select-portal-root>
          <div class="dialog" role="dialog"><div class="dialog-content">Dialog</div></div>
          <div class="menu" role="listbox" tabindex="0">Options</div>
        </div>
      </div>
    `)

    const result = await page.evaluate(() => {
      const menu = document.querySelector<HTMLElement>('.menu')!
      const point = menu.getBoundingClientRect()
      return {
        topElement: document.elementFromPoint(point.left + point.width / 2, point.top + point.height / 2)?.className,
        withinFocusScope: document.querySelector('.focus-scope')?.contains(menu) ?? false,
        menuVisible: getComputedStyle(menu).visibility === 'visible',
      }
    })

    expect(result.topElement).toBe('menu')
    expect(result.withinFocusScope).toBe(true)
    expect(result.menuVisible).toBe(true)
  })
})
