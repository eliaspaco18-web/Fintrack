import { expect, test } from '@playwright/test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

function compileSettingsPrimitives(path: string) {
  const sourceFile = ts.createSourceFile(path, readFileSync(join(process.cwd(), path), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let source = sourceFile.text
    .replace(/^import type .*\n/gm, '')
    .replace(/^export\s+(?=(?:async\s+)?(?:function|const|class|interface|type)\b)/gm, '')
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React } }).outputText.replace(/^export\s*\{\s*\};?\s*$/gm, '')
  return `(()=>{const React=window.React;${compiled}\nwindow.__settingsPrimitives={SettingsPanel,SettingsSubsection,SettingsRow};})();`
}

test('settings workspace renders compact real settings primitives without nested cards or responsive overflow', async ({ page }) => {
  page.on('pageerror', error => console.info('Settings workspace browser error:', error.stack ?? error.message))
  const cssRoot = join(process.cwd(), '.next/static/css')
  const css = readdirSync(cssRoot).filter(file => file.endsWith('.css')).map(file => readFileSync(join(cssRoot, file), 'utf8')).join('\n')
  const moduleSource = readFileSync(join(process.cwd(), 'components/settings/SettingsWorkspace.module.css'), 'utf8')
  const moduleCss = moduleSource
    .replace(/:global\(([^)]+)\)/g, '$1')
    .replace(/\.workspace/g, '.settings-root')
  await page.setContent('<main><div id="root"></div></main>')
  await page.addStyleTag({ content: `${css}\n${moduleCss}\n[data-settings-grid]{display:grid;grid-template-columns:190px minmax(0,900px);gap:24px}@media(max-width:1023px){[data-settings-grid]{grid-template-columns:minmax(0,1fr)}}` })
  await page.addScriptTag({ path: join(process.cwd(), 'node_modules/react/umd/react.development.js') })
  await page.addScriptTag({ path: join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js') })
  await page.addScriptTag({ content: 'window.React=React;' })
  await page.addScriptTag({ content: compileSettingsPrimitives('components/settings/primitives.tsx') })
  await page.addScriptTag({ content: `const React=window.React;const {SettingsPanel,SettingsSubsection,SettingsRow}=window.__settingsPrimitives;function Harness(){return React.createElement('div',{className:'settings-root','data-settings-root':true,style:{width:'100%',maxWidth:'1116px',margin:'0 auto',fontFamily:'Manrope, system-ui, sans-serif'}},React.createElement('div',{'data-settings-grid':true},React.createElement('aside',null,'Perfil · Seguridad · Preferencias · Notificaciones · Cuentas · Datos · Soporte'),React.createElement('main',null,React.createElement(SettingsPanel,{title:'Preferencias',description:'Apariencia, moneda y privacidad.',density:'compact'},React.createElement(SettingsSubsection,{title:'Apariencia',description:'Elige cómo se muestra FinTrack.'},React.createElement(SettingsRow,{title:'Tema',description:'Claro u oscuro'},React.createElement('button',null,'Oscuro'))),React.createElement(SettingsSubsection,{title:'Privacidad',description:'Controla la visibilidad de tus importes.'},React.createElement(SettingsRow,{title:'Importes privados',description:'Oculta los importes en pantalla'},React.createElement('button',null,'Activado')))))));}ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));` })
  for (const width of [390, 834, 1440, 1710]) {
    await page.setViewportSize({ width, height: 900 })
    const metrics = await page.locator('.ft-settings-panel').evaluate(element => {
      const panel = getComputedStyle(element)
      const sub = getComputedStyle(element.querySelector('.ft-settings-subsection')!)
      const row = getComputedStyle(element.querySelector('.ft-settings-row')!)
      const root = element.closest('[data-settings-root]')!
      return {
        pageWidth: root.clientWidth,
        pageScrollWidth: root.scrollWidth,
        panelWidth: Math.round(element.getBoundingClientRect().width),
        panelRadius: panel.borderRadius,
        sectionBorder: sub.borderWidth,
        sectionBackground: sub.backgroundColor,
        rowDirection: row.flexDirection,
        fontFamily: getComputedStyle(root).fontFamily,
      }
    })
    console.info(`Settings workspace geometry ${width}px:`, JSON.stringify(metrics))
    expect(metrics.pageScrollWidth).toBeLessThanOrEqual(metrics.pageWidth)
    expect(metrics.panelWidth).toBeGreaterThan(0)
    expect(metrics.panelRadius).toBe('12px')
    expect(metrics.sectionBorder).toBe('0px')
    expect(metrics.sectionBackground).toBe('rgba(0, 0, 0, 0)')
    expect(metrics.fontFamily.toLowerCase()).toContain('manrope')
    expect(metrics.rowDirection).toBe(width <= 767 ? 'column' : 'row')
  }
})
