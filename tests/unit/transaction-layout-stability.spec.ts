import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import postcss, { type AtRule, type Container, type Rule } from 'postcss'

const equivalenceClasses = new Set([
  'incomeSection',
  'incomeEquivalence',
  'incomeEquivalenceHeading',
  'incomeAppliedRate',
  'incomeAppliedRateUsd',
  'incomeReferenceRate',
  'incomeReferenceRateReserved',
  'incomeRateRefreshingReserved',
  'incomeEquivalenceValues',
  'incomeEquivalenceEmpty',
])

function equivalenceCss(): string {
  const css = readFileSync(join(process.cwd(), 'components/forms/TransactionForm/IncomeTransactionForm.module.css'), 'utf8')
  const source = postcss.parse(css)
  const output = postcss.root()

  const copyRelevantNodes = (sourceNodes: Container['nodes'], target: Container) => {
    for (const node of sourceNodes ?? []) {
      if (node.type === 'rule') {
        const rule = node as Rule
        if ([...equivalenceClasses].some(name => new RegExp(`\\.${name}(?:[^\\w-]|$)`).test(rule.selector))) {
          target.append(rule.clone())
        }
        continue
      }
      if (node.type === 'atrule' && (node.name === 'container' || node.name === 'media')) {
        const nested = postcss.root()
        copyRelevantNodes((node as AtRule).nodes, nested)
        if (nested.nodes.length) {
          target.append((node as AtRule).clone({ nodes: nested.nodes }))
        }
      }
    }
  }

  copyRelevantNodes(source.nodes, output)
  return output.toString()
}

function manropeCss(): string {
  const fontFaces = [
    ['manrope-regular.ttf', 400],
    ['manrope-semibold.ttf', 600],
    ['manrope-bold.ttf', 700],
  ].map(([file, weight]) => {
    const bytes = readFileSync(join(process.cwd(), 'public/fonts/v3', String(file)))
    return `@font-face{font-family:Manrope;src:url(data:font/ttf;base64,${bytes.toString('base64')}) format('truetype');font-style:normal;font-weight:${weight};font-display:block}`
  })
  return `${fontFaces.join('\n')} html,body{margin:0;font-family:Manrope,system-ui,sans-serif} .fixture{box-sizing:border-box;width:calc(100vw - 32px);max-width:720px;margin:24px auto;--ft-form-border:#dce1e5;--ft-form-radius:10px;--ft-surface-muted:#f0f2f4;--ft-text-strong:#242a30;--ft-form-muted:#59636d} .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}`
}

function markup(hasAmount: boolean, currency: 'PEN' | 'USD', referenceRate: boolean): string {
  const rates = `<span>${currency === 'USD' ? 'TC aplicado' : 'TC referencia'} 3.700 PEN<span class="${referenceRate ? '' : 'incomeRateRefreshingReserved'}" ${referenceRate ? '' : 'aria-hidden="true"'}> · actualizando…</span></span>${currency === 'USD' ? `<span class="incomeReferenceRate ${referenceRate ? '' : 'incomeReferenceRateReserved'}" ${referenceRate ? '' : 'aria-hidden="true"'}>Referencia diaria 3.690 PEN</span>` : ''}`
  const values = `<div class="incomeEquivalenceValues" aria-live="polite"><div><span>En soles</span><strong>${hasAmount ? 'S/ 3,700.00' : '—'}</strong></div><div><span>En dólares</span><strong>${hasAmount ? '$ 1,000.00' : '—'}</strong></div>${hasAmount ? '' : '<span class="sr-only">Ingresa un monto para ver su equivalencia.</span>'}</div>`
  return `<div class="incomeEquivalenceHeading"><span>Equivalencia estimada</span><button aria-label="Ayuda">!</button></div><span class="incomeAppliedRate ${currency === 'USD' ? 'incomeAppliedRateUsd' : ''}">${rates}</span>${values}`
}

async function snapshot(page: import('@playwright/test').Page) {
  return page.getByTestId('equivalence').evaluate(element => {
    const rect = element.getBoundingClientRect()
    const nextField = element.closest('.incomeSection')?.nextElementSibling as HTMLElement | null
    const nextFieldRect = nextField?.getBoundingClientRect()
    const form = element.closest<HTMLElement>('[data-testid="equivalence-form"]')
    const panel = element.closest<HTMLElement>('[data-testid="equivalence-panel"]')
    const formRect = form?.getBoundingClientRect()
    const panelRect = panel?.getBoundingClientRect()
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      offsetHeight: (element as HTMLElement).offsetHeight,
      nextFieldY: nextFieldRect?.y ?? null,
      formScrollHeight: form?.scrollHeight ?? null,
      formHeight: formRect?.height ?? null,
      panelWidth: panelRect?.width ?? null,
      panelHeight: panelRect?.height ?? null,
      html: element.innerHTML,
    }
  })
}

for (const viewport of [
  { name: 'tablet-834', width: 834, height: 900 },
  { name: 'desktop-1440', width: 1440, height: 960 },
  { name: 'desktop-1710', width: 1710, height: 960 },
  { name: 'mobile-390', width: 390, height: 844 },
]) {
  test(`equivalence layout remains stable across empty, entered amount, currency, and live-rate states at ${viewport.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' })
    await page.setContent(`<style>${manropeCss()} ${equivalenceCss()} .fixture{box-sizing:border-box;width:min(calc(100vw - 16px),580px);max-width:580px;margin:24px auto}.equivalence-panel,.equivalence-form{min-width:0}.equivalence-panel{box-sizing:border-box;width:100%;padding:22px 24px 24px;border:1px solid #dce1e5;border-radius:12px;background:#fff}.equivalence-form{display:grid;gap:12px}.next-field{min-height:40px;border:1px solid #dce1e5;border-radius:10px}@media(max-width:767px){.equivalence-panel{padding:20px 18px}}</style><main class="fixture"><div class="equivalence-panel" data-testid="equivalence-panel"><div class="equivalence-form" data-testid="equivalence-form"><div class="incomeSection"><div class="incomeEquivalence" data-testid="equivalence">${markup(false, 'PEN', false)}</div></div><div class="next-field" data-testid="next-field">Fecha</div></div></div></main>`)
    await page.evaluate(() => document.fonts.ready)

    const empty = await snapshot(page)
    const outputDirectory = process.env.FINTRACK_LAYOUT_EVIDENCE_DIR
    if (outputDirectory) {
      await page.screenshot({ path: join(outputDirectory, `equivalence-${viewport.name}-empty.png`) })
    }

    await page.getByTestId('equivalence').evaluate((element, html) => { element.innerHTML = html }, markup(true, 'PEN', false))
    const entered = await snapshot(page)
    if (outputDirectory) {
      await page.screenshot({ path: join(outputDirectory, `equivalence-${viewport.name}-entered.png`) })
    }

    await page.getByTestId('equivalence').evaluate((element, html) => {
      element.classList.add('incomeEquivalence')
      element.innerHTML = html
    }, markup(true, 'USD', false))
    const usdNoReference = await snapshot(page)
    await page.getByTestId('equivalence').evaluate((element, html) => { element.innerHTML = html }, markup(true, 'USD', true))
    const updatedRate = await snapshot(page)

    const report = {
      viewport,
      empty,
      entered,
      usdNoReference,
      updatedRate,
      deltaEmptyToAmount: entered.height - empty.height,
      deltaUsdReference: updatedRate.height - usdNoReference.height,
    }
    await testInfo.attach(`equivalence-geometry-${viewport.name}.json`, { body: JSON.stringify(report, null, 2), contentType: 'application/json' })
    console.log(`equivalence measured ${viewport.name}: ${JSON.stringify(report)}`)

    // Empty and populated states retain the same value grid; USD reserves the
    // reference-rate row so asynchronous FX updates do not resize the card.
    expect(empty.width).toBe(entered.width)
    expect(empty.height).toBe(entered.height)
    expect(empty.offsetHeight).toBe(entered.offsetHeight)
    expect(empty.nextFieldY).toBe(entered.nextFieldY)
    expect(empty.formScrollHeight).toBe(entered.formScrollHeight)
    expect(empty.panelHeight).toBe(entered.panelHeight)
    expect(Math.abs(usdNoReference.height - updatedRate.height)).toBeLessThanOrEqual(0.5)
  })
}
