/* Round 07 feedback refinement; source-audited actions, never production services. */
'use strict';

// One feedback host survives route renders and moves into the active modal's
// accessibility subtree. Native popover keeps it above the modal without a veil.
const feedback={items:[],serial:0,limit:()=>innerWidth<768?1:2};
const feedbackRail=document.createElement('section');
feedbackRail.id='feedback-rail';feedbackRail.setAttribute('popover','manual');
feedbackRail.setAttribute('aria-label','Confirmaciones de operaciones');
const feedbackLive=document.createElement('div');feedbackLive.className='sr-only';feedbackLive.setAttribute('role','status');feedbackLive.setAttribute('aria-atomic','true');
const feedbackUrgent=feedbackLive.cloneNode();feedbackUrgent.setAttribute('role','alert');
feedbackRail.append(feedbackLive,feedbackUrgent);document.body.append(feedbackRail);
function positionFeedback(){
  const dialog=$('#overlay'),modal=dialog.open&&dialog.dataset.phase!=='closing';
  const parent=modal?dialog:document.body;
  if(feedbackRail.parentElement!==parent){if(feedbackRail.matches(':popover-open'))feedbackRail.hidePopover();parent.append(feedbackRail);}
  if(!feedback.items.some(item=>item.node)){if(feedbackRail.matches(':popover-open'))feedbackRail.hidePopover();return;}
  if(!feedbackRail.matches(':popover-open'))feedbackRail.showPopover();
  const v=visualViewport,left=v?.offsetLeft||0,top=v?.offsetTop||0,w=v?.width||innerWidth,h=v?.height||innerHeight;
  const rect=modal?dialog.getBoundingClientRect():$('.workspace').getBoundingClientRect();
  const gutter=innerWidth<1200?16:24,width=Math.min(388,w-32,rect.width-32);
  feedbackRail.style.width=width+'px';
  const header=modal?$('.dialog-header',dialog):$('#topbar'),head=modal?null:$('.page-head');
  const headerBottom=Math.max(top+12,header?.getBoundingClientRect().bottom||0);
  const headBottom=head?.getBoundingClientRect().bottom||0;
  let y=Math.max(headerBottom,headBottom>headerBottom&&headBottom<top+h*.45?headBottom:0)+12;
  y=Math.max(top+12,Math.min(y,top+h-feedbackRail.offsetHeight-16));
  feedbackRail.style.left=Math.max(left+16,Math.min(rect.right-width-gutter,left+w-width-16))+'px';
  feedbackRail.style.top=y+'px';feedbackRail.style.bottom='auto';
}
function remainingFeedback(item){return Math.max(0,item.remaining-(!item.pauses.size&&item.node&&!item.closing?performance.now()-item.started:0));}
function paintFeedbackClock(item){
  if(!item.node)return;
  const paused=!!item.pauses.size,remaining=remainingFeedback(item);
  item.node.dataset.paused=String(paused);item.node.dataset.quiet=String(item.quiet);
  $('.feedback-time',item.node).textContent=paused?'En pausa':(item.quiet?'Cierra en ':'')+Math.max(1,Math.round(remaining/1000))+' s';
  $('.feedback-timer-fill',item.node).style.transform='scaleX('+remaining/item.duration+')';
}
function stopFeedbackClock(item){
  clearTimeout(item.timer);clearInterval(item.tick);item.progress?.cancel();item.progress=null;
}
function pauseFeedback(item,reason,pause){
  if(item.closing||!item.node||item.pauses.has(reason)===pause)return;
  if(pause){if(!item.pauses.size){item.remaining=remainingFeedback(item);stopFeedbackClock(item);}item.pauses.add(reason);paintFeedbackClock(item);}
  else {item.pauses.delete(reason);if(!item.pauses.size)armFeedback(item);else paintFeedbackClock(item);}
}
function armFeedback(item){
  stopFeedbackClock(item);if(!item.node||item.closing)return;
  item.started=performance.now();paintFeedbackClock(item);if(item.pauses.size)return;
  if(!item.quiet){item.progress=$('.feedback-timer-fill',item.node).animate([{transform:'scaleX('+item.remaining/item.duration+')'},{transform:'scaleX(0)'}],{duration:item.remaining,easing:'linear',fill:'forwards'});item.progress.finished.catch(()=>{});}
  item.tick=setInterval(()=>paintFeedbackClock(item),200);
  item.timer=setTimeout(()=>dismissFeedback(item.id),item.remaining);
}
function feedbackPositions(){return new Map(feedback.items.filter(i=>i.node).map(i=>[i.id,i.node.getBoundingClientRect().top]));}
function settleFeedbackStack(previous){
  for(const item of feedback.items){if(!item.node||!previous.has(item.id))continue;const dy=previous.get(item.id)-item.node.getBoundingClientRect().top;if(Math.abs(dy)>1)move(item.node,[{transform:'translateY('+dy+'px)'},{transform:'none'}],180);}
}
function dismissFeedback(id){
  const item=feedback.items.find(i=>i.id===id);if(!item||item.closing)return;
  item.remaining=remainingFeedback(item);stopFeedbackClock(item);item.closing=true;
  const hadFocus=item.node?.contains(document.activeElement);
  const finish=()=>{const previous=feedbackPositions();item.node?.remove();feedback.items=feedback.items.filter(i=>i!==item);flushFeedback();settleFeedbackStack(previous);if(hadFocus)(($('#overlay').open?$('#overlay-title'):lastFocus?.isConnected?lastFocus:$('#main')))?.focus({preventScroll:true});};
  const current=item.node?{opacity:getComputedStyle(item.node).opacity,transform:getComputedStyle(item.node).transform}:{opacity:1,transform:'none'};
  item.node?.getAnimations().forEach(a=>a.cancel());
  const motion=move(item.node,[current,{opacity:0,transform:'translate(8px,-4px) scale(.99)'}],150);
  if(motion)motion.finished.then(finish,finish);else finish();
}
function flushFeedback(){
  const mounted=feedback.items.filter(i=>i.node&&!i.closing);
  mounted.slice(feedback.limit()).forEach(item=>{item.remaining=remainingFeedback(item);stopFeedbackClock(item);item.node.remove();item.node=null;item.pauses.clear();});
  let visible=feedback.items.filter(i=>i.node).length;
  for(const item of feedback.items){
    if(item.node||visible>=feedback.limit())continue;visible++;
    const node=document.createElement('article');item.node=node;item.quiet=!canMove();node.className='feedback-card';node.dataset.kind=item.kind;node.dataset.feedbackId=item.id;
    node.innerHTML='<span class="feedback-symbol" aria-hidden="true">'+icon(item.kind==='success'?'check':item.kind==='error'?'close':'info',16)+'</span><div><strong>'+esc(item.title)+'</strong><p>'+esc(item.detail)+'</p>'+(item.simulation?'<small>Simulación · Sin cambios en datos financieros</small>':'')+'</div><button class="icon-btn" type="button" aria-label="Cerrar confirmación: '+esc(item.title)+'">'+icon('close',14)+'</button><div class="feedback-lifetime" aria-hidden="true"><span class="feedback-timer-track"><i class="feedback-timer-fill" data-feedback-clock></i></span><span class="feedback-time"></span></div>';
    node.querySelector('button').onclick=()=>dismissFeedback(item.id);
    node.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch')pauseFeedback(item,'hover',true);});node.addEventListener('pointerleave',()=>pauseFeedback(item,'hover',false));
    node.addEventListener('focusin',()=>pauseFeedback(item,'focus',true));node.addEventListener('focusout',()=>queueMicrotask(()=>{if(!node.contains(document.activeElement))pauseFeedback(item,'focus',false);}));
    node.addEventListener('pointerdown',()=>pauseFeedback(item,'hold',true));
    node.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();dismissFeedback(item.id);}});
    feedbackRail.append(node);positionFeedback();
    if(!item.announced){const live=item.kind==='error'?feedbackUrgent:feedbackLive;live.textContent=[item.title,item.detail,item.simulation?'Simulación. Sin escritura financiera.':'','Confirmación temporal. Se pausa al enfocarla.'].join(' ');item.announced=true;}
    move(node,[{opacity:.35,transform:'translate(12px,-6px) scale(.985)'},{opacity:1,transform:'none'}],230,'out');
    move($('.feedback-symbol',node),[{opacity:.5,transform:'scale(.9)'},{opacity:1,transform:'none'}],160,'out',40);
    if(document.hidden)item.pauses.add('hidden');armFeedback(item);
  }
  positionFeedback();
}
function notifyAction({kind='success',title,detail='',simulation=false,key=null}={}){
  const existing=feedback.items.find(i=>!i.closing&&i.key===key&&key&&i.title===title&&i.detail===detail);
  if(existing){existing.remaining=existing.duration;armFeedback(existing);return existing.id;}
  const duration=kind==='success'||kind==='info'?4200:kind==='warning'?6200:8200;
  const item={id:++feedback.serial,kind,title,detail,simulation,key,duration,remaining:duration,pauses:new Set(),started:performance.now(),node:null,closing:false,announced:false};
  feedback.items.push(item);flushFeedback();return item.id;
}
document.addEventListener('visibilitychange',()=>feedback.items.filter(i=>i.node).forEach(i=>pauseFeedback(i,'hidden',document.hidden)));
for(const event of ['pointerup','pointercancel'])window.addEventListener(event,()=>feedback.items.forEach(i=>pauseFeedback(i,'hold',false)),true);
window.addEventListener('keydown',event=>{if(event.key==='Escape'&&feedbackRail.contains(event.target)){polish.input='keyboard';document.body.dataset.input='keyboard';event.preventDefault();event.stopImmediatePropagation();dismissFeedback(Number(event.target.closest('[data-feedback-id]')?.dataset.feedbackId));}},true);
window.addEventListener('resize',flushFeedback);visualViewport?.addEventListener('resize',positionFeedback);visualViewport?.addEventListener('scroll',positionFeedback);
window.addEventListener('scroll',positionFeedback,{passive:true});
function updateFeedbackMotion(){feedback.items.filter(i=>i.node&&!i.closing).forEach(item=>{item.remaining=remainingFeedback(item);item.quiet=!canMove();armFeedback(item);});}
motionPreference.addEventListener('change',updateFeedbackMotion);
new MutationObserver(updateFeedbackMotion).observe(document.body,{attributes:true,attributeFilter:['data-reduced']});
new MutationObserver(positionFeedback).observe($('#overlay'),{attributes:true,attributeFilter:['open','data-phase'],childList:true});
toast=message=>notifyAction({kind:'info',title:message,simulation:true});

// The previous category state action was unsupported. Categories retain their
// real create/edit/delete capabilities; state demos now use bank entities.
catalogRows=function(){
  const rows=actionRecords.filter(r=>normalizeChoice(r.name).includes(normalizeChoice(precision.catalogSearch)));
  return `<div class="catalog-row catalog-list-head" aria-hidden="true"><strong>Categoría</strong><span>Tipo</span><span>Origen</span><span>Relaciones</span><span>Acciones</span></div>${rows.map(r=>`<article class="catalog-row" data-catalog-row="${r.id}" aria-label="${esc(r.name)}"><div class="catalog-icon">${icon(r.type==='income'?'down':'up',16)}<div><button class="row-button" data-catalog-edit="${r.id}">${esc(r.name)}</button><small>${r.locked?'Registro protegido':'Categoría personal'}</small></div></div><span class="small catalog-type">${catalogType(r)}</span><span class="badge">${r.locked?'Sistema':'Personal'}</span><span class="record-note">${r.links?r.links+' vínculos':'Sin vínculos'}</span><div class="record-actions">${r.locked?'<span class="muted small">Protegida</span>':`<button class="btn sm" data-catalog-edit="${r.id}">Editar</button><button class="icon-btn" data-catalog-menu="${r.id}" aria-label="Acciones de ${esc(r.name)}">${icon('more',17)}</button>`}</div></article>`).join('')}${!rows.length?'<div class="empty"><h2>No hay coincidencias</h2><button class="btn" data-precision="clear-catalog">Limpiar búsqueda</button></div>':''}`;
};
categoryMenu=function(id,anchor){const r=actionRecords.find(r=>r.id===id);if(!r||r.locked)return;showPopover(anchor,'Categoría · '+r.name,menuItem('Editar',`data-catalog-edit="${id}"`,'Nombre y clasificación','file')+menuItem('Eliminar',`data-catalog-delete="${id}"`,'Revisar restricciones antes de eliminar','info'));};
categoryConfirm=function(id,remove=false){
  const r=actionRecords.find(row=>row.id===id);if(!remove||!r||r.locked)return;
  openDialog(r.links?'No se puede eliminar':'Eliminar categoría',r.name,`<section class="panel-summary"><h3>${esc(r.name)}</h3><p>${r.links?`${r.links} vínculos de muestra. No se eliminará el registro.`:'Sin vínculos en esta muestra.'}</p></section><p class="small muted">${r.links?'El servidor conserva la autoridad sobre las restricciones de eliminación. Este catálogo no admite desactivar categorías.':'La eliminación es permanente. No se ofrece un deshacer sin soporte real.'}</p>`,`<button class="btn" data-action="close">Conservar</button>${r.links?'':`<button class="btn danger" data-catalog-commit="${id}" data-mutation="delete">Eliminar categoría</button>`}`,'');
  $('.panel-actions button').focus({preventScroll:true});
};
const refreshCategoryBeforeActions=refreshCatalog;
refreshCatalog=function(...args){refreshCategoryBeforeActions(...args);if(state.page==='admin'&&ops.catalog==='categories')$('.catalog-summary').innerHTML=`<span><strong>${actionRecords.length}</strong>categorías</span><span>Clasificación de tus movimientos · Sin acciones de estado</span>`;};

const ops={catalog:'categories',context:null,entities:[{id:101,name:'Cooperativa Horizonte',active:true},{id:102,name:'Caja del Valle',active:true},{id:103,name:'Financiera Norte',active:false}],currencies:[{id:201,name:'PEN · Sol peruano',active:true,locked:true},{id:202,name:'USD · Dólar estadounidense',active:true,locked:true},{id:203,name:'EUR · Euro personalizado',active:true}],assetTypes:[{id:301,name:'Vehículo personal',active:true},{id:302,name:'Equipo profesional',active:true},{id:303,name:'Colección personal',active:false}]};
const catalogMeta={categories:['Categorías','categoría'],entities:['Entidades','entidad'],currencies:['Monedas','moneda'],assetTypes:['Tipos de activo','tipo de activo']};
function opsButton(module,id,verb,label,primary=false){return `<button class="btn ${primary?'primary':'sm'}" data-ops-module="${module}" data-ops-id="${esc(id)}" data-ops-verb="${verb}">${label}</button>`;}
function rowActions(module,id,label,verb='edit',direct='Editar'){return `<div class="record-actions">${direct?opsButton(module,id,verb,direct):''}<button class="icon-btn" data-ops-menu="${module}" data-ops-id="${esc(id)}" aria-label="Acciones de ${esc(label)}" aria-haspopup="menu">${icon('more',16)}</button></div>`;}
function feedbackLab(){return `<div class="action-lab" aria-label="Controles de revisión de feedback"><span>Prueba visual · No forma parte de producción</span>${[['success','Éxito'],['error','Error'],['warning','Advertencia'],['burst','Varias seguidas']].map(([k,l])=>`<button class="btn sm" data-feedback-demo="${k}">${l}</button>`).join('')}</div>`;}
admin=function(){
  const category=ops.catalog==='categories',meta=catalogMeta[ops.catalog],items=category?actionRecords:ops[ops.catalog];
  return `${heading('Catálogos','Referencias para organizar tus registros.',`Crear ${meta[1]}`,category?'catalog-create':'ops-catalog-create')}<div class="tabs catalog-tabs">${Object.entries(catalogMeta).map(([key,[title]])=>`<button class="tab ${ops.catalog===key?'active':''}" data-ops-catalog="${key}" aria-pressed="${ops.catalog===key}">${title}</button>`).join('')}</div>${feedbackLab()}<div class="catalog-summary"><span><strong>${items.length}</strong>${meta[0].toLowerCase()}</span><span>${category?'Clasificación de tus movimientos · Sin acciones de estado':'Activar y desactivar conserva referencias históricas'}</span></div>${category?`<div class="toolbar"><label class="search">${icon('search',16)}<input id="catalog-query" type="search" placeholder="Buscar categoría" aria-label="Buscar categoría" value="${esc(precision.catalogSearch)}"></label></div><div id="catalog-receipt"></div><div class="catalog-list" id="catalog-list">${catalogRows()}</div>`:`<div class="catalog-list ops-catalog-list"><div class="catalog-row catalog-list-head"><strong>${meta[0]}</strong><span>Estado</span><span>Acciones</span></div>${items.map(r=>`<article class="catalog-row" data-ops-row="${r.id}"><div><strong>${esc(r.name)}</strong><small>${r.locked?'Registro del sistema · Protegido':'Registro personal de prueba'}</small></div><span class="badge">${r.active?'Activo':'Inactivo'}</span>${r.locked?'<span class="muted small">Protegido</span>':rowActions(ops.catalog,r.id,r.name)}</article>`).join('')}</div>`}<p class="evidence-note">Catálogos interactivos de prueba: los cambios viven solo en memoria, se reinician al recargar y no modifican cifras financieras. No hay conexión con producción.</p>`;
};

function sourceRecord(module,id){
  if(['entities','currencies','assetTypes'].includes(module))return ops[module].find(r=>r.id===Number(id));
  if(module==='transactions'){const t=tx.find(r=>r.id===Number(id));return t?{...t,name:t.description}:null;}
  if(module==='portfolio')return {...accounts.find(r=>r.name===id),active:true};
  if(module==='budgets')return {...budgets.find(r=>r.name===id),active:true};
  if(module==='credits')return creditRecords().find(r=>r.id===id);
  if(module==='receivables'||module==='payables'){const usd=['Taller Horizonte','Editorial Sur'].includes(id);return {id,name:id,active:true,currency:usd?'USD':'PEN'};}
  return {id,name:id,active:true};
}
function capabilityMenu(module,id,anchor){
  const r=sourceRecord(module,id);if(!r)return;
  const entries=[];const add=(verb,label,description='')=>entries.push(menuItem(label,`data-ops-module="${module}" data-ops-id="${esc(id)}" data-ops-verb="${verb}"`,description));
  if(['transactions','portfolio','budgets','credits','assets','receivables','payables'].includes(module))add('detail','Ver detalle');
  if(module==='recurring')add('use','Usar plantilla','Abre un movimiento para revisar. No lo registra.');
  if(module==='alerts'){add('read','Marcar como leído');add('unread','Marcar como no leído');}
  else add('edit',module==='budgets'?'Editar este período':['receivables','payables'].includes(module)?'Editar persona':'Editar');
  if(module==='budgets'&&r.active)add('period','Nuevo período','Continúa la serie; no cambia el período anterior.');
  if(['portfolio','budgets','credits','receivables','payables','entities','currencies','assetTypes'].includes(module))add('state',r.active?'Desactivar':'Activar',module==='credits'?'Cambia ACTIVE / CLOSED. No registra un pago.':'Conserva el historial y sus vínculos.');
  if(module==='assets')add('state','Marcar como vendido','Cambia a SOLD; no registra una venta de dinero.');
  add('delete',['receivables','payables'].includes(module)?'Eliminar persona':'Eliminar','Requiere confirmación; sujeto a vínculos existentes.');
  showPopover(anchor,'Acciones · '+r.name,entries.join(''));
  $$('.popover-item',polish.popover).at(-1)?.classList.add('operation-menu-danger');
}
function opsForm(module,id,verb='edit'){
  const r=id?sourceRecord(module,id):null,meta=catalogMeta[module],name=r?.name||'';
  if(r?.locked)return;
  const noun=meta?.[1]||({portfolio:'cuenta',budgets:'presupuesto',credits:'crédito',receivables:'persona',payables:'persona',assets:'activo',recurring:'plantilla',alerts:'aviso'}[module]||'registro');
  const title=verb==='period'?'Nuevo período':verb==='obligation'?`Registrar cuenta por ${module==='receivables'?'cobrar':'pagar'}`:`${r?'Editar':'Crear'} ${noun}`;
  let fields=field('Nombre',`<input name="name" required value="${esc(name)}" maxlength="100" placeholder="Nombre del ${noun}">`,true);
  if(module==='credits')fields+=field('Notas','<textarea name="notes" placeholder="Información adicional"></textarea>',true);
  else if(module==='budgets')fields+=field('Límite · PEN',`<input name="amount" inputmode="decimal" required value="${r?.limit||''}" placeholder="0.00">`)+field('Período',`<select name="period"><option>${verb==='period'?'Octubre':'Septiembre'} 2026</option></select>`);
  else if(module==='assets')fields+=field('Valor actual registrado · PEN',`<input name="amount" inputmode="decimal" value="${!id?'':id==='Vehículo'?35000:3500}" required>`)+field('Destinatario','<input name="recipient">');
  else if(module==='recurring')fields+=field('Importe · PEN',`<input name="amount" inputmode="decimal" required value="${id==='Alquiler'?2480:120}">`)+field('Cuenta','<select name="account"><option>Cuenta principal · PEN</option><option>Reserva · PEN</option></select>');
  else if(verb==='obligation')fields+=field('Importe',`<input name="amount" required inputmode="decimal" placeholder="0.00">`)+field('Moneda','<select name="currency"><option>PEN</option><option>USD</option></select>')+field('Vencimiento','<input type="date" name="due_date">');
  else if(module==='currencies')fields+=field('Código','<input name="code" maxlength="3" required value="EUR">')+field('Símbolo','<input name="symbol" required value="€">');
  else fields+=field('Notas','<textarea name="notes" placeholder="Opcional"></textarea>',true);
  const local=!!meta,copy=local?'Este catálogo cambia solo en memoria.':'Muestra abreviada del patrón. Los datos financieros permanecen fijos; la implementación conservará todos los campos y reglas existentes.';
  openDialog(title,name||'Nuevo registro',`<section class="panel-summary"><span class="summary-eyebrow">${r?'Registro seleccionado':'Nuevo registro'}</span><h3>${esc(name||title)}</h3><p class="summary-caption">${module==='credits'?'Préstamos y líneas: nombre y notas. La tarjeta conserva su formulario específico.':module==='budgets'?'El cambio afecta al período indicado, no a toda la serie.':module==='recurring'?'Guardar una plantilla no registra ni programa un pago.':'Acción explícita sobre este registro.'}</p></section><form id="record-operation-form" class="record-operation-form"><div class="form-grid">${fields}</div><p class="ops-demo-note">${copy}</p><div class="inline-error" role="alert" id="ops-error"></div></form>`,`<button class="btn" data-action="close">Cancelar</button><button class="btn primary" form="record-operation-form">${r?'Guardar cambios':'Crear registro'}</button>`);
  ops.context={module,id,verb,record:r,local,title};
}
function confirmOperation(module,id,verb){
  const r=sourceRecord(module,id);if(!r||r.locked)return;
  const remove=verb==='delete',title=remove?'Eliminar':module==='assets'?'Marcar como vendido':r.active?'Desactivar':'Activar';
  const noun=catalogMeta[module]?.[1]||({transactions:'movimiento',portfolio:'cuenta',budgets:'período',credits:'crédito',assets:'activo',recurring:'plantilla',alerts:'aviso',receivables:'persona',payables:'persona'}[module]||'registro');
  openDialog(module==='assets'&&!remove?'Marcar activo como vendido':`${title} ${noun}`,r.name,`<section class="panel-summary"><span class="summary-eyebrow">Registro seleccionado</span><h3>${esc(r.name)}</h3>${r.amount?`<p class="num">${money(r.amount,r.currency||'PEN')}</p>`:''}</section><div class="action-message"><strong>${remove?'La eliminación es permanente':'El historial se conserva'}</strong><p>${module==='assets'&&!remove?'El estado pasará a vendido (SOLD). Esta acción no registra un ingreso ni un movimiento de venta.':remove?'Se aplicarán las restricciones existentes. No se eliminarán vínculos ni registros dependientes por cuenta propia.':'El registro cambia de disponibilidad. No liquida deudas ni borra movimientos.'}</p></div><p class="ops-demo-note">${catalogMeta[module]?'Catálogo ficticio · Cambio local al confirmar.':'Simulación visual · No se modifican cifras, registros ni relaciones financieras.'}</p>`,`<button class="btn" data-action="close">Conservar</button><button class="btn ${remove?'danger':'primary'}" data-ops-confirm="true">${title}</button>`,'');
  $('.mode-tag').innerHTML='<i></i>Confirmación';$('.panel-location span:last-child').textContent='Confirmación';
  ops.context={module,id,verb,record:r,local:!!catalogMeta[module],title};$('.panel-actions button').focus({preventScroll:true});
}
function completeOperation(title,detail,context){
  if(context.local){render();lastFocus=$(`[data-ops-row="${context.id}"] button`)||$('[data-action="ops-catalog-create"]');const row=$(`[data-ops-row="${context.id}"]`);if(row)move(row,[{opacity:.5,transform:'translateY(-4px)'},{opacity:1,transform:'none'}],180);}
  notifyAction({title,detail,simulation:!context.local,key:`${context.module}-${context.id}-${context.verb}`});dirty=false;closeDialog();
}
function operationalAction(module,id,verb){
  closePopover(false);const r=sourceRecord(module,id);
  if(verb==='edit'&&module==='transactions'){const t=tx.find(r=>r.id===Number(id));form(t.type,t);return;}
  if(verb==='detail'){
    if(module==='transactions')detail(Number(id));
    else if(module==='portfolio')accountDetail(id);
    else if(module==='budgets')budgetDetail(id);
    else if(module==='credits')creditDetail(id);
    else {openDialog(r.name,'Registro seleccionado · Muestra',`<section class="panel-summary"><h3>${esc(r.name)}</h3><p>${module==='assets'?'Bien registrado · Valor declarado por el usuario.':'Persona y obligaciones documentadas son registros diferentes.'}</p></section>`,`${opsButton(module,id,'edit',module==='assets'?'Editar activo':'Editar persona',true)}${opsButton(module,id,'menu','Más')}`);}
    return;
  }
  if(verb==='use'){form('expense');$('[name="amount"]').value=id==='Alquiler'?2480:120;$('[name="description"]').value=id;$('[name="category"]').value=id==='Alquiler'?'Vivienda':'Servicios';$('[name="category"]').dispatchEvent(new Event('change',{bubbles:true}));$('[name="amount"]').dispatchEvent(new Event('input',{bubbles:true}));dirty=false;return;}
  if(verb==='collect'||verb==='pay'){
    form(verb==='collect'?'receivable_collect':'payable_pay');
    const related=$$('select',$('#movement-form')).find(select=>!select.name);if(related){related.name='related_document';related.innerHTML=`<option value="${esc(id)}">${esc(id)} · ${r.currency} · Documento de muestra</option>`;related.dispatchEvent(new Event('change',{bubbles:true}));}
    $('[name="currency"]').value=r.currency;$('[name="currency"]').dispatchEvent(new Event('change',{bubbles:true}));dirty=false;return;
  }
  if(verb==='state'||verb==='delete'){confirmOperation(module,id,verb);return;}
  if(verb==='read'||verb==='unread'){notifyAction({title:verb==='read'?'Aviso marcado como leído':'Aviso marcado como no leído',detail:id+' · No cambia la obligación.',simulation:true});return;}
  opsForm(module,id,verb);
}

const accountDetailBeforeActions=accountDetail;
accountDetail=function(id){accountDetailBeforeActions(id);$('.panel-actions').innerHTML=opsButton('portfolio',id,'menu','Más')+opsButton('portfolio',id,'edit','Editar cuenta',true);};
const budgetDetailBeforeActions=budgetDetail;
budgetDetail=function(id){budgetDetailBeforeActions(id);$('.panel-actions').insertAdjacentHTML('afterbegin',opsButton('budgets',id,'menu','Más'));const edit=$('[data-action="budget-edit"]');if(edit){edit.removeAttribute('data-action');edit.dataset.opsModule='budgets';edit.dataset.opsId=id;edit.dataset.opsVerb='edit';}};
const creditDetailBeforeActions=creditDetail;
creditDetail=function(id,installment=false){creditDetailBeforeActions(id,installment);if(!installment){$('.panel-actions').insertAdjacentHTML('afterbegin',opsButton('credits',id,'menu','Más')+opsButton('credits',id,'edit','Editar crédito'));}};

// Add actions without changing the established financial layouts or fixtures.
function decorateOperationalRows(){
  const root=$('#main');
  const replace=(selector,module,attribute)=>$$(selector,root).forEach(button=>{if(button.dataset.opsDecorated)return;const id=button.getAttribute(attribute),r=sourceRecord(module,id);if(!r)return;const node=document.createElement('template');node.innerHTML=rowActions(module,id,r.name);button.replaceWith(node.content);});
  if(state.page==='transactions')replace('.icon-btn[data-detail]','transactions','data-detail');
  if(state.page==='portfolio')replace('.icon-btn[data-account]','portfolio','data-account');
  if(state.page==='budgets'){
    replace('.icon-btn[data-budget]','budgets','data-budget');
    $$('.budget-mobile-row',root).forEach(row=>{if(!$('.record-actions',row)){const id=$('[data-budget]',row).dataset.budget;row.insertAdjacentHTML('beforeend',rowActions('budgets',id,id));}});
  }
  if(state.page==='credits')replace('.icon-btn[data-credit-record]','credits','data-credit-record');
  if(state.page==='assets'||state.page==='recurring'||state.page==='receivables'||state.page==='payables'){
    $$('.list-line',root).forEach(row=>{
      if($('.record-actions',row))return;
      const title=$('[data-asset],[data-obligation]',row)||$('strong',row),id=title?.textContent;if(!id)return;
      if(state.page==='recurring'){$('[data-template]',row)?.remove();row.insertAdjacentHTML('beforeend',rowActions('recurring',id,id,'use','Usar plantilla'));}
      else row.insertAdjacentHTML('beforeend',rowActions(state.page,id,id,state.page==='receivables'?'collect':state.page==='payables'?'pay':'edit',state.page==='receivables'?'Registrar cobro':state.page==='payables'?'Registrar pago':'Editar'));
    });
  }
  if(state.page==='alerts')$$('.list-line',root).forEach(row=>{if(!$('.record-actions',row)){const id=$('h3',row)?.textContent||'Aviso';$('[data-action="mark-read"]',row)?.remove();row.insertAdjacentHTML('beforeend',rowActions('alerts',id,id,'read','Marcar leído'));}});
  const bulk=$('.bulk-bar',root);if(bulk&&!$('[data-ops-bulk]',bulk)){
    $('[data-action="export"]',bulk)?.remove();
    bulk.insertAdjacentHTML('beforeend','<button class="btn sm" data-ops-clear>Limpiar selección</button><button class="btn sm" data-ops-bulk="delete">Eliminar selección</button>');
  }
}
const renderBeforeActions=render;
render=function(){renderBeforeActions();
  const short=$('.head-actions .short-label');if(short&&['assets','recurring','alerts'].includes(state.page))short.textContent={assets:'Activo',recurring:'Plantilla',alerts:'Aviso'}[state.page];
  if(['receivables','payables'].includes(state.page)){
    const btn=$('.head-actions .primary');btn.removeAttribute('data-action');btn.dataset.opsModule=state.page;btn.dataset.opsVerb='obligation';btn.innerHTML=`${icon('plus',15)}Registrar cuenta por ${state.page==='receivables'?'cobrar':'pagar'}`;
    $('[data-action="counterparty"]')?.setAttribute('aria-label',state.page==='receivables'?'Crear deudor':'Crear acreedor');
  }
  if(state.page==='alerts')$('.tabs').insertAdjacentHTML('afterend',`<div class="operational-toolbar"><button class="btn" data-ops-alert="refresh">Actualizar avisos</button><button class="btn" data-ops-alert="read">Marcar todos como leídos</button><button class="btn" data-ops-alert="delete">Eliminar leídos</button></div>`);
  if(!['dashboard','transactions','budgets'].includes(state.page))$('.head-actions [data-action="period"]')?.remove();
  decorateOperationalRows();
};
new MutationObserver(decorateOperationalRows).observe($('#main'),{childList:true,subtree:true});

// Capture before earlier prototype handlers; no production requests occur.
window.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  const consume=()=>{event.preventDefault();event.stopImmediatePropagation();};
  if(button.dataset.feedbackDemo){consume();const kind=button.dataset.feedbackDemo;
    if(kind==='burst'){[['Categoría creada','Viaje de trabajo'],['Cambios guardados','Cuenta principal'],['Entidad desactivada','Cooperativa Horizonte'],['No se pudo eliminar','El registro conserva vínculos']].forEach(([title,detail],i)=>notifyAction({kind:i===3?'error':'success',title,detail,simulation:true}));}
    else notifyAction({kind,title:kind==='success'?'Cambios guardados':kind==='error'?'No se pudo guardar':'Revisa los campos marcados',detail:kind==='success'?'Cuenta principal · Nombre actualizado':kind==='error'?'El borrador permanece disponible. Nada se ha descartado.':'Indica el importe y la cuenta antes de continuar.',simulation:true});return;
  }
  if(button.dataset.opsCatalog){consume();ops.catalog=button.dataset.opsCatalog;render();return;}
  if(button.dataset.action==='ops-catalog-create'){consume();opsForm(ops.catalog,null,'create');return;}
  if(button.dataset.opsMenu){consume();capabilityMenu(button.dataset.opsMenu,button.dataset.opsId,button);return;}
  if(button.dataset.opsVerb){consume();if(button.dataset.opsVerb==='menu')capabilityMenu(button.dataset.opsModule,button.dataset.opsId,button);else operationalAction(button.dataset.opsModule,button.dataset.opsId,button.dataset.opsVerb);return;}
  if(button.dataset.opsConfirm){consume();const context=ops.context;const completedTitle=context.verb==='delete'?'Registro eliminado':context.module==='assets'?'Activo marcado como vendido':context.record.active?'Registro desactivado':'Registro activado';runAction(button,()=>{
    if(context.local){const rows=ops[context.module];if(context.verb==='delete')rows.splice(rows.indexOf(context.record),1);else context.record.active=!context.record.active;}
  },{title:'Operación confirmada',after:()=>completeOperation(completedTitle,context.record.name,context)});return;}
  if(button.hasAttribute('data-ops-clear')){consume();state.selected.clear();render();$('[data-action="select-all"]')?.focus();return;}
  if(button.dataset.opsBulk){consume();const count=state.selected.size;openDialog(`Eliminar ${count} movimientos`,'Confirma la selección, no todo el registro.',`<p class="small">${count} movimientos seleccionados. Se aplican las validaciones individuales; los fallidos permanecen seleccionados.</p><p class="ops-demo-note">Simulación sin eliminar datos financieros.</p>`,`<button class="btn" data-action="close">Conservar</button><button class="btn danger" data-action="simulate">Confirmar eliminación</button>`,'');$('.panel-actions button').focus();return;}
  if(button.dataset.opsAlert){consume();if(button.dataset.opsAlert==='delete'){confirmOperation('alerts','Avisos leídos','delete');}else notifyAction({title:button.dataset.opsAlert==='read'?'Avisos marcados como leídos':'Avisos actualizados',detail:'La situación financiera de origen se conserva.',simulation:true});return;}
  if(button.dataset.catalogState){consume();notifyAction({kind:'warning',title:'Acción no disponible',detail:'Las categorías no admiten cambios de estado.'});return;}
  if(button.dataset.action==='template-create'){consume();opsForm('recurring',null,'create');return;}
  if(button.dataset.action==='asset-create'){consume();opsForm('assets',null,'create');return;}
  if(button.dataset.action==='counterparty'){consume();opsForm(state.page,null,'create');return;}
},true);
window.addEventListener('submit',event=>{
  if(event.target.id!=='record-operation-form')return;event.preventDefault();event.stopImmediatePropagation();
  const data=new FormData(event.target),context=ops.context,button=$('[form="record-operation-form"]');
  const name=String(data.get('name')||'').trim();if(!name){$('#ops-error').textContent='Escribe un nombre.';$('[name="name"]').focus();return;}
  if(context.local&&ops[context.module].some(r=>r!==context.record&&normalizeChoice(r.name)===normalizeChoice(name))){$('#ops-error').textContent='Ya existe un registro con ese nombre.';$('[name="name"]').focus();return;}
  runAction(button,()=>{if(context.local){if(context.record)context.record.name=name;else {context.id=Date.now();ops[context.module].unshift({id:context.id,name,active:true});}}},{title:context.record?'Cambios guardados':'Registro creado',after:()=>completeOperation(context.record?'Cambios guardados':'Registro creado',name,context)});
},true);
document.addEventListener('input',event=>{if(event.target.closest('#record-operation-form'))dirty=true;});
document.addEventListener('change',event=>{if(event.target.matches('[data-action="select-all"]')){const selected=event.target.checked;filteredTx().forEach(row=>selected?state.selected.add(row.id):state.selected.delete(row.id));$('#transaction-rows').innerHTML=transactionRows();decorateOperationalRows();}});
document.addEventListener('invalid',event=>{if(event.target.closest('#overlay'))notifyAction({kind:'warning',title:'Completa el campo indicado',detail:event.target.closest('.field')?.querySelector('span')?.textContent||'Revisa el formulario.',key:'form-validation'});},true);
Object.assign(window.FinTrackReview,{notifyAction,dismissFeedback,feedbackClear(){feedback.items.slice().forEach(i=>{stopFeedbackClock(i);i.node?.remove();});feedback.items=[];positionFeedback();},actions(module,id,verb){operationalAction(module,id,verb);},catalog(key){ops.catalog=key;state.page='admin';render();}});
render();
