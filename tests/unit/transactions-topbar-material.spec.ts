import { expect, test } from '@playwright/test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const cssDirectory = join(process.cwd(), '.next', 'static', 'css')
const cssFiles = readdirSync(cssDirectory).filter(file => file.endsWith('.css'))
const compiledStyles = cssFiles.map(file => readFileSync(join(cssDirectory, file), 'utf8')).join('\n')

for (const variant of [
  { theme: 'light', width: 1440, height: 900, topbarHeight: 56, padding: '28px', background: 'rgb(245, 246, 247)' },
  { theme: 'dark', width: 1440, height: 900, topbarHeight: 56, padding: '28px', background: 'rgb(22, 22, 21)' },
  { theme: 'light', width: 390, height: 844, topbarHeight: 52, padding: '16px', background: 'rgb(245, 246, 247)' },
  { theme: 'dark', width: 390, height: 844, topbarHeight: 52, padding: '16px', background: 'rgb(22, 22, 21)' },
] as const) {
  test(`V3 authenticated routes share the Astra topbar: ${variant.theme}-${variant.width}`, async ({ page }) => {
    await page.setViewportSize({ width: variant.width, height: variant.height })
    await page.setContent(`
      <html data-theme="${variant.theme}"><body>
        <div class="fin-shell" data-ft-v3-shell>
          ${['dashboard', 'transactions', 'accounts', 'budgets', 'credits'].map(route => `
            <header id="${route}-topbar" class="fin-topbar" style="height:var(--topbar-height)">
              <div class="ft-topbar-inner flex" style="height:100%">
                <div class="topbar-leading flex"><div class="topbar-crumb flex"><span aria-hidden="true">/</span><h1 class="text-[12px]">${route}</h1></div></div>
                <div class="topbar-actions flex"><button class="ft-topbar-utility"></button><button class="ft-topbar-profile"><span></span></button></div>
              </div>
            </header>`).join('')}
        </div>
      </body></html>`)
    await page.addStyleTag({ content: compiledStyles })

    const result = await page.evaluate(() => {
      const shell = document.querySelector('.fin-shell')!
      const canvas = document.createElement('div')
      canvas.style.backgroundColor = getComputedStyle(shell).getPropertyValue('--ft-canvas').trim()
      document.body.append(canvas)
      const topbars = Array.from(document.querySelectorAll('.fin-topbar'))
      return {
        canvas: getComputedStyle(canvas).backgroundColor,
        topbars: topbars.map(topbar => {
          const inner = topbar.querySelector('.ft-topbar-inner')!
          const leading = inner.querySelector('.topbar-leading')!
          const crumb = leading.querySelector('div')!
          const actions = inner.querySelector('.topbar-actions')!
          const profile = topbar.querySelector('.ft-topbar-profile')!
          return {
            background: getComputedStyle(topbar).backgroundColor,
            height: topbar.getBoundingClientRect().height,
            padding: getComputedStyle(inner).paddingInlineStart,
            leadingGap: getComputedStyle(leading).gap,
            crumbGap: getComputedStyle(crumb).gap,
            actionsGap: getComputedStyle(actions).gap,
            profileSize: getComputedStyle(profile).width,
            headingSize: getComputedStyle(topbar.querySelector('h1')!).fontSize,
          }
        }),
      }
    })

    expect(result.canvas).toBe(variant.background)
    expect(result.topbars).toHaveLength(5)
    for (const topbar of result.topbars) {
      expect(topbar.background).toBe(result.canvas)
      expect(topbar.height).toBe(variant.topbarHeight)
      expect(topbar.padding).toBe(variant.padding)
      expect(topbar.leadingGap).toBe(variant.width < 768 ? '9px' : '12px')
      expect(topbar.crumbGap).toBe(variant.width < 768 ? '9px' : '12px')
      expect(topbar.actionsGap).toBe(variant.width < 768 ? '2px' : '16px')
      expect(topbar.profileSize).toBe(variant.width < 768 ? '44px' : '36px')
      if (variant.width < 768) expect(topbar.headingSize).toBe('13px')
    }
  })
}
