import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

const reactPath = join(process.cwd(), 'node_modules/react/umd/react.development.js')
const reactDomPath = join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js')

function presenceSource(): string {
  const source = readFileSync(join(process.cwd(), 'lib/ui/use-v3-workbench-presence.ts'), 'utf8')
    .replace(/^'use client'\s*/, '')
    .replace(/import \{[^}]+\} from 'react'/, 'const { useEffect, useRef, useState } = window.React')
    .replace(/export type /g, 'type ')
    .replace(/export function /g, 'function ')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
  }).outputText
  return `${compiled}\nwindow.useV3WorkbenchPresence = useV3WorkbenchPresence;`
}

async function mount(page: import('@playwright/test').Page, source: 'pointer' | 'keyboard' = 'pointer') {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setContent('<div id="root"></div>')
  await page.addScriptTag({ path: reactPath })
  await page.addScriptTag({ path: reactDomPath })
  await page.addScriptTag({ content: presenceSource() })
  await page.addScriptTag({ content: `
    function Harness() {
      const [open, setOpen] = React.useState(false);
      const presence = window.useV3WorkbenchPresence(open, true, '${source}');
      return React.createElement(React.Fragment, null,
        React.createElement('button', { id: 'open', onClick: () => setOpen(true) }, 'Open'),
        React.createElement('button', { id: 'close', onClick: () => setOpen(false) }, 'Close'),
        React.createElement('span', { id: 'phase' }, presence.phase),
        presence.mounted ? React.createElement('div', { id: 'surface' },
          React.createElement('div', { id: 'veil', ref: presence.veilRef }),
          React.createElement('div', { id: 'frame', ref: presence.frameRef },
            React.createElement('div', { id: 'body', ref: presence.bodyRef }, 'Record'))
        ) : null);
    }
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
  ` })
  try {
    await page.locator('#phase').waitFor({ timeout: 1500 })
  } catch {
    throw new Error(`Presence harness did not mount: ${errors.join(' | ') || 'no browser exception'}`)
  }
}

test('pointer workbench keeps the current pose through close/reopen and ignores obsolete exits', async ({ page }) => {
  await mount(page)
  await page.locator('#open').click()
  await expect(page.locator('#phase')).toHaveText('opening')
  await page.waitForTimeout(75)
  const enteringPose = await page.locator('#frame').evaluate(element => getComputedStyle(element).transform)
  expect(enteringPose).not.toBe('none')
  await page.locator('#close').click()
  await expect(page.locator('#phase')).toHaveText('closing')
  await page.waitForTimeout(40)
  await page.locator('#open').click()
  await expect(page.locator('#surface')).toBeVisible()
  await expect(page.locator('#phase')).toHaveText('open', { timeout: 600 })
  await page.waitForTimeout(200)
  await expect(page.locator('#surface')).toBeVisible()
  await page.locator('#close').click()
  await expect(page.locator('#surface')).toHaveCount(0, { timeout: 600 })
  await expect(page.locator('#phase')).toHaveText('closed')
})

test('keyboard and reduced-motion paths settle without animation or exit wait', async ({ page }) => {
  await mount(page, 'keyboard')
  await page.locator('#open').click()
  await expect(page.locator('#phase')).toHaveText('open')
  expect(await page.locator('#frame').evaluate(element => element.getAnimations().length)).toBe(0)
  await page.locator('#close').click()
  await expect(page.locator('#surface')).toHaveCount(0)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await mount(page, 'pointer')
  await page.locator('#open').click()
  await expect(page.locator('#phase')).toHaveText('open')
  expect(await page.locator('#frame').evaluate(element => element.getAnimations().length)).toBe(0)
  await page.locator('#close').click()
  await expect(page.locator('#surface')).toHaveCount(0)
})

test('switching to reduced motion mid-dock finishes the current logical open state', async ({ page }) => {
  await mount(page, 'pointer')
  await page.locator('#open').click()
  await expect(page.locator('#phase')).toHaveText('opening')
  await page.waitForTimeout(55)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('#phase')).toHaveText('open')
  expect(await page.locator('#frame').evaluate(element => element.getAnimations().length)).toBe(0)
  await page.locator('#close').click()
  await expect(page.locator('#surface')).toHaveCount(0)
})
