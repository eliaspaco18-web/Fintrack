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
  await check('Form simulates save and closes',!await page.locator('#overlay').evaluate(d=>d.open));
  await page.getByRole('button',{name:'Filtros',exact:true}).click();
  await page.locator('#filter-form [name="currency"]').selectOption('USD');
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
  await check('Mobile submit completes',!await page.locator('#overlay').evaluate(d=>d.open));
  await shot('16-dashboard-mobile-dark',390,844,'dashboard','dark');
  await shot('17-loading-desktop',1440,1000,'dashboard','light','loading');
  await shot('18-obligations-currency-warning',1440,1000,'receivables');
  await page.setViewportSize({width:390,height:844});
  await page.goto('http://127.0.0.1:4173/#dashboard');
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:path.join(output,'19-dashboard-mobile-viewport.png'),fullPage:false});
  await page.evaluate(()=>window.scrollTo(0,900));
  await page.screenshot({path:path.join(output,'20-dashboard-mobile-scrolled.png'),fullPage:false});
  for(const width of [320,375,768,1024,1280,1920]) {
    await page.setViewportSize({width,height:900});
    for(const screen of ['dashboard','transactions','portfolio','budgets','credits']) {
      await page.goto(`http://127.0.0.1:4173/#${screen}`);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await check(`${screen} ${width}: no horizontal overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      if(screen==='dashboard') await check(`Chart labels ${width}: rendered minimum 11px`, await page.locator('.chart').evaluate(svg=>[...svg.querySelectorAll('text')].every(t=>parseFloat(getComputedStyle(t).fontSize)*svg.getBoundingClientRect().width/560>=10.99)));
    }
  }
  await check('No browser runtime errors',errors.length===0);
} catch (error) {
  failure = error.message;
  throw error;
} finally {
  const report = {startedAt, finishedAt:new Date().toISOString(), checks, errors, failure};
  console.log(JSON.stringify(report,null,2));
  await fs.writeFile(path.join(output,'verification.json'),JSON.stringify(report,null,2)+'\n');
  await browser.close();
}
