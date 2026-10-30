/* Round 05. Selection and mutations are isolated UI demonstrations, never financial services. */
'use strict';
const precision={picker:null,select:null,trigger:null,query:'',active:-1,options:[],sequence:0,busy:false,outcome:'ok',receipt:null,catalogFilter:'all',catalogSearch:'',retry:null};
const normalizeChoice=text=>String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const selectionStatus=document.createElement('div');selectionStatus.className='sr-only';selectionStatus.setAttribute('role','status');document.body.append(selectionStatus);
function optionDescription(option,select){
  if(option.dataset.hint)return option.dataset.hint;
  if(['PEN','USD','EUR'].includes(option.value))return {PEN:'Sol peruano · S/',USD:'Dólar estadounidense · US$',EUR:'Euro · EUR'}[option.value];
  if(select.name==='account'||select.name==='destination')return option.text.includes('USD')?'Moneda: USD · Cuenta activa':'Moneda: PEN · Cuenta activa';
  return '';
}
function enhanceSelections(root=document){
  $$('select:not([data-enhanced])',root).filter(s=>s.closest('#main,#overlay')).forEach(select=>{
    select.dataset.enhanced='true';const wrapper=document.createElement('span');wrapper.className='ft-select';
    const label=select.getAttribute('aria-label')||select.closest('.field')?.querySelector(':scope>span')?.textContent||'Seleccionar';
    const trigger=document.createElement('button');trigger.type='button';trigger.className='ft-select-trigger';trigger.setAttribute('aria-label',label);trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-expanded','false');
    const update=()=>{trigger.innerHTML=`<span>${esc(select.selectedOptions[0]?.textContent||'Seleccionar')}</span>${icon('chevrondown',14)}`;trigger.disabled=select.disabled;};
    select.before(wrapper);wrapper.append(select,trigger);select.tabIndex=-1;select.setAttribute('aria-hidden','true');update();
    trigger.addEventListener('click',()=>precision.trigger===trigger?closeChoice():openChoice(select,trigger,label));
    trigger.addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();openChoice(select,trigger,label);}});
    select.addEventListener('change',update);
  });
}
function closeChoice(restore=true,animate=true){
  const pop=precision.picker,trigger=precision.trigger;if(!pop)return;
  precision.picker=null;precision.select=null;precision.trigger=null;trigger?.setAttribute('aria-expanded','false');trigger?.removeAttribute('aria-controls');
  if(restore&&trigger?.isConnected)trigger.focus({preventScroll:true});
  pop.inert=true;const effect=animate?move(pop,[{opacity:1,transform:'none'},{opacity:0,transform:'translateY(-3px) scale(.985)'}],110):null;
  const remove=()=>{if(pop.matches(':popover-open'))pop.hidePopover();pop.remove();};if(effect)effect.finished.then(remove,remove);else remove();
}
function choiceLayout(){
  const pop=precision.picker;if(!pop)return;const viewport=visualViewport;const left=viewport?.offsetLeft||0,top=viewport?.offsetTop||0,w=viewport?.width||innerWidth,h=viewport?.height||innerHeight;
  const anchor=precision.trigger.getBoundingClientRect(),mobile=innerWidth<768;
  pop.style.width=`${mobile?w-16:Math.min(Math.max(anchor.width,320),400,w-24)}px`;
  $('.picker-options',pop).style.maxHeight=`${Math.max(64,Math.min(mobile?280:240,h-174))}px`;
  const height=pop.getBoundingClientRect().height,below=anchor.bottom+8+height<=top+h-12;
  pop.style.left=`${mobile?left+8:Math.max(left+12,Math.min(anchor.left,left+w-pop.offsetWidth-12))}px`;
  pop.style.top=`${mobile?Math.max(top+8,top+h-height-8):Math.max(top+8,Math.min(below?anchor.bottom+8:anchor.top-height-8,top+h-height-8))}px`;
  pop.style.transformOrigin=`${Math.max(12,Math.min(pop.offsetWidth-12,anchor.left+anchor.width/2-parseFloat(pop.style.left)))}px ${below?'top':'bottom'}`;
}
function filteredChoices(){return precision.options.filter(option=>normalizeChoice(option.label+' '+option.hint).includes(normalizeChoice(precision.query)));}
function paintChoices(){
  const pop=precision.picker;if(!pop)return;const list=$('.picker-options',pop);let options=filteredChoices();
  const status=precision.select.dataset.choiceState||'ready';
  if(status==='empty')options=[];
  if(status==='loading'){list.innerHTML='<div class="picker-loading" role="status"><span class="sr-only">Cargando opciones</span><i></i><i></i><i></i></div>';$('#choice-search').removeAttribute('aria-activedescendant');return;}
  if(status==='error'){list.innerHTML='<div class="picker-empty" role="alert"><strong>No pudimos cargar las opciones</strong>Tu selección anterior se conserva.<br><button type="button" class="btn sm" id="choice-retry">Reintentar carga</button></div>';$('#choice-search').removeAttribute('aria-activedescendant');$('#choice-retry').onclick=()=>{precision.select.dataset.choiceState='ready';paintChoices();$('#choice-search').focus();};return;}
  precision.active=Math.max(-1,Math.min(precision.active,options.length-1));
  if(precision.active<0)precision.active=options.findIndex(option=>!option.disabled);
  list.innerHTML=options.length?options.map((option,index)=>`<button type="button" tabindex="-1" class="picker-option" role="option" id="choice-${index}" aria-selected="${option.value===precision.select.value}" aria-disabled="${option.disabled}" data-active="${index===precision.active}"><span>${esc(option.label)}${option.hint?`<small>${esc(option.hint)}</small>`:''}</span>${icon('check',16)}</button>`).join(''):`<div class="picker-empty"><strong>${precision.query?'Sin coincidencias':'No hay opciones disponibles'}</strong>${precision.query?'Prueba otro nombre, moneda o entidad. No se creará un registro automáticamente.':'No se asigna un valor por defecto.'}${precision.query?'<br><button type="button" class="btn sm" id="clear-choice">Limpiar búsqueda</button>':''}</div>`;
  $$('.picker-option',pop).forEach((button,index)=>{button.addEventListener('pointermove',()=>{precision.active=index;highlightChoice();});button.addEventListener('click',()=>commitChoice(options[index]));});
  if($('#clear-choice'))$('#clear-choice').onclick=()=>{$('#choice-search').value='';precision.query='';precision.active=-1;paintChoices();$('#choice-search').focus();};
  $('.picker-count',pop).textContent=`${options.length} ${options.length===1?'opción':'opciones'}`;highlightChoice();choiceLayout();
}
function highlightChoice(){const pop=precision.picker;if(!pop)return;const nodes=$$('.picker-option',pop);nodes.forEach((node,index)=>node.dataset.active=String(index===precision.active));const active=nodes[precision.active],search=$('#choice-search');if(active){search.setAttribute('aria-activedescendant',active.id);active.scrollIntoView({block:'nearest'});}else search.removeAttribute('aria-activedescendant');}
function commitChoice(option){
  if(!option||option.disabled)return;const select=precision.select,trigger=precision.trigger,changed=select.value!==option.value;select.value=option.value;if(changed)select.dispatchEvent(new Event('change',{bubbles:true}));
  if(changed&&select.closest('#movement-form,#account-form,#demo-form,#category-action-form'))dirty=true;
  selectionStatus.textContent=`Seleccionado: ${option.label}`;closeChoice();
  move(trigger?.querySelector('span'),[{opacity:.5,transform:'translateY(2px)'},{opacity:1,transform:'none'}],120);
}
function openChoice(select,trigger,label){
  closeChoice(false,false);$$('.ft-picker').forEach(node=>{stopMotion(node);node.remove();});closePopover(false);precision.select=select;precision.trigger=trigger;precision.query='';
  precision.options=[...select.options].map(o=>({value:o.value,label:o.textContent,hint:optionDescription(o,select),disabled:o.disabled}));
  precision.active=precision.options.findIndex(o=>o.value===select.value&&!o.disabled);
  const pop=document.createElement('div');pop.className='ft-picker';pop.id='choice-panel';pop.setAttribute('popover','manual');pop.setAttribute('role','dialog');pop.setAttribute('aria-labelledby','choice-title');
  pop.innerHTML=`<div class="picker-head"><span id="choice-title">${esc(label)}</span><small>Buscar y seleccionar</small></div><div class="picker-search">${icon('search',16)}<input id="choice-search" type="text" role="combobox" aria-label="Buscar ${esc(label.toLowerCase())}" aria-expanded="true" aria-controls="choice-options" aria-autocomplete="list" autocomplete="off" placeholder="Escribe para buscar…"></div><div id="choice-options" class="picker-options" role="listbox" aria-label="${esc(label)}"></div><div class="picker-foot"><span class="picker-count" role="status"></span><span class="keyboard-hint">↑ ↓ Explorar · ↵ Elegir · Esc Volver</span></div>`;
  ($('#overlay').open?$('#overlay'):document.body).append(pop);precision.picker=pop;trigger.setAttribute('aria-expanded','true');trigger.setAttribute('aria-controls',pop.id);pop.showPopover();paintChoices();choiceLayout();
  $('#choice-search').addEventListener('input',event=>{precision.query=event.target.value;precision.active=-1;paintChoices();});$('#choice-search').focus({preventScroll:true});
  move(pop,[{opacity:.65,transform:'translateY(4px) scale(.985)'},{opacity:1,transform:'none'}],160,'dock');
}
// Capture above the dialog trap: Escape dismisses only the active selection layer.
window.addEventListener('keydown',event=>{
  if(!precision.picker)return;
  polish.input='keyboard';document.body.dataset.input='keyboard';
  if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();closeChoice(true,false);return;}
  if(event.key==='Tab'){closeChoice(true,false);return;}
  const options=filteredChoices();if(event.target.id!=='choice-search'||event.isComposing)return;
  if(['ArrowDown','ArrowUp'].includes(event.key)||(!precision.query&&['Home','End'].includes(event.key))){event.preventDefault();event.stopImmediatePropagation();let index=event.key==='Home'?-1:event.key==='End'?options.length:precision.active;const step=event.key==='ArrowUp'||event.key==='End'?-1:1;for(let i=0;i<options.length;i++){index=(index+step+options.length)%options.length;if(!options[index].disabled){precision.active=index;break;}}highlightChoice();}
  if(event.key==='Enter'){event.preventDefault();event.stopImmediatePropagation();if((precision.select.dataset.choiceState||'ready')==='ready')commitChoice(options[precision.active]);}
},true);
document.addEventListener('pointerdown',event=>{if(precision.picker&&!precision.picker.contains(event.target)&&!precision.trigger?.contains(event.target))closeChoice(false);},true);
window.addEventListener('resize',choiceLayout);visualViewport?.addEventListener('resize',choiceLayout);visualViewport?.addEventListener('scroll',choiceLayout);
document.addEventListener('scroll',event=>{if(precision.picker&&!precision.picker.contains(event.target))closeChoice(false,false);},true);
const openBeforePrecision=openDialog;openDialog=function(...args){closeChoice(false,false);precision.sequence++;precision.busy=false;openBeforePrecision(...args);enhanceSelections($('#overlay'));};
const closeBeforePrecision=closeDialog;closeDialog=function(){if(precision.busy){selectionStatus.textContent='La operación está en curso. Espera su resultado.';return;}closeChoice(false,false);closeBeforePrecision();};
const formBeforePrecision=form;
form=function(type='expense',edit=null){formBeforePrecision(type,edit);const category=$('select[name="category"]');if(category){const selected=category.value;['Compras','Salud','Educación','Entretenimiento','Viajes','Suscripciones','Mascotas','Regalos','Donaciones','Comisiones','Seguros','Otros gastos','Sueldo','Alquileres'].forEach(name=>{if(![...category.options].some(o=>o.value===name))category.add(new Option(name,name));});category.value=selected;category.dispatchEvent(new Event('change'));}precision.formContext={type,edit};};

// A local category register exercises true in-memory changes without changing fixed financial snapshots.
const actionRecords=[
  {id:1,name:'Viajes personales',type:'expense',active:true,links:0},
  {id:2,name:'Suscripciones',type:'expense',active:true,links:0},
  {id:3,name:'Educación continua',type:'expense',active:true,links:6},
  {id:4,name:'Proyectos independientes',type:'income',active:true,links:3},
  {id:5,name:'Donaciones',type:'expense',active:false,links:0},
  {id:6,name:'Ajustes del sistema',type:'income',active:true,links:0,locked:true},
];
const catalogType=record=>record.type==='income'?'Ingreso':'Egreso';
function actionReceipt(){const receipt=precision.receipt;return receipt?`<div class="context-receipt" role="status">${icon('check',16)}<div><strong>${esc(receipt.title)}</strong><p>${esc(receipt.copy)}</p></div>${receipt.id?`<button class="btn sm" data-catalog-edit="${receipt.id}">Revisar</button>`:''}<button class="icon-btn" data-precision="dismiss-receipt" aria-label="Cerrar confirmación">${icon('close',14)}</button></div>`:'';}
function catalogRows(){
  const rows=actionRecords.filter(r=>(precision.catalogFilter==='all'||r.active===(precision.catalogFilter==='active'))&&normalizeChoice(r.name).includes(normalizeChoice(precision.catalogSearch)));
  return `<div class="catalog-row catalog-list-head" aria-hidden="true"><strong>Categoría</strong><span>Tipo</span><span>Estado</span><span>Relaciones</span><span></span></div>${rows.map(r=>`<article class="catalog-row" data-catalog-row="${r.id}" data-inactive="${!r.active}" aria-label="${esc(r.name)}"><div class="catalog-icon">${icon(r.type==='income'?'down':'up',16)}<div><button class="row-button" data-catalog-edit="${r.id}">${esc(r.name)}</button><small>${r.locked?'Registro protegido':'Categoría personal'}</small></div></div><span class="small catalog-type">${catalogType(r)}</span><span class="badge">${r.active?'Activa':'Inactiva'}</span><span class="record-note">${r.links?r.links+' vínculos':'Sin vínculos'}</span><button class="icon-btn" data-catalog-menu="${r.id}" aria-label="Acciones de ${esc(r.name)}">${icon('more',17)}</button></article>`).join('')}${!rows.length?'<div class="empty"><h2>No hay coincidencias</h2><p>Cambia la búsqueda o el estado.</p><button class="btn" data-precision="clear-catalog">Limpiar filtros</button></div>':''}`;
}
admin=function(){return `${heading('Catálogos','Referencias claras para organizar tus registros.','Crear categoría','catalog-create')}<div class="tabs"><button class="tab active" aria-current="page">Categorías</button><button class="tab" data-catalog="Entidades">Entidades</button><button class="tab" data-catalog="Monedas">Monedas</button><button class="tab" data-catalog="Tipos de activo">Tipos de activo</button></div><div class="catalog-summary"><span><strong>${actionRecords.length}</strong>categorías</span><span><strong>${actionRecords.filter(r=>r.active).length}</strong>activas</span><span>Desactivar conserva los vínculos existentes</span></div><div class="toolbar catalog-toolbar"><label class="search">${icon('search',16)}<input id="catalog-query" type="search" placeholder="Buscar categoría" aria-label="Buscar categoría" value="${esc(precision.catalogSearch)}"></label><select id="catalog-status" aria-label="Estado de categorías">${[['all','Todos los estados'],['active','Activas'],['inactive','Inactivas']].map(([v,n])=>`<option value="${v}" ${v===precision.catalogFilter?'selected':''}>${n}</option>`).join('')}</select></div><div id="catalog-receipt">${actionReceipt()}</div><div class="catalog-list" id="catalog-list">${catalogRows()}</div><p class="evidence-note">Ensayo interactivo independiente. Puedes crear, editar, desactivar y eliminar estas categorías ficticias. Se reinician al recargar y no alteran los resúmenes financieros de la preview.</p>`;};
function refreshCatalog(id=null,verb='updated',previous=[]){
  if(state.page!=='admin')return;$('#catalog-list').innerHTML=catalogRows();$('#catalog-receipt').innerHTML=actionReceipt();
  $('.catalog-summary').innerHTML=`<span><strong>${actionRecords.length}</strong>categorías</span><span><strong>${actionRecords.filter(r=>r.active).length}</strong>activas</span><span>Desactivar conserva los vínculos existentes</span>`;
  previous.forEach(({id:rowId,y})=>{const row=$(`[data-catalog-row="${rowId}"]`);if(row){const dy=y-row.getBoundingClientRect().top;if(dy)move(row,[{transform:`translateY(${dy}px)`},{transform:'none'}],220,'dock');}});
  const row=$(`[data-catalog-row="${id}"]`);if(row){row.classList.add('record-changed');if(verb==='created')move(row,[{opacity:.4,transform:'translateY(-6px)'},{opacity:1,transform:'none'}],220);if(canMove()){const fade=row.animate([{opacity:.5},{opacity:0}],{pseudoElement:'::after',duration:240,delay:1400,easing:polish.curves.out,fill:'forwards'});fade.finished.then(()=>{row.classList.remove('record-changed');fade.cancel();},()=>{});}else setTimeout(()=>row.classList.remove('record-changed'),1800);}
  move($('.context-receipt'),[{opacity:.55,transform:'translateY(4px)'},{opacity:1,transform:'none'}],160);
}
function categoryForm(id=null){
  const record=actionRecords.find(r=>r.id===id);if(record?.locked){info('Categoría del sistema','Este registro está protegido. No se puede editar, desactivar ni eliminar desde el catálogo.');return;}
  openDialog(record?'Editar categoría':'Crear categoría','Una referencia para clasificar, no un movimiento de dinero.',`<section class="panel-summary"><span class="summary-eyebrow">${record?'Registro existente':'Nueva referencia'}</span><h3>${record?esc(record.name):'Organiza tu próximo registro'}</h3><p class="summary-caption">${record?.links?`${record.links} vínculos existentes se conservarán.`:'La categoría no modifica saldos ni crea movimientos.'}</p></section><form id="category-action-form" data-record="${id||''}"><div class="form-grid">${field('Nombre',`<input name="category_name" required maxlength="70" autocomplete="off" placeholder="Ej. Formación profesional" value="${esc(record?.name||'')}">`,true)}${field('Tipo',`<select name="category_type" ${record?.links?'disabled':''}><option value="expense" ${record?.type==='expense'?'selected':''}>Egreso</option><option value="income" ${record?.type==='income'?'selected':''}>Ingreso</option></select><small>${record?.links?'El tipo permanece bloqueado porque existen vínculos.':'Define dónde estará disponible la categoría.'}</small>`,true)}</div><div class="action-message"><strong>${record?'Conservar el contexto':'Lista para usar'}</strong><p>${record?'El nombre se actualiza en este catálogo de prueba. Los vínculos no se eliminan.':'Se añadirá al principio del catálogo de esta sesión.'}</p></div><div class="inline-error" id="category-error" role="alert"></div></form>`,`<button class="btn" data-action="close">Cancelar</button><button class="btn primary" form="category-action-form">${record?'Guardar cambios':'Crear categoría'}</button>`);
}
function categoryMenu(id,anchor){const r=actionRecords.find(r=>r.id===id);if(!r)return;showPopover(anchor,'Acciones de la categoría',r.locked?'<div class="popover-copy">Categoría del sistema. No admite cambios.</div>':menuItem('Editar',`data-catalog-edit="${id}"`,'Nombre y clasificación','file')+menuItem(r.active?'Desactivar':'Activar',`data-catalog-state="${id}"`,'Conserva los registros vinculados','repeat')+menuItem('Eliminar',`data-catalog-delete="${id}"`,r.links?'Requiere revisar vínculos':'Eliminación permanente','info'),!r.locked);}
function categoryConfirm(id,remove=false){
  const record=actionRecords.find(r=>r.id===id);if(!record||record.locked)return;const verb=remove?'Eliminar':record.active?'Desactivar':'Activar',blocked=remove&&record.links>0;
  openDialog(blocked?'No se puede eliminar':`${verb} categoría`,record.name,`<section class="panel-summary"><div class="summary-eyebrow"><span>${catalogType(record)}</span><span class="badge">${record.active?'Activa':'Inactiva'}</span></div><h3>${esc(record.name)}</h3><p class="summary-caption">${record.links?`${record.links} registros vinculados`:'Sin registros vinculados'}</p></section><div class="action-message"><strong>${blocked?'Tus registros se conservan':remove?'Esta acción no se puede deshacer':record.active?'Dejará de ofrecerse en nuevos registros':'Volverá a estar disponible'}</strong><p>${blocked?'Desactiva la categoría si ya no quieres usarla. Eliminar no puede romper relaciones existentes.':remove?'Solo se eliminará esta categoría ficticia, no otros registros.':record.active?'Seguirás viendo la categoría en sus registros históricos.':'El historial y sus relaciones no cambian.'}</p></div>`,`<button class="btn" data-action="close">${blocked?'Volver':'Conservar'}</button>${blocked?`<button class="btn" data-catalog-state="${id}">Desactivar en su lugar</button>`:`<button class="btn ${remove?'danger':'primary'}" data-catalog-commit="${id}" data-mutation="${remove?'delete':'state'}">${verb} categoría</button>`}`,'');
}
function writeStatus(stateName,copy){const status=$('.panel-save-state');if(status){status.setAttribute('role','status');status.innerHTML=`${stateName==='busy'?'<i class="busy-dot" aria-hidden="true"></i>':icon(stateName==='ok'?'check':'info',13)} ${esc(copy)}`;}}
async function runAction(button,commit,{title='Cambios guardados',copy='Confirmado en esta sesión',after=null}={}){
  if(precision.busy)return;precision.busy=true;const seq=++precision.sequence,epoch=polish.epoch,dialog=$('#overlay');
  const label=button.innerHTML,controls=$$('button,input,select,textarea',dialog).filter(n=>!n.disabled);button.style.minWidth=`${button.getBoundingClientRect().width}px`;controls.forEach(n=>n.disabled=true);button.setAttribute('aria-busy','true');button.innerHTML='<i class="busy-dot" aria-hidden="true"></i>Procesando…';dialog.setAttribute('aria-busy','true');writeStatus('busy','Confirmando la operación…');$('#action-error')?.remove();
  // A fixed fake transport delay belongs to the review only. Production must await its real response.
  await new Promise(resolve=>setTimeout(resolve,520));
  if(seq!==precision.sequence||epoch!==polish.epoch||!dialog.open){precision.busy=false;return;}
  precision.busy=false;dialog.removeAttribute('aria-busy');button.removeAttribute('aria-busy');controls.forEach(n=>n.disabled=false);button.innerHTML=label;button.style.minWidth='';
  if(precision.outcome!=='ok'){
    const unknown=precision.outcome==='unknown';writeStatus('error',unknown?'Resultado sin confirmar':'No se guardaron los cambios');
    const content=`<div id="action-error" class="action-message" data-state="${unknown?'unknown':'error'}" role="alert" tabindex="-1"><strong>${unknown?'No pudimos confirmar el resultado':'No se pudieron guardar los cambios'}</strong><p>${unknown?'No repitas la operación. Conservamos el formulario mientras revisas el resultado.':'Tu información sigue aquí. Corrige el problema o vuelve a intentarlo cuando estés listo.'}</p>${unknown?'<button type="button" class="btn" data-precision="reconcile">Comprobar resultado</button>':''}</div>`;
    $('.dialog-body').insertAdjacentHTML('beforeend',content);$('#action-error').focus({preventScroll:true});$('#action-error').scrollIntoView({block:'nearest'});
    if(unknown){button.disabled=true;precision.retry={button,commit,title,copy,after};}return;
  }
  commit();dirty=false;writeStatus('ok',title);button.innerHTML=`<span class="saved-tick">${icon('check',15)}</span>Confirmado`;button.disabled=true;move($('.saved-tick'),[{opacity:.4,transform:'translateY(3px) scale(.9)'},{opacity:1,transform:'none'}],140);
  if(after){after();return;}
  precision.receipt={title,copy};
}
function closeAfterCatalog(id,verb,oldRows){
  refreshCatalog(id,verb,oldRows);const next=id?$(`[data-catalog-row="${id}"] .row-button`):$('.catalog-row:not(.catalog-list-head) .row-button');lastFocus=next||$('[data-action="catalog-create"]');closeDialog();
}
function showFormReceipt(data,title){
  const body=$('.dialog-body'),amount=data.get('amount'),name=data.get('description')||data.get('name')||title;
  body.innerHTML=`<section class="action-result" role="status"><div class="action-result-heading"><i>${icon('check',22)}</i><div><h3>Guardado simulado</h3><p>${esc(name)}</p></div></div><dl class="record-facts">${amount?`<div><dt>Importe introducido</dt><dd class="num">${money(Number(String(amount).replace(/,/g,'')),data.get('currency')||'PEN')}</dd></div>`:''}${data.get('account')?`<div><dt>Cuenta</dt><dd>${esc(data.get('account'))}</dd></div>`:''}<div class="full"><dt>Alcance de esta prueba</dt><dd>No se enviaron datos. Saldos y movimientos de referencia permanecen fijos.</dd></div></dl><p class="evidence-note">Para ver inserciones, cambios de estado y eliminación de filas, abre «Probar acciones» en la barra de revisión o Catálogos.</p></section>`;
  $('.panel-actions').innerHTML='<button class="btn primary" data-action="close">Volver al trabajo</button>';$('#overlay-title').textContent=title;writeStatus('ok','Interacción completada · Sin escritura financiera');move($('.action-result-heading'),[{opacity:.4,transform:'translateY(5px)'},{opacity:1,transform:'none'}],180);$('.panel-actions button').focus({preventScroll:true});
}
document.addEventListener('submit',event=>{
  const form=event.target;if(!['category-action-form','movement-form','account-form','demo-form'].includes(form.id))return;event.preventDefault();event.stopImmediatePropagation();if(precision.busy)return;
  const button=$(`[form="${form.id}"]`),data=new FormData(form);
  if(form.id==='category-action-form'){
    const name=String(data.get('category_name')).trim(),record=actionRecords.find(r=>r.id===Number(form.dataset.record));
    if(!name||actionRecords.some(r=>r.id!==record?.id&&normalizeChoice(r.name)===normalizeChoice(name))){$('#category-error').textContent=name?'Ya existe una categoría con ese nombre.':'Escribe un nombre.';$('[name="category_name"]').focus();return;}
    let id=record?.id;const oldRows=$$('[data-catalog-row]').map(n=>({id:n.dataset.catalogRow,y:n.getBoundingClientRect().top}));
    runAction(button,()=>{if(record){record.name=name;if(!record.links)record.type=data.get('category_type');}else{id=Math.max(0,...actionRecords.map(r=>r.id))+1;actionRecords.unshift({id,name,type:data.get('category_type'),active:true,links:0});}precision.receipt={id,title:record?'Categoría actualizada':'Categoría creada',copy:`${name} · ${record?'Los vínculos se conservan.':'Disponible en este catálogo de prueba.'}`};},{title:record?'Cambios guardados':'Categoría creada',after:()=>closeAfterCatalog(id,record?'updated':'created',oldRows)});return;
  }
  if(form.id==='movement-form'){
    const amount=String(data.get('amount')).replace(/,/g,'');if(!/^\d+(\.\d{1,2})?$/.test(amount)||Number(amount)<=0||Number(amount)>100000000){$('#form-error').textContent='Introduce un importe mayor que cero y de hasta 2 decimales.';$('[name="amount"]').focus();return;}
    if(data.get('currency')==='USD'&&!(Number(data.get('fx'))>0)){$('#form-error').textContent='Introduce un tipo de cambio válido mayor que cero.';$('[name="fx"]').focus();return;}
  }
  const title=$('#overlay-title').textContent.includes('Editar')?'Cambios confirmados en la muestra':'Registro confirmado en la muestra';runAction(button,()=>{},{title,after:()=>showFormReceipt(data,title)});
},true);
document.addEventListener('click',event=>{
  const target=event.target.closest('button');if(!target)return;const consume=()=>{event.preventDefault();event.stopImmediatePropagation();};
  if(target.dataset.action==='catalog-create'){consume();categoryForm();return;}
  if(target.dataset.catalogEdit){consume();categoryForm(Number(target.dataset.catalogEdit));return;}
  if(target.dataset.catalogMenu){consume();categoryMenu(Number(target.dataset.catalogMenu),target);return;}
  if(target.dataset.catalogState||target.dataset.catalogDelete){consume();categoryConfirm(Number(target.dataset.catalogState||target.dataset.catalogDelete),!!target.dataset.catalogDelete);return;}
  if(target.dataset.catalogCommit){
    consume();const record=actionRecords.find(r=>r.id===Number(target.dataset.catalogCommit));if(!record||record.locked)return;const remove=target.dataset.mutation==='delete';if(remove&&record.links)return;
    const oldRows=$$('[data-catalog-row]').map(n=>({id:n.dataset.catalogRow,y:n.getBoundingClientRect().top})),row=$(`[data-catalog-row="${record.id}"]`);
    runAction(target,()=>{if(remove)actionRecords.splice(actionRecords.indexOf(record),1);else record.active=!record.active;precision.receipt={id:remove?null:record.id,title:remove?'Categoría eliminada':record.active?'Categoría activada':'Categoría desactivada',copy:remove?`${record.name} · No se modificaron otros registros.`:`${record.name} · Su historial se conserva.`};},{title:remove?'Eliminación confirmada':'Estado actualizado',after:()=>{
      if(remove&&row){const motion=move(row,[{opacity:1,transform:'none'},{opacity:0,transform:'translateX(12px)'}],160);const done=()=>closeAfterCatalog(null,'deleted',oldRows);if(motion)motion.finished.then(done,done);else done();}else closeAfterCatalog(record.id,'updated',oldRows);
    }});return;
  }
  if(target.dataset.precision==='dismiss-receipt'){consume();precision.receipt=null;refreshCatalog();$('#catalog-query')?.focus();return;}
  if(target.dataset.precision==='clear-catalog'){consume();precision.catalogFilter='all';precision.catalogSearch='';render();$('#catalog-query').focus();return;}
  if(target.dataset.precision==='reconcile'){consume();const pending=precision.retry;precision.retry=null;$('#action-error').innerHTML='<strong>Comprobación local completada</strong><p>La operación de prueba no se ejecutó. El formulario se conserva; ahora puedes volver a enviarlo.</p>';$('#action-error').dataset.state='ready';if(pending){pending.button.disabled=false;pending.button.focus();}writeStatus('ok','Sin escritura en esta simulación');return;}
  if(target.dataset.action==='simulate'){consume();runAction(target,()=>{},{title:'Acción confirmada en la muestra',after:()=>showFormReceipt(new FormData(),'Acción confirmada en la muestra')});}
},true);
document.addEventListener('input',event=>{if(event.target.closest('#category-action-form'))dirty=true;if(event.target.id==='catalog-query'){precision.catalogSearch=event.target.value;$('#catalog-list').innerHTML=catalogRows();}});
document.addEventListener('change',event=>{if(event.target.id==='catalog-status'){precision.catalogFilter=event.target.value;refreshCatalog();}if(event.target.id==='action-outcome')precision.outcome=event.target.value;});
const renderBeforePrecision=render;render=function(){closeChoice(false,false);if(precision.lastPage==='admin'&&state.page!=='admin'){precision.receipt=null;precision.outcome='ok';$('#action-outcome').value='ok';}renderBeforePrecision();if(state.page==='admin'){$('.head-actions [data-action="period"]')?.remove();const label=$('.context-create .short-label');if(label)label.textContent='Categoría';}enhanceSelections();precision.lastPage=state.page;};
// Observe only newly mounted controls in this isolated HTML, not a production integration strategy.
new MutationObserver(()=>enhanceSelections()).observe($('#overlay'),{childList:true,subtree:true});
$('.review-controls').insertAdjacentHTML('afterbegin','<label class="action-review">Respuesta de prueba<select id="action-outcome" aria-label="Respuesta de prueba"><option value="ok">Confirmada</option><option value="error">Error</option><option value="unknown">Sin confirmar</option></select></label>');
Object.assign(window.FinTrackReview,{form,categoryForm,openChoice,closeChoice,setChoiceState(value){const select=precision.select;if(select){select.dataset.choiceState=value;paintChoices();}},setOutcome(value){precision.outcome=value;$('#action-outcome').value=value;},creditFixture(size){evolution.creditSample=size;evolution.creditPage=1;render();}});
render();move(quick,[{opacity:0,transform:'translateY(8px) scale(.96)'},{opacity:1,transform:'none'}],200,'out',60);
