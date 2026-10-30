import { expect, test } from '@playwright/test'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

test('the V3 AppShell uses one route-independent Sidebar and Topbar', () => {
  const source = readFileSync(join(process.cwd(), 'components', 'layout', 'AppShell.tsx'), 'utf8')
  expect(source).toContain('<StaticSidebar')
  expect(source).toContain('<Topbar')
  expect(source).not.toContain("pathname === '/transactions' ? transactionStyles.astraShell")
})

test('sidebar module labels match Astra Manrope 600 and the local semibold font is present', () => {
  const astraCss = readFileSync(join(process.cwd(), 'docs', 'redesign-v3', 'preview', 'design.css'), 'utf8')
  const globalCss = readFileSync(join(process.cwd(), 'app', 'globals.css'), 'utf8')
  expect(astraCss).toMatch(/\.nav-item\{[^}]*font-weight:600/)
  expect(globalCss).toMatch(/font-family:\s*Manrope,\s*system-ui,\s*sans-serif;\s*font-weight:\s*600;/)
  expect(existsSync(join(process.cwd(), 'public', 'fonts', 'v3', 'manrope-semibold.ttf'))).toBe(true)
})

const cssDirectory = join(process.cwd(), '.next', 'static', 'css')
const cssFiles = readdirSync(cssDirectory).filter(file => file.endsWith('.css'))
const compiledStyles = cssFiles.map(file => readFileSync(join(cssDirectory, file), 'utf8')).join('\n')

for (const variant of [
  { theme: 'light', width: 1440, height: 900, topbarHeight: 56, padding: '28px', background: 'rgb(245, 246, 247)', border: 'rgb(220, 225, 229)', sidebarBackground: 'rgb(255, 255, 255)', sidebarWidth: 208, rail: true },
  { theme: 'dark', width: 1440, height: 900, topbarHeight: 56, padding: '28px', background: 'rgb(23, 25, 28)', border: 'rgb(57, 63, 69)', sidebarBackground: 'rgb(32, 35, 39)', sidebarWidth: 208, rail: true },
  { theme: 'light', width: 1440, height: 900, topbarHeight: 56, padding: '28px', background: 'rgb(245, 246, 247)', border: 'rgb(220, 225, 229)', sidebarBackground: 'rgb(255, 255, 255)', sidebarWidth: 72, rail: true },
  { theme: 'dark', width: 1440, height: 900, topbarHeight: 56, padding: '28px', background: 'rgb(23, 25, 28)', border: 'rgb(57, 63, 69)', sidebarBackground: 'rgb(32, 35, 39)', sidebarWidth: 72, rail: true },
  { theme: 'light', width: 834, height: 900, topbarHeight: 56, padding: '22px', background: 'rgb(245, 246, 247)', border: 'rgb(220, 225, 229)', sidebarBackground: 'rgb(255, 255, 255)', sidebarWidth: 72, rail: true },
  { theme: 'dark', width: 834, height: 900, topbarHeight: 56, padding: '22px', background: 'rgb(23, 25, 28)', border: 'rgb(57, 63, 69)', sidebarBackground: 'rgb(32, 35, 39)', sidebarWidth: 72, rail: true },
  { theme: 'light', width: 390, height: 844, topbarHeight: 52, padding: '16px', background: 'rgb(245, 246, 247)', border: 'rgb(220, 225, 229)', sidebarBackground: 'rgb(255, 255, 255)', sidebarWidth: 0, rail: false },
  { theme: 'dark', width: 390, height: 844, topbarHeight: 52, padding: '16px', background: 'rgb(23, 25, 28)', border: 'rgb(57, 63, 69)', sidebarBackground: 'rgb(32, 35, 39)', sidebarWidth: 0, rail: false },
] as const) {
  test(`V3 authenticated routes share shell geometry: ${variant.theme}-${variant.width}-sidebar-${variant.sidebarWidth}`, async ({ page }) => {
    await page.setViewportSize({ width: variant.width, height: variant.height })
    await page.setContent(`
      <html data-theme="${variant.theme}"><body>
        <div id="shell-fixtures">
          ${['dashboard', 'transactions', 'accounts', 'budgets', 'credits'].map(route => `
            <div class="fin-shell" data-ft-v3-shell data-module="${route}" style="position:fixed;inset:0;display:flex;visibility:hidden">
              <aside class="fin-sidebar hidden h-dvh shrink-0 flex-col border-r border-[var(--sidebar-panel-border)] md:flex" style="width:var(--sidebar-width-${variant.sidebarWidth === 208 ? 'expanded' : 'collapsed'});height:100vh">
                <div class="relative z-[1] flex h-full flex-col overflow-visible bg-transparent">
                  <div class="fin-sidebar-header flex h-[var(--sidebar-header-height)] shrink-0 items-center pl-[18px]">
                    <a class="ft-sidebar-logo group flex min-w-0 items-center gap-3"><svg class="ft-mark ft-sidebar-mark shrink-0" viewBox="0 0 80 80"><path d="M1 1"/></svg><div class="ft-sidebar-wordmark"><span>FinTrack</span></div></a>
                  </div>
                  <nav class="ft-sidebar-navigation flex flex-1 flex-col overflow-y-auto overflow-x-visible px-3 pb-3 pt-9">
                    <div><p class="ft-sidebar-section-label px-2 pb-3 pt-2 text-[9px] font-bold uppercase leading-none tracking-[0.12em]">Tu día a día</p><ul class="space-y-1">${['Inicio', 'Movimientos', 'Cuentas'].map(label => `<li><a class="sidebar-nav-link" data-active="${label === route ? 'true' : 'false'}"><span class="sidebar-nav-icon">⌂</span><span class="sidebar-nav-label text-[13px] tracking-[-0.01em] flex-1 min-w-0 truncate">${label}</span></a></li>`).join('')}</ul></div>
                  </nav>
                  <div class="border-t border-[var(--sidebar-panel-border)] px-3 py-3"><div class="sidebar-account-card"><span>Usuario</span></div></div>
                </div>
              </aside>
              <div style="min-width:0;flex:1;display:flex;flex-direction:column">
                <header class="fin-topbar sticky top-0 z-sticky h-[var(--topbar-height)] shrink-0 border-b border-[var(--ft-border)] bg-[var(--ft-topbar-bg)]">
                  <div class="ft-topbar-inner flex h-full min-w-0 items-center justify-between gap-3">
                    <div class="flex min-w-0 items-center gap-2"><span>Espacio personal</span><span aria-hidden="true">/</span><div class="flex min-w-0 items-center gap-2"><h1 class="truncate text-[12px] font-semibold leading-none tracking-[-0.01em]">${route}</h1></div></div>
                    <div class="flex shrink-0 items-center gap-1.5"><button class="ft-topbar-utility"></button><button class="ft-topbar-profile"><span></span></button></div>
                  </div>
                </header>
              </div>
            </div>`).join('')}
        </div>
      </body></html>`)
    await page.addStyleTag({ content: compiledStyles })

    const result = await page.evaluate(() => {
      const shells = Array.from(document.querySelectorAll<HTMLElement>('.fin-shell'))
      const topbars = Array.from(document.querySelectorAll<HTMLElement>('.fin-topbar'))
      const sidebars = Array.from(document.querySelectorAll<HTMLElement>('.fin-sidebar'))
      return {
        canvas: getComputedStyle(topbars[0]!).backgroundColor,
        shells: shells.map((shell, index) => {
          const sidebar = sidebars[index]!
          const sidebarHeader = sidebar.querySelector<HTMLElement>('.fin-sidebar-header')!
          const mark = sidebar.querySelector<HTMLElement>('.ft-sidebar-mark')!
          const navigation = sidebar.querySelector<HTMLElement>('.ft-sidebar-navigation')!
          const navLink = sidebar.querySelector<HTMLElement>('.sidebar-nav-link')!
          const navLabels = Array.from(sidebar.querySelectorAll<HTMLElement>('.sidebar-nav-label'))
          const wordmark = sidebar.querySelector<HTMLElement>('.ft-sidebar-wordmark span')!
          const profile = sidebar.querySelector<HTMLElement>('.sidebar-account-card')!
          const topbar = topbars[index]!
          const inner = topbar.querySelector('.ft-topbar-inner')!
          const leading = inner.children[0] as HTMLElement
          const routeHeading = leading.querySelector('div') as HTMLElement
          const actions = inner.children[1] as HTMLElement
          return {
            route: shell.dataset.module,
            sidebarWidth: sidebar.getBoundingClientRect().width,
            sidebarDisplay: getComputedStyle(sidebar).display,
            sidebarBackground: getComputedStyle(sidebar).backgroundColor,
            sidebarHeaderHeight: sidebarHeader.getBoundingClientRect().height,
            sidebarHeaderAlign: getComputedStyle(sidebarHeader).alignItems,
            sidebarHeaderBorder: getComputedStyle(sidebarHeader).borderBottomWidth,
            sidebarHeaderPaddingTop: getComputedStyle(sidebarHeader).paddingTop,
            logoX: mark.getBoundingClientRect().x,
            logoY: mark.getBoundingClientRect().y,
            logoSize: mark.getBoundingClientRect().width,
            wordmarkFont: getComputedStyle(wordmark).fontFamily,
            wordmarkSize: getComputedStyle(wordmark).fontSize,
            wordmarkWeight: getComputedStyle(wordmark).fontWeight,
            navPaddingTop: getComputedStyle(navigation).paddingTop,
            navItemHeight: navLink.getBoundingClientRect().height,
            navFont: getComputedStyle(navLink).fontFamily,
            navFontSize: getComputedStyle(navLink).fontSize,
            navLabelTypography: navLabels.map(label => ({
              family: getComputedStyle(label).fontFamily,
              weight: getComputedStyle(label).fontWeight,
              size: getComputedStyle(label).fontSize,
            })),
            profileBottom: profile.getBoundingClientRect().bottom,
            topbarBackground: getComputedStyle(topbar).backgroundColor,
            topbarBorderColor: getComputedStyle(topbar).borderBottomColor,
            topbarBorderWidth: getComputedStyle(topbar).borderBottomWidth,
            height: topbar.getBoundingClientRect().height,
            padding: getComputedStyle(inner).paddingInlineStart,
            font: getComputedStyle(topbar).fontFamily,
            leadingGap: getComputedStyle(leading).gap,
            breadcrumbGap: getComputedStyle(routeHeading).gap,
            actionsGap: getComputedStyle(actions).gap,
            profileSize: topbar.querySelector('.ft-topbar-profile')!.getBoundingClientRect().width,
            headingSize: getComputedStyle(topbar.querySelector('h1')!).fontSize,
          }
        }),
      }
    })

    expect(result.canvas).toBe(variant.background)
    expect(result.shells).toHaveLength(5)
    const reference = result.shells[0]!
    const shellGeometry = (shell: (typeof result.shells)[number]) => {
      const { route: _route, ...geometry } = shell
      return geometry
    }
    for (let index = 0; index < result.shells.length; index += 1) {
      const shell = result.shells[index]!
      expect(shellGeometry(shell)).toEqual(shellGeometry(reference))
      expect(shell.sidebarDisplay).toBe(variant.rail ? 'flex' : 'none')
      expect(Math.round(shell.sidebarWidth)).toBe(variant.sidebarWidth)
      expect(shell.sidebarBackground).toBe(variant.sidebarBackground)
      if (variant.rail) {
        expect(shell.sidebarHeaderHeight).toBe(84)
        expect(shell.sidebarHeaderAlign).toBe('flex-start')
        expect(shell.sidebarHeaderBorder).toBe('0px')
        expect(shell.sidebarHeaderPaddingTop).toBe('28px')
        expect(shell.logoX).toBe(18)
        expect(shell.logoY).toBe(28)
        expect(shell.logoSize).toBe(32)
        expect(shell.navPaddingTop).toBe('0px')
        expect(shell.navItemHeight).toBe(40)
        expect(shell.profileBottom).toBe(888)
      }
      expect(shell.wordmarkFont).toContain('Manrope')
      expect(shell.wordmarkSize).toBe('21px')
      expect(shell.wordmarkWeight).toBe('800')
      expect(shell.navFont).toContain('Manrope')
      expect(shell.navFontSize).toBe('13px')
      expect(shell.navLabelTypography).toEqual([
        { family: 'Manrope, system-ui, sans-serif', weight: '600', size: '13px' },
        { family: 'Manrope, system-ui, sans-serif', weight: '600', size: '13px' },
        { family: 'Manrope, system-ui, sans-serif', weight: '600', size: '13px' },
      ])
      expect(shell.topbarBackground).toBe(variant.background)
      expect(shell.topbarBorderColor).toBe(variant.border)
      expect(shell.height).toBe(variant.topbarHeight)
      expect(shell.padding).toBe(variant.padding)
      expect(shell.topbarBorderWidth).toBe('1px')
      expect(shell.font).toContain('Manrope')
      expect(shell.leadingGap).toBe(variant.width < 768 ? '9px' : '12px')
      expect(shell.breadcrumbGap).toBe(variant.width < 768 ? '9px' : '12px')
      expect(shell.actionsGap).toBe(variant.width < 768 ? '2px' : '16px')
      expect(shell.profileSize).toBe(variant.width < 768 ? 44 : 36)
      if (variant.width < 768) expect(shell.headingSize).toBe('13px')
    }
  })
}
