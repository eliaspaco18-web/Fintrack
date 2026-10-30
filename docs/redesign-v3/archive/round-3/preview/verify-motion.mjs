import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),output=path.join(here,'../screenshots');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
const checks=[],errors=[],observations={};let failure=null;
const startedAt=new Date().toISOString();
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname==='127.0.0.1'&&url.port==='4173')return route.continue();errors.push('External request blocked: '+url.origin);return route.abort();});
async function check(label,condition){checks.push({label,pass:!!condition});if(!condition)throw new Error(label);}
async function settle(){await page.evaluate(()=>Promise.allSettled(document.getAnimations().map(a=>a.finished)));}
async function shot(name){await settle();await page.screenshot({path:path.join(output,name+'.png')});}
async function load(hash='dashboard',theme='light'){await page.goto(`http://127.0.0.1:4173/?theme=${theme}#${hash}`);await page.evaluate(()=>document.fonts.ready);}
try{
  await load();
  observations.insetColor=await page.locator('.report-foot').evaluate(node=>getComputedStyle(node).backgroundColor);
  await page.locator('[data-flow-month="Ago"]').hover();
  await check('Month hover exposes exact income, expense and result', (await page.locator('#flow-tooltip').innerText()).includes('+S/ 4,840.00'));
  await check('Hover changes only the chart reading, not current month totals',(await page.locator('.month-result').innerText()).includes('+S/ 5,120.00'));
  await shot('29-flow-inspection-tooltip');
  await page.locator('[data-flow-month="Ago"]').click();await page.locator('h1').hover();
  await check('Click pins the exact month reading',(await page.locator('#flow-result').innerText())==='+S/ 4,840.00');
  await page.locator('[data-flow-month="Ago"]').focus();await page.keyboard.press('ArrowLeft');
  await check('Chart supports roving keyboard focus',await page.locator('[data-flow-month="Jul"]').evaluate(n=>n===document.activeElement));
  await page.keyboard.press('Enter');await page.keyboard.press('Escape');
  await check('Escape hides tooltip and retains pinned month',await page.locator('#flow-tooltip').isHidden()&&(await page.locator('#flow-result').innerText())==='+S/ 4,060.00');
  await page.getByRole('button',{name:'Otras formas de registrar'}).click();await shot('30-anchored-operation-menu');
  await check('Operation menu includes all eight existing operations',await page.locator('#context-popover [data-operation]').count()===8);
  await check('Menu remains within viewport',await page.locator('#context-popover').evaluate(n=>{const r=n.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}));
  await page.keyboard.press('Escape');await check('Menu Escape restores focus',await page.getByRole('button',{name:'Otras formas de registrar'}).evaluate(n=>n===document.activeElement));
  await load('transactions');
  observations.openTimings=await page.evaluate(()=>{FinTrackReview.pointer();FinTrackReview.detail(1);return document.querySelector('#overlay').getAnimations({subtree:true}).map(a=>({duration:a.effect.getTiming().duration,delay:a.effect.getTiming().delay,easing:a.effect.getTiming().easing}));});
  await check('Context docking uses 260ms and delayed 180ms content',observations.openTimings.some(a=>a.duration===260)&&observations.openTimings.some(a=>a.duration===180&&a.delay===36));
  await settle();
  const readRect=await page.locator('#overlay').boundingBox();
  await page.locator('[data-record-tab="context"]').click();await shot('31-contextual-record-workbench');
  await check('Context view explains actual record and report semantics',(await page.locator('#record-content').innerText()).includes('Participa en el resultado del mes'));
  await page.locator('[data-edit="1"]').click();await settle();
  const editRect=await page.locator('#overlay').boundingBox();
  await check('Read to edit preserves exact workbench geometry',readRect.x===editRect.x&&readRect.width===580&&editRect.width===580&&readRect.height===editRect.height);
  await page.locator('[name="amount"]').fill('481.00');await page.locator('[data-refine="back-record"]').click();
  await check('Back-to-record cannot silently discard draft',await page.locator('#discard-note').isVisible());
  await page.locator('[data-action="keep-editing"]').click();await check('Keep editing retains draft value',await page.locator('[name="amount"]').inputValue()==='481.00');
  await page.locator('[data-refine="back-record"]').click();await page.locator('[data-action="discard"]').click();await settle();
  await check('Explicit discard returns to original record',(await page.locator('.detail-amount').innerText())==='−S/ 480.00');
  await page.locator('[data-refine="record-more"]').click();await page.locator('#context-popover [data-delete]').click();await shot('32-rounded-delete-confirmation');
  await check('Confirmation uses 24px radius',await page.locator('#overlay').evaluate(n=>getComputedStyle(n).borderTopLeftRadius==='24px'));
  await page.getByRole('button',{name:'Cerrar',exact:true}).click();await settle();
  await page.evaluate(()=>{FinTrackReview.pointer();FinTrackReview.setRate(3);FinTrackReview.detail(1);});
  await page.waitForTimeout(60);
  await page.evaluate(()=>FinTrackReview.close());await page.waitForTimeout(50);
  await page.evaluate(()=>FinTrackReview.detail(2));await settle();
  await check('Interrupted close cannot unmount a reopened panel',await page.locator('#overlay').evaluate(n=>n.open)&&await page.locator('#overlay-title').innerText()==='Proyecto editorial');
  await page.evaluate(()=>FinTrackReview.setRate(1));
  await page.keyboard.press('Escape');
  await check('Keyboard close is immediate',!await page.locator('#overlay').evaluate(n=>n.open));
  await page.locator('.desktop-table [data-detail="1"]').first().focus();await page.keyboard.press('Enter');
  await check('Keyboard opening has no active motion',await page.locator('#overlay').evaluate(n=>n.open&&n.getAnimations({subtree:true}).length===0));
  await page.keyboard.press('Escape');
  await check('Focus returns to exact register trigger',await page.locator('.desktop-table [data-detail="1"]').first().evaluate(n=>n===document.activeElement));
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('.desktop-table [data-detail="1"]').first().click();
  await check('OS reduced motion opens without transform animation',await page.locator('#overlay').evaluate(n=>n.getAnimations({subtree:true}).length===0));
  await page.getByRole('button',{name:'Cerrar',exact:true}).click();await check('OS reduced motion closes immediately',!await page.locator('#overlay').evaluate(n=>n.open));
  await page.emulateMedia({reducedMotion:'no-preference'});
  await load('transactions','dark');await page.locator('.desktop-table [data-detail="1"]').first().click();await shot('33-dark-record-workbench');
  await page.setViewportSize({width:390,height:844});await load('transactions');await page.locator('.mobile-record [data-detail="1"]').first().click();await shot('34-mobile-record-workbench');
  await check('Mobile panel retains all four rounded corners and 8px inset',await page.locator('#overlay').evaluate(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return r.x===8&&r.right===innerWidth-8&&s.borderTopLeftRadius==='24px'&&s.borderBottomRightRadius==='24px';}));
  await check('Mobile close and record navigation are 44px targets',await page.locator('.panel-nav .icon-btn').evaluateAll(nodes=>nodes.every(n=>{const r=n.getBoundingClientRect();return r.width>=44&&r.height>=44;})));
  await check('Mobile workbench does not overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.querySelector('#overlay').scrollWidth<=document.querySelector('#overlay').clientWidth));
  for(const width of [320,375,768,834]){
    await page.setViewportSize({width,height:900});await load('transactions');await page.evaluate(()=>{FinTrackReview.pointer();FinTrackReview.detail(1);});await settle();
    await check(`Workbench ${width}: body and controls fit`,await page.locator('#overlay').evaluate(n=>{const r=n.getBoundingClientRect();return n.scrollWidth<=n.clientWidth&&[...n.querySelectorAll('.panel-nav button,.panel-actions button')].every(b=>{const a=b.getBoundingClientRect();return a.left>=r.left&&a.right<=r.right;});}));
  }
  await page.setViewportSize({width:1440,height:1000});await page.goto('http://127.0.0.1:4173/?state=loading#dashboard');
  await page.evaluate(()=>document.fonts.ready);
  const skeletonBox=await page.locator('.month-report').evaluate(n=>{const r=n.getBoundingClientRect();return{y:r.y+scrollY,height:r.height};});
  await page.locator('[data-refine="resolve-loading"]').click();await settle();await check('Skeleton resolves to exact values, never count-up',await page.locator('.month-result').innerText()==='Resultado del período\n+S/ 5,120.00');
  const contentBox=await page.locator('.month-report').evaluate(n=>{const r=n.getBoundingClientRect();return{y:r.y+scrollY,height:r.height};});observations.loadingGeometry={skeletonBox,contentBox};await check('Skeleton to content retains region geometry',skeletonBox.y===contentBox.y&&skeletonBox.height===contentBox.height);
  await page.goto('http://127.0.0.1:4173/motion.html');await page.locator('#lab-preview').waitFor();await page.frameLocator('#lab-preview').locator('h1').waitFor();
  await page.locator('[data-scene="detail"]').click();await page.frameLocator('#lab-preview').locator('#overlay[open]').waitFor();
  await page.evaluate(()=>Promise.allSettled(document.querySelector('iframe').contentDocument.getAnimations().map(a=>a.finished)));await shot('35-motion-review-workshop');
  await check('Workshop controls operate the isolated preview',await page.frameLocator('#lab-preview').locator('#overlay-title').innerText()==='Supermercado');
  await page.locator('#lab-reduce').check();await page.locator('#lab-close').click();
  await check('Workshop reduced mode immediately closes panel',!await page.frameLocator('#lab-preview').locator('#overlay').evaluate(n=>n.open));
  await check('No browser errors or external requests',errors.length===0);
}catch(error){failure=error.message;throw error;}finally{
  const report={startedAt,finishedAt:new Date().toISOString(),checks,errors,observations,failure};
  await fs.writeFile(path.join(output,'motion-verification.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));await browser.close();
}
