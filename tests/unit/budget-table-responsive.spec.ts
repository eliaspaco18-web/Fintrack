import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'

const TABLE_MARKUP = `
  <div class="layout">
    <aside aria-hidden="true"></aside>
    <main>
      <div class="periodTable">
        <div class="periodHeader">
          <span>Presupuesto</span><span>Uso del límite</span><span>Gasto / límite</span>
          <span>Disponible</span><span>Acciones</span>
        </div>
        <article class="periodRow">
          <div><p>Casa y servicios</p><p>General · Mensual</p><p>01 ago. 2026 – 31 ago. 2026</p></div>
          <div class="periodProgress"><span>86.5%</span><div class="progressTrack"><div class="progressFill" style="width:86.5%"></div></div><p>Del límite asignado</p></div>
          <div class="periodSpentLimit"><div><p>Gastado</p><p class="summaryValue" data-amount>US$ 12,345,678.90</p></div><div><p>Límite</p><p class="summaryValue" data-amount>S/ 12,345,678.90</p></div></div>
          <div><p class="summaryValue" data-amount>S/ 12,345,678.90</p><span>Activo</span></div>
          <div class="periodActions"><button aria-label="Ver detalle">Ver</button><button aria-label="Editar">Editar</button></div>
        </article>
      </div>
    </main>
  </div>`

test('period table keeps five aligned columns and complete amounts/actions with expanded sidebar', async ({ page }) => {
  const css = readFileSync(join(process.cwd(), 'components/management/BudgetsManager.module.css'), 'utf8')
  await page.setContent(`
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; width: 100%; }
      body { font: 13px Manrope, Arial, sans-serif; color: #242a30; }
      .layout { display: grid; grid-template-columns: 248px minmax(0, 1fr); width: 100vw; }
      aside { min-height: 1px; }
      main { min-width: 0; padding: 0 24px; }
      .periodRow > *, .periodHeader > * { min-width: 0; }
      .periodRow p { margin: 0; }
      .periodRow > div:first-child p:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .periodActions { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }
      .periodActions button { flex: 0 0 32px; width: 32px; height: 32px; }
      .progressTrack { margin-top: 4px; }
      .periodTable { border: 1px solid #dfe3e7; }
      ${css}
    </style>
    ${TABLE_MARKUP}`)

  for (const [viewportWidth, sidebarWidth] of [[1081, 248], [1200, 248], [1280, 248], [1440, 80], [1710, 80]] as const) {
    await page.setViewportSize({ width: viewportWidth, height: 900 })
    await page.locator('.layout').evaluate((element, width) => {
      (element as HTMLElement).style.gridTemplateColumns = `${width}px minmax(0, 1fr)`
    }, sidebarWidth)
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

    expect(metrics.header.display, `${viewportWidth}px header should stay visible in five-column layout`).not.toBe('none')
    expect(metrics.tracks, `${viewportWidth}px should preserve five aligned columns`).toHaveLength(5)
    expect(metrics.table.right).toBeLessThanOrEqual(viewportWidth)
    expect(metrics.header.left).toBeGreaterThanOrEqual(metrics.table.left)
    expect(metrics.header.right).toBeLessThanOrEqual(metrics.table.right + 1)
    expect(metrics.row.right).toBeLessThanOrEqual(metrics.table.right + 1)
    expect(metrics.amounts.every(amount => amount.text && amount.scrollWidth <= amount.clientWidth + 1)).toBe(true)
    expect(metrics.amounts.every(amount => amount.rectRight <= metrics.row.right + 1)).toBe(true)
    expect(metrics.actionRight).toBeLessThanOrEqual(metrics.row.right + 1)
    expect(metrics.actionButtons).toHaveLength(2)
    expect(metrics.actionButtons.every(button => button.width >= 32 && button.left >= metrics.row.left && button.right <= metrics.row.right + 1)).toBe(true)
    console.log(`Budget table ${viewportWidth}px with ${sidebarWidth === 248 ? 'expanded' : 'collapsed'} sidebar`, JSON.stringify(metrics))
  }
})

test('period table switches to a readable five-field card layout on tablet and mobile', async ({ page }) => {
  const css = readFileSync(join(process.cwd(), 'components/management/BudgetsManager.module.css'), 'utf8')
  await page.setContent(`<style>*{box-sizing:border-box}html,body{margin:0;width:100%}body{font:13px Manrope,Arial,sans-serif}.layout{display:grid;grid-template-columns:248px minmax(0,1fr);width:100vw}main{min-width:0;padding:0 16px}.periodRow>*{min-width:0}.periodRow p{margin:0}.periodActions{display:flex;gap:6px}.periodActions button{width:32px;height:32px}${css}@media(max-width:767px){.layout{grid-template-columns:0 minmax(0,1fr)}main{padding:0 16px}}</style>${TABLE_MARKUP}`)

  for (const viewportWidth of [834, 390]) {
    await page.setViewportSize({ width: viewportWidth, height: 844 })
    const metrics = await page.evaluate(() => {
      const table = document.querySelector<HTMLElement>('.periodTable')!
      const header = document.querySelector<HTMLElement>('.periodHeader')!
      const row = document.querySelector<HTMLElement>('.periodRow')!
      const children = Array.from(row.children) as HTMLElement[]
      const rowStyle = getComputedStyle(row)
      const amountElements = Array.from(row.querySelectorAll<HTMLElement>('[data-amount]'))
      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        headerDisplay: getComputedStyle(header).display,
        rowWidth: row.getBoundingClientRect().width,
        rowContentWidth: row.clientWidth - Number.parseFloat(rowStyle.paddingLeft) - Number.parseFloat(rowStyle.paddingRight),
        childRects: children.map(child => {
          const rect = child.getBoundingClientRect()
          return { left: rect.left, right: rect.right, width: rect.width }
        }),
        amountsComplete: amountElements.every(element => element.scrollWidth <= element.clientWidth + 1),
        tableRight: table.getBoundingClientRect().right,
      }
    })
    expect(metrics.documentWidth).toBeLessThanOrEqual(viewportWidth)
    expect(metrics.headerDisplay).toBe('none')
    expect(metrics.tableRight).toBeLessThanOrEqual(viewportWidth)
    expect(metrics.amountsComplete).toBe(true)
    expect(metrics.childRects).toHaveLength(5)
    expect(metrics.childRects.every(rect => rect.width > 0 && rect.left >= 0 && rect.right <= viewportWidth)).toBe(true)
    expect(metrics.childRects[0]?.width).toBeCloseTo(metrics.rowContentWidth, 0)
    expect(metrics.childRects[1]?.width).toBeCloseTo(metrics.rowContentWidth, 0)
    expect(metrics.childRects[4]?.width).toBeCloseTo(metrics.rowContentWidth, 0)
    console.log(`Budget table ${viewportWidth}px card layout`, JSON.stringify(metrics))
  }
})
