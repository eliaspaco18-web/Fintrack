import { expect, test } from '@playwright/test'
import { join } from 'node:path'

test('legacy shell keeps its previous geometry when V3 is not selected', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/login')
  await page.evaluate(() => {
    const fixture = document.createElement('div')
    fixture.className = 'fin-shell'
    fixture.setAttribute('data-ft-legacy-shell', '')
    fixture.style.cssText = 'position:fixed;inset:0;z-index:1000;display:flex'
    fixture.innerHTML = '<aside class="fin-sidebar" style="width:var(--sidebar-width-expanded)"></aside><header class="fin-topbar" style="height:var(--topbar-height)"></header>'
    document.body.append(fixture)
  })
  expect(await page.locator('[data-ft-legacy-shell] .fin-sidebar').evaluate(element => element.getBoundingClientRect().width)).toBe(248)
  expect(await page.locator('[data-ft-legacy-shell] .fin-topbar').evaluate(element => element.getBoundingClientRect().height)).toBe(60)
  expect(await page.locator('[data-ft-legacy-shell] .fin-sidebar').evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)')
})

for (const variant of [
  { name: 'desktop-expanded-light', width: 1440, height: 900, theme: 'light', rail: 208, expanded: true },
  { name: 'desktop-compact-dark', width: 1440, height: 900, theme: 'dark', rail: 68, expanded: false },
  { name: 'tablet-rail-light', width: 834, height: 900, theme: 'light', rail: 68, expanded: false },
  { name: 'tablet-overlay-dark', width: 834, height: 900, theme: 'dark', rail: 68, expanded: false, overlay: true },
] as const) {
  test(`V3 shell material and identity geometry: ${variant.name}`, async ({ page }) => {
    await page.setViewportSize({ width: variant.width, height: variant.height })
    await page.addInitScript(theme => localStorage.setItem('fintrack.theme.v1', theme), variant.theme)
    await page.goto('/login')
    await page.evaluate(config => {
      const fixture = document.createElement('div')
      fixture.id = 'ft-shell-fixture'
      fixture.className = 'fin-shell'
      fixture.setAttribute('data-ft-v3-shell', '')
      fixture.style.cssText = 'position:fixed;inset:0;z-index:1000;display:flex;background:var(--ft-canvas);color:var(--ft-text-strong)'
      fixture.innerHTML = `
        <aside class="fin-sidebar" style="width:var(--sidebar-width-${config.expanded ? 'expanded' : 'collapsed'});height:100%;border-right:1px solid var(--sidebar-panel-border)">
          <div style="height:var(--sidebar-header-height);display:flex;align-items:center;padding-left:18px;border-bottom:1px solid var(--sidebar-panel-border)">
            <svg class="ft-mark ft-sidebar-mark" viewBox="0 0 80 80" fill="none" aria-label="Marca FT12"><path class="ft-mark-structure" d="M15 66V25c0-7 5-12 12-12h38" stroke-width="11" stroke-linecap="round"/><path class="ft-mark-flow" d="M16 42h32" stroke-width="11" stroke-linecap="round"/><path class="ft-mark-structure" d="M50 28v38M37 28h28" stroke-width="11" stroke-linecap="round"/><circle cx="50" cy="42" r="6" fill="#D7B66F"/></svg>
            ${config.expanded ? '<span style="margin-left:12px;font-size:21px;font-weight:700">FinTrack</span>' : ''}
          </div>
          <div style="padding:16px 12px">${config.expanded ? '<p>Tu día a día</p>' : ''}<p>Inicio</p><p>Movimientos</p><p>Cuentas</p></div>
        </aside>
        <div style="flex:1;min-width:0">
          <header class="fin-topbar" style="height:var(--topbar-height);border-bottom:1px solid var(--ft-border)">
            <div class="ft-topbar-inner" style="height:100%;display:flex;align-items:center">Inicio</div>
          </header>
          <main class="ft-shell-content" style="height:calc(100% - var(--topbar-height))">
            <h1 style="font-size:26px;font-weight:700">Tu panorama financiero</h1>
            <p>Vista de material y geometría; no contiene datos ni acciones de producción.</p>
          </main>
        </div>`
      document.body.append(fixture)
      if ('overlay' in config && config.overlay) {
        const layer = document.createElement('div')
        layer.className = 'ft-tablet-navigation-layer'
        layer.style.zIndex = '1001'
        layer.innerHTML = `<aside class="ft-tablet-navigation-panel">
          <div style="height:var(--sidebar-header-height);display:flex;align-items:center;padding-left:18px">
            <svg class="ft-mark ft-sidebar-mark" viewBox="0 0 80 80" fill="none" aria-label="Marca FT12 superpuesta"><path class="ft-mark-structure" d="M15 66V25c0-7 5-12 12-12h38" stroke-width="11" stroke-linecap="round"/><path class="ft-mark-flow" d="M16 42h32" stroke-width="11" stroke-linecap="round"/><path class="ft-mark-structure" d="M50 28v38M37 28h28" stroke-width="11" stroke-linecap="round"/><circle cx="50" cy="42" r="6" fill="#D7B66F"/></svg>
            <span style="margin-left:12px;font-size:21px;font-weight:700">FinTrack</span>
          </div><nav style="padding:16px 12px">Inicio<br>Movimientos<br>Cuentas<br>Presupuestos<br>Créditos</nav></aside>`
        document.body.append(layer)
      }
    }, variant)

    const rail = page.locator('#ft-shell-fixture .fin-sidebar')
    expect(Math.round(await rail.evaluate(element => element.getBoundingClientRect().width))).toBe(variant.rail)
    expect(await rail.evaluate(element => getComputedStyle(element, '::before').zIndex)).toBe('-1')
    const mark = page.locator('#ft-shell-fixture .ft-sidebar-mark')
    expect(Math.round(await mark.evaluate(element => element.getBoundingClientRect().x))).toBe(18)
    expect(Math.round(await mark.evaluate(element => element.getBoundingClientRect().width))).toBe(32)
    expect(await mark.locator('path').count()).toBe(3)
    const topbar = page.locator('#ft-shell-fixture .fin-topbar')
    expect(Math.round(await topbar.evaluate(element => element.getBoundingClientRect().height))).toBe(56)
    if ('overlay' in variant && variant.overlay) {
      expect(Math.round(await page.locator('.ft-tablet-navigation-panel').evaluate(element => element.getBoundingClientRect().width))).toBe(208)
      expect(Math.round(await rail.evaluate(element => element.getBoundingClientRect().width))).toBe(68)
    }
    if (process.env.V3_CAPTURE_SHELL === '1') {
      await page.screenshot({ path: join(process.cwd(), `docs/redesign-v3/implementation/stage6-${variant.name}.png`) })
    }
  })
}

for (const variant of [
  { name: 'mobile-dock-light-320', width: 320, height: 740, theme: 'light' },
  { name: 'mobile-dock-dark-390', width: 390, height: 844, theme: 'dark' },
] as const) {
  test(`V3 mobile dock reserves its own Registrar slot: ${variant.name}`, async ({ page }) => {
    await page.setViewportSize({ width: variant.width, height: variant.height })
    await page.addInitScript(theme => localStorage.setItem('fintrack.theme.v1', theme), variant.theme)
    await page.goto('/login')
    await page.evaluate(() => {
      const fixture = document.createElement('div')
      fixture.id = 'ft-mobile-shell-fixture'
      fixture.className = 'fin-shell'
      fixture.setAttribute('data-ft-v3-shell', '')
      fixture.style.cssText = 'position:fixed;inset:0;z-index:1000;background:var(--ft-canvas);color:var(--ft-text-strong)'
      fixture.innerHTML = `
        <header class="fin-topbar" style="height:var(--topbar-height);border-bottom:1px solid var(--ft-border)">
          <div class="ft-topbar-inner" style="height:100%;display:flex;align-items:center;gap:10px">
            <svg class="ft-mark" style="width:27px;height:27px" viewBox="0 0 80 80" fill="none"><path class="ft-mark-structure" d="M15 66V25c0-7 5-12 12-12h38" stroke-width="11" stroke-linecap="round"/><path class="ft-mark-flow" d="M16 42h32" stroke-width="11" stroke-linecap="round"/><path class="ft-mark-structure" d="M50 28v38M37 28h28" stroke-width="11" stroke-linecap="round"/><circle cx="50" cy="42" r="6" fill="#D7B66F"/></svg>
            <strong>Inicio</strong>
          </div>
        </header>
        <main class="ft-shell-content"><h1 style="font-size:22px;font-weight:700">Tu panorama financiero</h1>
          <p>La navegación y Registrar conservan espacios independientes.</p></main>
        <nav class="ft-mobile-dock" aria-label="Destinos principales"><div class="ft-mobile-dock-destinations">
          <a class="ft-mobile-dock-item" data-active="true"><span>⌂</span><span>Inicio</span></a>
          <a class="ft-mobile-dock-item"><span>↔</span><span>Movimientos</span></a>
          <a class="ft-mobile-dock-item"><span>□</span><span>Cuentas</span></a>
          <button class="ft-mobile-dock-item"><span>☰</span><span>Más</span></button>
        </div></nav>
        <div class="ft-quick-register-shell"><button class="ft-v3-action-menu-trigger ft-quick-register" aria-label="Registrar">+</button></div>`
      document.body.append(fixture)
    })
    const dock = page.locator('#ft-mobile-shell-fixture .ft-mobile-dock')
    const registrar = page.getByRole('button', { name: 'Registrar' })
    await page.waitForTimeout(280)
    const buttons = page.locator('#ft-mobile-shell-fixture .ft-mobile-dock-item')
    expect(await buttons.count()).toBe(4)
    for (const item of await buttons.all()) {
      expect(Math.round(await item.evaluate(element => element.getBoundingClientRect().height))).toBeGreaterThanOrEqual(44)
    }
    const dockBox = await dock.boundingBox()
    const registrarBox = await registrar.boundingBox()
    expect(dockBox).not.toBeNull()
    expect(registrarBox).not.toBeNull()
    expect(Math.round(registrarBox!.width)).toBe(56)
    expect(Math.round(variant.width - registrarBox!.x - registrarBox!.width)).toBe(12)
    expect(registrarBox!.x).toBeGreaterThan((await buttons.last().boundingBox())!.x + (await buttons.last().boundingBox())!.width)
    if (process.env.V3_CAPTURE_SHELL === '1') {
      await page.screenshot({ path: join(process.cwd(), `docs/redesign-v3/implementation/stage6-${variant.name}.png`) })
    }
  })
}
