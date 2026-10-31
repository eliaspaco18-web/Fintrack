import { expect, test } from '@playwright/test'
import { readdirSync, readFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

for (const width of [390, 1440]) {
  test(`long movement text stays in its column at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    const root = join(process.cwd(), '.next/static/css')
    const css = readdirSync(root, { recursive: true }).map(String).filter(f => f.endsWith('.css')).map(f => readFileSync(join(root, f), 'utf8')).join('\n')
    await page.setContent(`<main style="padding:24px"><h1>Movimientos</h1><table style="table-layout:fixed;width:100%;border-collapse:collapse"><colgroup><col style="width:50%"><col style="width:50%"></colgroup><thead><tr><th>Movimiento</th><th>Cuenta / ruta</th></tr></thead><tbody><tr><td><button class="flex w-full min-h-8 min-w-0 items-center gap-2.5"><span style="width:28px;flex-shrink:0">●</span><div class="min-w-0"><p class="truncate">Movimiento con una descripción muy larga y sin espacios ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMN</p></div></button></td><td><div class="flex min-w-0 items-center gap-1"><span class="truncate">Cuenta principal con nombre muy largo</span></div></td></tr></tbody></table><p style="max-width:160px" class="[overflow-wrap:anywhere]">ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZ</p></main>`)
    await page.addStyleTag({ content: css })
    const metrics = await page.locator('td').evaluateAll(cells => {
      const first = cells[0]!.getBoundingClientRect()
      const button = cells[0]!.querySelector('button')!.getBoundingClientRect()
      const second = cells[1]!.getBoundingClientRect()
      return { firstRight: first.right, buttonRight: button.right, secondLeft: second.left }
    })
    expect(metrics.buttonRight).toBeLessThanOrEqual(metrics.secondLeft + 1)
    expect(await page.locator('main > p').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
    mkdirSync('/private/tmp/fintrack-v3-evidence', { recursive: true })
    await page.screenshot({ path: `/private/tmp/fintrack-v3-evidence/overflow-fixture-${width}.png` })
  })
}
