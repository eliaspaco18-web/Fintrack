import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

function hookSource(): string {
  const source = readFileSync(join(process.cwd(), 'lib/ui/use-v3-route-reveal.ts'), 'utf8')
    .replace(/^'use client'\s*/, '')
    .replace(/import[\s\S]*?from 'react'/, '')
    .replace(/export function /, 'function ')
  return ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
  }).outputText + '\nwindow.useV3RouteReveal = useV3RouteReveal;'
}

test('pointer module commits use only the 0/24/48ms three-group reveal; keyboard and history do not', async ({ page }) => {
  await page.setContent('<div id="root"></div>')
  await page.addScriptTag({ path: join(process.cwd(), 'node_modules/react/umd/react.development.js') })
  await page.addScriptTag({ path: join(process.cwd(), 'node_modules/react-dom/umd/react-dom.development.js') })
  await page.addScriptTag({ content: `
    const { useEffect, useLayoutEffect, useRef, useState } = React;
    window.routeAnimations = [];
    Element.prototype.animate = function(frames, options) {
      const item = { tag: this.getAttribute('data-ft-route-group') || this.tagName.toLowerCase(),
        duration: options.duration, delay: options.delay, frames };
      window.routeAnimations.push(item);
      return { cancel() {}, onfinish: null };
    };
  ` })
  await page.addScriptTag({ content: hookSource() })
  await page.addScriptTag({ content: `
    function Harness() {
      const [path, setPath] = React.useState('/dashboard');
      const content = React.useRef(null);
      const main = React.useRef(null);
      const announcement = window.useV3RouteReveal(path, content, main);
      const go = (next, source) => {
        if (source === 'history') window.dispatchEvent(new PopStateEvent('popstate'));
        else if (source) window.dispatchEvent(new CustomEvent('ft-v3-route-intent',
          { detail: { pathname: next, source } }));
        setPath(next);
      };
      return React.createElement(React.Fragment, null,
        React.createElement('button', { id: 'pointer', onClick: () => go('/portfolio', 'pointer') }, 'Pointer'),
        React.createElement('button', { id: 'keyboard', onClick: () => go('/credits', 'keyboard') }, 'Keyboard'),
        React.createElement('button', { id: 'history', onClick: () => go('/dashboard', 'history') }, 'History'),
        React.createElement('header', { className: 'fin-topbar' }, React.createElement('h1', { tabIndex: -1 }, path)),
        React.createElement('main', { ref: main }, React.createElement('div', { ref: content },
          React.createElement('section', { 'data-ft-route-group': 'summary' }, 'Summary'),
          React.createElement('section', { 'data-ft-route-group': 'work' }, 'Work'))),
        React.createElement('output', { id: 'announcement' }, announcement));
    }
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Harness));
  ` })
  await page.locator('#pointer').click()
  await expect(page.locator('#announcement')).toHaveText('/portfolio')
  const plan = await page.evaluate(() => (window as unknown as { routeAnimations: Array<{ tag: string; duration: number; delay: number }> }).routeAnimations)
  expect(plan.map(item => [item.tag, item.duration, item.delay])).toEqual([
    ['h1', 160, 0], ['summary', 180, 24], ['work', 180, 48],
  ])
  await page.locator('#keyboard').click()
  await expect(page.locator('#announcement')).toHaveText('/credits')
  expect(await page.evaluate(() => (window as unknown as { routeAnimations: unknown[] }).routeAnimations.length)).toBe(3)
  await page.locator('#history').click()
  await expect(page.locator('#announcement')).toHaveText('/dashboard')
  expect(await page.evaluate(() => (window as unknown as { routeAnimations: unknown[] }).routeAnimations.length)).toBe(3)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.locator('#pointer').click()
  await expect(page.locator('#announcement')).toHaveText('/portfolio')
  expect(await page.evaluate(() => (window as unknown as { routeAnimations: unknown[] }).routeAnimations.length)).toBe(3)
})
