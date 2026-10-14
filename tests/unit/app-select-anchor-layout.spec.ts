import { expect, test } from '@playwright/test'
import { getTriggerMatchedMenuStyle } from '../../components/ui/AppSelect'

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
})
