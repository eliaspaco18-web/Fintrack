import { expect, test } from '@playwright/test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const cssDirectory = join(process.cwd(), '.next', 'static', 'css')
const cssFiles = readdirSync(cssDirectory).filter(file => file.endsWith('.css'))
const compiledStyles = cssFiles.map(file => readFileSync(join(cssDirectory, file), 'utf8')).join('\n')

for (const variant of [
  { theme: 'light', width: 1440, height: 900, topbarHeight: 56, padding: '28px', dashboardBackground: 'rgb(255, 255, 255)' },
  { theme: 'dark', width: 1440, height: 900, topbarHeight: 56, padding: '28px', dashboardBackground: 'rgb(22, 22, 21)' },
  { theme: 'light', width: 390, height: 844, topbarHeight: 52, padding: '16px', dashboardBackground: 'rgb(255, 255, 255)' },
  { theme: 'dark', width: 390, height: 844, topbarHeight: 52, padding: '16px', dashboardBackground: 'rgb(22, 22, 21)' },
] as const) {
  test(`Movimientos topbar follows Astra canvas without changing Dashboard: ${variant.theme}-${variant.width}`, async ({ page }) => {
    await page.setViewportSize({ width: variant.width, height: variant.height })
    await page.setContent(`
      <html data-theme="${variant.theme}"><body>
        <div class="fin-shell" data-ft-v3-shell>
          <header id="transactions-topbar" class="fin-topbar" data-ft-transactions-topbar="true" style="height:var(--topbar-height)">
            <div class="ft-topbar-inner" style="height:100%"></div>
          </header>
          <header id="dashboard-topbar" class="fin-topbar" style="height:var(--topbar-height)"></header>
        </div>
      </body></html>`)
    await page.addStyleTag({ content: compiledStyles })

    const result = await page.evaluate(() => {
      const shell = document.querySelector('.fin-shell')!
      const transactions = document.querySelector('#transactions-topbar')!
      const dashboard = document.querySelector('#dashboard-topbar')!
      const canvas = document.createElement('div')
      canvas.style.backgroundColor = getComputedStyle(shell).getPropertyValue('--ft-canvas').trim()
      document.body.append(canvas)
      return {
        canvas: getComputedStyle(canvas).backgroundColor,
        transactionsBackground: getComputedStyle(transactions).backgroundColor,
        transactionsHeight: transactions.getBoundingClientRect().height,
        dashboardBackground: getComputedStyle(dashboard).backgroundColor,
        dashboardHeight: dashboard.getBoundingClientRect().height,
        transactionsPadding: getComputedStyle(transactions.querySelector('.ft-topbar-inner')!).paddingInlineStart,
      }
    })

    expect(result.transactionsBackground).toBe(result.canvas)
    expect(result.transactionsHeight).toBe(variant.topbarHeight)
    expect(result.transactionsPadding).toBe(variant.padding)
    expect(result.dashboardHeight).toBe(variant.topbarHeight)
    expect(result.dashboardBackground).toBe(variant.dashboardBackground)
  })
}
