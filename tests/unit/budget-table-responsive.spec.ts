import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'

const TABLE_MARKUP = `
  <div class="layout">
    <aside aria-hidden="true"></aside>
    <main>
      <div class="periodTable">
        <div class="periodHeader">
          <span>Presupuesto</span><span>Gastado</span><span>Límite</span>
          <span>Ejecución</span><span>Disponible</span><span>Acciones</span>
        </div>
        <article class="periodRow">
          <div><p>Casa y servicios</p><p>General · Mensual</p><p>01 ago. 2026 – 31 ago. 2026</p></div>
          <div><p class="summaryValue" data-amount>US$ 12,345,678.90</p></div>
          <div><p class="summaryValue" data-amount>S/ 12,345,678.90</p></div>
          <div><span>86.5%</span><div class="progressTrack"><div class="progressFill" style="width:86.5%"></div></div><p>Del límite asignado</p></div>
          <div><p class="summaryValue" data-amount>US$ 12,345,678.90</p><span>Activo</span></div>
          <div class="periodActions"><button aria-label="Ver detalle">Ver</button><button aria-label="Editar">Editar</button></div>
        </article>
      </div>
    </main>
  </div>`

test('period table keeps six readable columns and complete amounts/actions with expanded sidebar widths', async ({ page }) => {
  const css = readFileSync(join(process.cwd(), 'components/management/BudgetsManager.module.css'), 'utf8')
  await page.setContent(`
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; width: 100%; }
      body { font: 13px Manrope, Arial, sans-serif; color: #242a30; }
      .layout { display: grid; grid-template-columns: 248px minmax(0, 1fr); width: 100vw; }
      aside { min-height: 1px; }
      main { min-width: 0; padding: 0 24px; }
      .periodRow > * { min-width: 0; }
      .periodHeader > *, .periodRow > * { min-width: 0; }
      .periodRow p { margin: 0; }
      .periodRow > div:first-child p:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .periodActions { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }
      .periodActions button { flex: 0 0 32px; width: 32px; height: 32px; }
      .progressTrack { margin-top: 4px; }
      .periodTable { border: 1px solid #dfe3e7; }
      ${css}
    </style>
    ${TABLE_MARKUP}`)

  for (const viewportWidth of [1081, 1200, 1280]) {
    await page.setViewportSize({ width: viewportWidth, height: 900 })
    const metrics = await page.evaluate(() => {
      const table = document.querySelector<HTMLElement>('.periodTable')
      const header = document.querySelector<HTMLElement>('.periodHeader')
      const row = document.querySelector<HTMLElement>('.periodRow')
      if (!table || !header || !row) throw new Error('Budget table fixture did not render')
      const tableRect = table.getBoundingClientRect()
      const headerRect = header.getBoundingClientRect()
      const rowRect = row.getBoundingClientRect()
      const tracks = getComputedStyle(header).gridTemplateColumns.split(' ').filter(Boolean)
      const amounts = Array.from(row.querySelectorAll<HTMLElement>('[data-amount]')).map(element => ({
        text: element.textContent?.trim(),
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        rectRight: element.getBoundingClientRect().right,
      }))
      const action = row.querySelector<HTMLElement>('.periodActions')
      const actionButtons = Array.from(action?.querySelectorAll('button') ?? []).map(button => {
        const rect = button.getBoundingClientRect()
        return { left: rect.left, right: rect.right, width: rect.width }
      })
      return {
        table: { left: tableRect.left, right: tableRect.right, width: tableRect.width },
        header: { left: headerRect.left, right: headerRect.right, display: getComputedStyle(header).display },
        row: { left: rowRect.left, right: rowRect.right, width: rowRect.width },
        tracks,
        amounts,
        actionButtons,
        actionRight: action?.getBoundingClientRect().right ?? Number.NaN,
      }
    })

    expect(metrics.header.display, `${viewportWidth}px header should stay visible in six-column layout`).not.toBe('none')
    expect(metrics.tracks, `${viewportWidth}px should preserve six aligned columns`).toHaveLength(6)
    expect(metrics.table.right).toBeLessThanOrEqual(viewportWidth)
    expect(metrics.header.left).toBeGreaterThanOrEqual(metrics.table.left)
    expect(metrics.header.right).toBeLessThanOrEqual(metrics.table.right + 1)
    expect(metrics.row.right).toBeLessThanOrEqual(metrics.table.right + 1)
    expect(metrics.amounts.every(amount => amount.text && amount.scrollWidth <= amount.clientWidth + 1)).toBe(true)
    expect(metrics.amounts.every(amount => amount.rectRight <= metrics.row.right + 1)).toBe(true)
    expect(metrics.actionRight).toBeLessThanOrEqual(metrics.row.right + 1)
    expect(metrics.actionButtons).toHaveLength(2)
    expect(metrics.actionButtons.every(button => button.width >= 32 && button.left >= metrics.row.left && button.right <= metrics.row.right + 1)).toBe(true)
    console.log(`Budget table ${viewportWidth}px with expanded sidebar`, JSON.stringify(metrics))
  }
})
