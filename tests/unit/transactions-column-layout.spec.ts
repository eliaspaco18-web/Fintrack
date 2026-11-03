import { expect, test } from '@playwright/test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const cssRoot = join(process.cwd(), '.next', 'static', 'css')
const css = readdirSync(cssRoot, { recursive: true }).map(String)
  .filter(file => file.endsWith('.css'))
  .map(file => readFileSync(join(cssRoot, file), 'utf8'))
  .join('\n')

for (const width of [390, 834, 1440]) {
  test(`movement columns remain readable at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 })
    await page.setContent(`
      <main class="p-4">
        <div class="hidden min-w-0 md:block">
        <div class="overflow-x-auto">
          <table class="desktop-table min-w-[900px] w-full table-fixed border-collapse text-left">
            <colgroup><col style="width:5%"><col style="width:28%"><col style="width:17%"><col style="width:18%"><col style="width:11%"><col style="width:14%"><col style="width:7%"></colgroup>
            <thead><tr><th>✓</th><th>Movimiento</th><th>Cuenta / ruta</th><th>Categoría</th><th>Fecha</th><th>Importe</th><th>Acciones</th></tr></thead>
            <tbody><tr>
              <td>✓</td>
              <td><div class="flex min-w-0 items-center gap-2"><span class="shrink-0">●</span><p class="min-w-0 truncate">Movimiento recurrente de alquiler de oficina con referencia de octubre</p></div></td>
              <td><span class="block truncate">Cuenta operativa principal en soles</span></td><td>Servicios</td>
              <td class="whitespace-nowrap">31 oct 2026</td><td class="whitespace-nowrap text-right">S/ 12,500.00</td><td>Editar</td>
            </tr></tbody>
          </table>
        </div>
        </div>
        <div class="mobile-ledger md:hidden">Vista móvil</div>
      </main>`)
    await page.addStyleTag({ content: css })

    const result = await page.evaluate(() => {
      const table = document.querySelector('table')!
      const cells = table.querySelectorAll('th')
      const row = table.querySelector('tbody tr')!
      const movement = row.children[1] as HTMLElement
      const date = row.children[4] as HTMLElement
      return {
        display: getComputedStyle(table.parentElement!.parentElement!).display,
        tableWidth: table.getBoundingClientRect().width,
        parentWidth: table.parentElement!.clientWidth,
        movementWidth: cells[1]!.getBoundingClientRect().width,
        dateWidth: cells[4]!.getBoundingClientRect().width,
        movementTextFits: (movement.querySelector('p') as HTMLElement).clientWidth <= movement.clientWidth,
        rowRight: row.getBoundingClientRect().right,
        dateRight: date.getBoundingClientRect().right,
      }
    })
    if (width < 768) {
      expect(result.display).toBe('none')
      await expect(page.locator('.mobile-ledger')).toBeVisible()
    } else {
      expect(result.display).not.toBe('none')
      expect(result.tableWidth).toBeGreaterThanOrEqual(900)
      expect(result.movementWidth).toBeGreaterThan(result.dateWidth * 1.8)
      expect(result.dateRight).toBeLessThanOrEqual(result.rowRight + 1)
      expect(result.movementTextFits).toBe(true)
      expect(result.parentWidth).toBeLessThanOrEqual(width)
    }
    await page.screenshot({ path: testInfo.outputPath(`movement-columns-${width}.png`), fullPage: true })
  })
}
