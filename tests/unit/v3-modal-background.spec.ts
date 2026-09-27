import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

function backgroundSource(): string {
  const source = readFileSync(join(process.cwd(), 'lib/ui/v3-modal-background.ts'), 'utf8')
    .replace('export function acquireV3ModalBackground', 'function acquireV3ModalBackground')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText
  return `${compiled}\nwindow.acquireV3ModalBackground = acquireV3ModalBackground;`
}

test('V3 modal ownership inerts siblings through nested exits and restores prior state', async ({ page }) => {
  await page.setContent('<main id="app"><button id="trigger">Open</button></main><aside id="previous" inert></aside>')
  await page.addScriptTag({ content: backgroundSource() })
  await page.evaluate(() => {
    document.body.style.overflow = 'auto'
    const first = document.createElement('div')
    first.id = 'first-modal'
    document.body.append(first)
    Reflect.set(window, 'releaseFirst', Reflect.get(window, 'acquireV3ModalBackground')(first))
  })
  await expect(page.locator('#app')).toHaveJSProperty('inert', true)
  await expect(page.locator('#first-modal')).toHaveJSProperty('inert', false)
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden')

  await page.evaluate(() => {
    const dynamic = document.createElement('div')
    dynamic.id = 'dynamic'
    document.body.append(dynamic)
    const second = document.createElement('div')
    second.id = 'second-modal'
    document.body.append(second)
    Reflect.set(window, 'releaseSecond', Reflect.get(window, 'acquireV3ModalBackground')(second))
  })
  await expect(page.locator('#dynamic')).toHaveJSProperty('inert', true)
  await expect(page.locator('#first-modal')).toHaveJSProperty('inert', true)
  await expect(page.locator('#second-modal')).toHaveJSProperty('inert', false)
  await page.evaluate(() => Reflect.get(window, 'releaseFirst')())
  await expect(page.locator('#app')).toHaveJSProperty('inert', true)
  await expect(page.locator('#second-modal')).toHaveJSProperty('inert', false)
  await page.evaluate(() => Reflect.get(window, 'releaseSecond')())
  await expect(page.locator('#app')).toHaveJSProperty('inert', false)
  await expect(page.locator('#previous')).toHaveJSProperty('inert', true)
  await expect(page.locator('#dynamic')).toHaveJSProperty('inert', false)
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('auto')
})
