import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(here, '../screenshots');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const checks=[];
async function settle(){await page.evaluate(()=>Promise.allSettled(document.getAnimations().map(animation=>animation.finished)));}
const screenshot=page.screenshot.bind(page);
page.screenshot=async options=>{await settle();return screenshot(options);};
const geometry={};
function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(n=>parseInt(n,16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);
  return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
}
function contrast(a,b) { const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); }
const startedAt = new Date().toISOString();
let failure = null;
await page.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.hostname === '127.0.0.1' && url.port === '4173') return route.continue();
  errors.push(`Unexpected external request blocked: ${url.origin}`);
  return route.abort();
});
async function check(label, condition) { checks.push({label,pass:!!condition}); if(!condition) throw new Error(label); }
async function shot(name, width, height, hash='dashboard', theme='light', state='ready') {
  await page.setViewportSize({width,height});
  await page.goto('about:blank');
  await page.goto(`http://127.0.0.1:4173/?theme=${theme}&state=${state}#${hash}`);
  await page.evaluate(()=>document.fonts.ready);
  await check(`${name}: no horizontal overflow`, await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.join(output,`${name}.png`),fullPage:true});
}
try {
  const css = await fs.readFile(path.join(here,'design.css'),'utf8');
  for (const [theme,pattern] of [['light',/:root\{([^}]+)\}/],['dark',/\[data-theme="dark"\]\{([^}]+)\}/]]) {
    const tokens=Object.fromEntries([...css.match(pattern)[1].matchAll(/--([a-z-]+):(#[0-9a-f]{6})/g)].map(m=>[m[1],m[2]]));
    for(const [fg,bg,minimum] of [['ink','surface',4.5],['muted','surface',4.5],['faint','subtle',4.5],['on-accent','accent',4.5],['control','surface',3],['positive','positive-soft',4.5],['negative','negative-soft',4.5],['warning','warning-soft',4.5]]) {
      await check(`${theme} ${fg}/${bg}: contrast >= ${minimum}`,contrast(tokens[fg],tokens[bg])>=minimum);
    }
  }
  await shot('01-dashboard-desktop-light',1440,1080);
  geometry.desktop=await page.evaluate(()=>Object.fromEntries(['.position-band','.month-report','.agenda-panel','.dashboard-budgets','.recent-register','.credit-overview'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return[s,{x:r.x,y:r.y,width:r.width,height:r.height}]})));
  await shot('02-dashboard-tablet-light',834,1112);
  await shot('03-dashboard-mobile-light',390,844);
  await shot('04-transactions-desktop-light',1440,1000,'transactions');
  await page.getByRole('searchbox',{name:'Buscar movimientos'}).fill('Supermercado');
  await check('Search narrows the ledger',await page.locator('tbody tr').count()===1);
  await page.getByRole('searchbox',{name:'Buscar movimientos'}).fill('');
  await page.locator('.desktop-table [data-detail="1"]').first().click();
  await page.screenshot({path:path.join(output,'05-transaction-detail-drawer.png'),fullPage:false});
  await page.getByRole('button',{name:'Editar movimiento',exact:true}).click();
  await page.screenshot({path:path.join(output,'06-transaction-edit-form.png'),fullPage:false});
  await page.getByRole('button',{name:'Guardar cambios',exact:true}).click();
  await settle();
  await page.waitForFunction(()=>!document.querySelector('#overlay').open);
  await check('Form closes with brief confirmation without changing snapshot',await page.locator('.feedback-card').innerText().then(t=>t.includes('Simulación')));
  await settle();
  await page.getByRole('button',{name:'Filtros',exact:true}).click();
  await page.locator('#filter-form .ft-select-trigger').first().click();
  await page.locator('#choice-search').fill('USD');await page.locator('#choice-options').getByRole('option').click();
  await page.getByRole('button',{name:'Aplicar filtros',exact:true}).click();
  await check('USD filter displays a truthful empty result',await page.getByRole('heading',{name:'No hay coincidencias'}).isVisible());
  await shot('07-accounts-desktop-light',1440,1000,'portfolio');
  await shot('08-budgets-desktop-light',1440,1000,'budgets');
  await shot('09-credits-desktop-light',1440,1000,'credits');
  await shot('10-dashboard-desktop-dark',1440,1080,'dashboard','dark');
  await shot('11-transactions-dark',1440,1000,'transactions','dark');
  await shot('12-dashboard-partial-error',1440,1000,'dashboard','light','error');
  await page.getByRole('button',{name:'Reintentar',exact:true}).first().click();
  await check('Retry restores healthy state',await page.locator('.warning-banner').count()===0);
  await shot('13-first-use-mobile',390,844,'dashboard','light','empty');
  await shot('14-transactions-mobile',390,844,'transactions');
  await page.getByRole('button',{name:'Registrar',exact:true}).click();
  await page.locator('[data-operation="expense"]').click();
  await page.locator('#movement-form [name="amount"]').fill('125.50');
  await page.locator('#movement-form [name="description"]').fill('Compra de alimentos');
  await page.screenshot({path:path.join(output,'15-mobile-create-form.png'),fullPage:false});
  await page.getByRole('button',{name:'Cerrar',exact:true}).click();
  await check('Dirty close offers protection',await page.locator('#discard-note').isVisible());
  await page.getByRole('button',{name:'Seguir editando',exact:true}).click();
  await page.getByRole('button',{name:'Guardar movimiento',exact:true}).click();
  await settle();
  await page.waitForFunction(()=>!document.querySelector('#overlay').open);
  await check('Mobile submit shows brief simulated confirmation',await page.locator('.feedback-card').isVisible());
  await shot('16-dashboard-mobile-dark',390,844,'dashboard','dark');
  await shot('17-loading-desktop',1440,1000,'dashboard','light','loading');
  await shot('18-obligations-currency-warning',1440,1000,'receivables');
  await page.setViewportSize({width:390,height:844});
  await page.goto('http://127.0.0.1:4173/#dashboard');
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:path.join(output,'19-dashboard-mobile-viewport.png'),fullPage:false});
  await page.evaluate(()=>window.scrollTo(0,900));
  await page.screenshot({path:path.join(output,'20-dashboard-mobile-scrolled.png'),fullPage:false});
  await page.setViewportSize({width:1200,height:900});
  await page.goto('http://127.0.0.1:4173/brand.html');
  await page.evaluate(()=>document.fonts.ready);
  await check('FT Ligature assets load at every illustrated size',await page.locator('img').evaluateAll(images=>images.every(img=>img.complete&&img.naturalWidth>0)));
  await page.screenshot({path:path.join(output,'21-ft-ligature-system.png'),fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('http://127.0.0.1:4173/#dashboard');
  await page.locator('.month-result').click();
  await check('Result explanation includes eight source category rows',await page.locator('#overlay .explanation-row').count()===8);
  await page.screenshot({path:path.join(output,'22-result-explanation.png'),fullPage:false});
  await page.locator('#overlay [data-category-link="Alimentación"]').click();
  await page.waitForURL('**/#transactions');
  await page.waitForFunction(()=>document.querySelectorAll('tbody tr').length===2);
  await check('Explanation drills into the exact category records',await page.locator('tbody tr').count()===2);
  await check('Category context is visible and removable',await page.locator('[data-action="workspace-clear-category"]').isVisible());
  await page.screenshot({path:path.join(output,'23-category-to-records.png'),fullPage:true});
  await page.locator('[data-action="workspace-clear-category"]').click();
  await check('Removing category keeps the expense type filter',await page.locator('tbody tr').count()===8);
  await page.goto('about:blank');
  await page.setViewportSize({width:390,height:844});
  await page.goto('http://127.0.0.1:4173/#dashboard');
  await check('Mobile keeps the analytical chart collapsed initially',await page.locator('[data-action="workspace-analysis"]').getAttribute('aria-expanded')==='false');
  await page.locator('[data-action="workspace-analysis"]').click();
  await check('Mobile reveals the analytical chart on request',await page.locator('.report-analysis').isVisible());
  await page.screenshot({path:path.join(output,'24-mobile-analysis-expanded.png'),fullPage:true});
  await page.goto('about:blank');
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('http://127.0.0.1:4173/#dashboard');
  await page.locator('[data-agenda-window="30"]').click();
  await page.locator('[data-action="workspace-agenda"]').click();
  await check('30-day agenda exposes all eleven dated commitments',await page.locator('#overlay .agenda-row').count()===11);
  await page.screenshot({path:path.join(output,'25-thirty-day-agenda.png'),fullPage:false});
  await page.locator('#overlay [data-commitment="ar-horizonte"]').click();
  await check('Commitment detail preserves native USD amount',await page.locator('#overlay .detail-amount').innerText()==='US$ 400.00');
  await page.getByRole('button',{name:'Cerrar',exact:true}).click();
  await shot('26-dashboard-tablet-landscape',1024,768);
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('http://127.0.0.1:4173/#transactions');
  await page.getByRole('button',{name:'Filtros',exact:true}).click();
  await page.screenshot({path:path.join(output,'27-filter-drawer.png'),fullPage:false});
  await page.getByRole('button',{name:'Cerrar',exact:true}).click();
  await page.goto('http://127.0.0.1:4173/#dashboard');
  await page.locator('[data-action="workspace-accounts"]').first().click();
  await check('Account drilldown contains four original-currency records',await page.locator('#overlay [data-account]').count()===4);
  await page.screenshot({path:path.join(output,'28-account-peek.png'),fullPage:false});
  await page.locator('#overlay .icon-btn[aria-label="Cerrar"]').click();
  await page.locator('[data-category-type="income"]').click();
  await check('Income categories reuse the same analytical region',await page.locator('.category-rank [data-category-link]').count()===2);
  await page.locator('[data-category-type="expense"]').click();
  await page.locator('[data-operation="expense"]').first().click();
  await check('Desktop primary action opens expense directly',await page.getByRole('heading',{name:'Registrar egreso',exact:true}).isVisible());
  await page.getByRole('button',{name:'Cerrar',exact:true}).click();
  for(const width of [320,375,768,1024,1280,1920]) {
    await page.setViewportSize({width,height:900});
    for(const screen of ['dashboard','transactions','portfolio','budgets','credits']) {
      await page.goto(`http://127.0.0.1:4173/#${screen}`);
      if(screen==='dashboard'&&width<768&&await page.locator('[data-action="workspace-analysis"]').getAttribute('aria-expanded')==='false')await page.locator('[data-action="workspace-analysis"]').click();
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await check(`${screen} ${width}: no horizontal overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      if(screen==='dashboard') await check(`Chart labels ${width}: rendered minimum 11px`, await page.locator('.chart').evaluate(svg=>[...svg.querySelectorAll('text')].every(t=>parseFloat(getComputedStyle(t).fontSize)*svg.getBoundingClientRect().width/560>=10.99)));
      if(screen==='dashboard'&&width<768) await check(`Chart targets ${width}: minimum 44px`,await page.locator('.chart-hit').evaluateAll(nodes=>nodes.every(node=>node.getBoundingClientRect().width>=44)));
    }
  }
  await check('No browser runtime errors',errors.length===0);
} catch (error) {
  failure = error.message;
  throw error;
} finally {
  const report = {startedAt, finishedAt:new Date().toISOString(), checks, errors, failure, geometry};
  console.log(JSON.stringify(report,null,2));
  await fs.writeFile(path.join(output,'verification.json'),JSON.stringify(report,null,2)+'\n');
  await browser.close();
}
