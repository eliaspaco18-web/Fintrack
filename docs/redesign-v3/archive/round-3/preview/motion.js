/* Controls the isolated same-origin review iframe, never the production app. */
'use strict';
const frame=document.querySelector('#lab-preview'),status=document.querySelector('#lab-status');
function reviewSettings(){const api=frame.contentWindow.FinTrackReview;if(!api)return;api.setRate(Number(document.querySelector('#lab-speed').value));api.setReduced(document.querySelector('#lab-reduce').checked);api.pointer();}
frame.addEventListener('load',reviewSettings);
document.querySelector('#lab-speed').addEventListener('change',reviewSettings);
document.querySelector('#lab-reduce').addEventListener('change',reviewSettings);
document.querySelector('#lab-theme').addEventListener('change',event=>{document.documentElement.dataset.theme=event.target.value;frame.src=`index.html?theme=${event.target.value}#transactions`;});
async function pageFor(hash,scenario='ready'){
  await new Promise(resolve=>{frame.addEventListener('load',resolve,{once:true});frame.src=`index.html?theme=${document.querySelector('#lab-theme').value}&state=${scenario}#${hash}`;});reviewSettings();return frame.contentWindow;
}
let sequence=0;
document.querySelectorAll('[data-scene]').forEach(button=>button.addEventListener('click',async()=>{
  const current=++sequence;let win=frame.contentWindow;const scene=button.dataset.scene;
  if(scene==='detail'||scene==='edit'){
    if(!win.location.hash.includes('transactions')||!win.FinTrackReview)win=await pageFor('transactions');
    if(current!==sequence)return;reviewSettings();
    if(scene==='detail'){win.FinTrackReview.detail(1);status.textContent='El panel se acopla desde el borde derecho; el contenido termina de asentarse después.';}
    else{if(!win.document.querySelector('#overlay').open){win.FinTrackReview.detail(1);win.FinTrackReview.finish();}win.document.querySelector('[data-edit="1"]')?.click();status.textContent='Detalle → edición conserva ancho, posición y superficie. «Volver» protege el borrador.';}
  }else if(scene==='menu'){win=await pageFor('dashboard');if(current!==sequence)return;win.document.querySelector('[aria-label="Otras formas de registrar"]').click();status.textContent='El origen del menú coincide con el botón. Escape cierra sin movimiento al usar teclado.';}
  else if(scene==='loading'){await pageFor('dashboard','loading');status.textContent='Pulsa «Simular carga completada» dentro de la preview. La lectura aparece sin animar cifras.';}
  else if(scene==='chart'){win=await pageFor('dashboard');if(current!==sequence)return;const toggle=win.document.querySelector('[data-action="workspace-analysis"]');if(toggle?.getAttribute('aria-expanded')==='false')toggle.click();status.textContent='Pasa por un mes o selecciónalo. Flechas cambian el foco; Enter fija la lectura; Escape oculta el detalle.';}
}));
document.querySelector('#lab-close').addEventListener('click',()=>{reviewSettings();frame.contentWindow.FinTrackReview?.close();status.textContent='Cierre más corto que apertura. Un borrador requiere confirmación; el fondo recupera el foco.';});
