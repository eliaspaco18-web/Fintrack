/* Round 03 interaction reference. Synthetic, in-memory data only; no production code. */
'use strict';
const polish = {
  epoch:0, input:'pointer', rate:1, reduce:false, record:null, back:null, discardNext:null,
  month:'Sep', pinned:'Sep', popover:null, anchor:null,
  curves:{dock:'cubic-bezier(.32,.72,0,1)',out:'cubic-bezier(.22,1,.36,1)',shift:'cubic-bezier(.77,0,.175,1)'},
};
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
const veil=document.createElement('div');veil.id='stage-veil';veil.setAttribute('aria-hidden','true');document.body.append(veil);
function canMove(){return !motionPreference.matches&&!polish.reduce&&polish.input!=='keyboard';}
function move(node,frames,duration,curve='out',delay=0){
  if(!node||!canMove())return null;
  const animation=node.animate(frames,{duration:duration*polish.rate,easing:polish.curves[curve],delay:delay*polish.rate,fill:'backwards'});
  animation.finished.catch(()=>{});return animation;
}
function stopMotion(node){node?.getAnimations({subtree:true}).forEach(animation=>animation.cancel());}
function finishMotion(){document.getAnimations().forEach(animation=>{try{animation.finish();}catch{animation.cancel();}});}
toast=function(message){
  clearTimeout(state.toastTimer);const node=$('#toast');stopMotion(node);node.textContent=message;node.classList.add('visible');
  move(node,[{opacity:0,transform:'translateX(-50%) translateY(6px) scale(.985)'},{opacity:1,transform:'translateX(-50%)'}],180);
  state.toastTimer=setTimeout(()=>{const animation=move(node,[{opacity:1,transform:'translateX(-50%)'},{opacity:0,transform:'translateX(-50%) translateY(4px)'}],120);const hide=()=>node.classList.remove('visible');if(animation)animation.finished.then(hide).catch(()=>{});else hide();},4200);
};
document.addEventListener('pointerdown',()=>{polish.input='pointer';document.body.dataset.input='pointer';},true);
document.addEventListener('keydown',()=>{polish.input='keyboard';document.body.dataset.input='keyboard';},true);
motionPreference.addEventListener('change',()=>{if(motionPreference.matches)finishMotion();});

openDialog=function(title,description,body,footer='',kind='drawer'){
  closePopover(false);
  const d=$('#overlay'),wasOpen=d.open,wasClosing=d.dataset.phase==='closing';
  const previous=wasOpen?{transform:getComputedStyle(d).transform,opacity:getComputedStyle(d).opacity}:null;
  const wasDrawer=d.classList.contains('drawer');
  ++polish.epoch;stopMotion(d);stopMotion(veil);
  if(!wasOpen)lastFocus=document.activeElement;
  dirty=false;polish.discardNext=null;polish.back=null;
  d.className=kind;d.dataset.phase='open';
  const editing=body.includes('<form'),destructive=title==='Eliminar movimiento';
  d.innerHTML=`<header class="dialog-header"><div class="panel-nav"><div class="panel-location">${icon(destructive?'info':editing?'file':state.page==='dashboard'?'home':'moves',15)}<span>${esc(names[state.page])}</span><span>/</span><span>${destructive?'Confirmación':editing?'Registro':'Detalle'}</span></div><button class="icon-btn" data-action="close" aria-label="Cerrar">${icon('close',17)}</button></div><div class="panel-heading-row"><h2 id="overlay-title" tabindex="-1">${title}</h2><span class="mode-tag"><i></i>${destructive?'Revisar':editing?'Edición':'Lectura'}</span></div>${description?`<p>${description}</p>`:''}</header><div class="dialog-body">${body}</div>${footer?`<footer class="dialog-footer"><div class="panel-save-state">${icon('lock',12)}${editing?'Simulación local · No se enviarán datos':'Datos de muestra · Sin cambios en tus registros'}</div><div class="panel-actions">${footer}</div></footer>`:''}`;
  if(!wasOpen)d.showModal();
  document.body.style.overflow='hidden';veil.style.opacity='1';
  $('#overlay-title').focus({preventScroll:true});
  if(!wasOpen||wasClosing||wasDrawer!==d.classList.contains('drawer')){
    const isDrawer=d.classList.contains('drawer');
    const first=wasClosing?previous:{transform:isDrawer?'translateX(48px) scale(.985)':'translateY(14px) scale(.975)',opacity:.82};
    d.style.transformOrigin=isDrawer?'right center':'center bottom';
    move(d,[first,{transform:'none',opacity:1}],isDrawer?260:220,'dock');
    move(veil,[{opacity:wasClosing?getComputedStyle(veil).opacity:0},{opacity:1}],160);
    move($('.dialog-body',d),[{transform:'translateY(8px)',opacity:.65},{transform:'none',opacity:1}],180,'out',36);
  }else{
    move($('.dialog-body',d),[{transform:'translateX(12px)',opacity:.55},{transform:'none',opacity:1}],180);
  }
};
function requestLeave(next){
  if(!dirty){next();return;}
  polish.discardNext=next;
  if(!$('#discard-note'))$('.dialog-body').insertAdjacentHTML('afterbegin',`<div class="warning-banner" id="discard-note" role="alert"><span>Tienes cambios sin guardar.</span><button class="btn sm" data-action="discard">Descartar</button><button class="btn sm" data-action="keep-editing">Seguir editando</button></div>`);
  $('#discard-note').scrollIntoView({block:'nearest',behavior:'instant'});
  $('#discard-note [data-action="keep-editing"]').focus({preventScroll:true});
}
closeDialog=function(){requestLeave(()=>{
  const d=$('#overlay');if(!d.open||d.dataset.phase==='closing')return;
  closePopover(false);const epoch=++polish.epoch;
  const start={transform:getComputedStyle(d).transform,opacity:getComputedStyle(d).opacity};
  const veilStart=getComputedStyle(veil).opacity;
  stopMotion(d);stopMotion(veil);d.dataset.phase='closing';
  const finish=()=>{if(epoch!==polish.epoch)return;d.close();d.dataset.phase='closed';veil.style.opacity='0';document.body.style.overflow='';if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});};
  const animation=move(d,[start,{transform:d.classList.contains('drawer')?'translateX(24px) scale(.992)':'translateY(9px) scale(.985)',opacity:0}],160);
  move(veil,[{opacity:veilStart},{opacity:0}],140);
  if(animation)animation.finished.then(finish).catch(()=>{});else finish();
});};
$('#overlay').addEventListener('close',()=>{if(!$('#overlay').open){veil.style.opacity='0';document.body.style.overflow='';closePopover(false);}});

const originalForm=form;
form=function(type='expense',edit=null){
  originalForm(type,edit);
  $('.dialog-body').insertAdjacentHTML('afterbegin',`<div class="form-stage-intro"><i>${icon('file',12)}</i><span><strong>${edit?'Revisa este registro':'Define el movimiento'}</strong> · Importe, cuenta y clasificación</span></div>`);
  if(edit?.id){
    polish.back=()=>detail(edit.id);
    $('.panel-location').innerHTML=`<button class="context-back" data-refine="back-record">${icon('chevron',13)}Volver al movimiento</button>`;
    const category=$('[name="category"]');
    if(category){if(![...category.options].some(o=>o.value===edit.category))category.add(new Option(edit.category,edit.category));category.value=edit.category;}
    const day=Number(edit.date.split(' ')[0]);$('[name="date"]').value=`2026-09-${String(day).padStart(2,'0')}`;
  }
};
function recordContent(t,context=false){
  const internal=t.type==='transfer';
  return context?`<div class="context-line"><span class="context-node">1</span><div><strong>Importe original, sin reinterpretar</strong><p>${money(t.amount,t.currency)} en ${t.currency}. La cuenta y el movimiento conservan su moneda.</p></div></div><div class="context-line"><span class="context-node">2</span><div><strong>${internal?'Movimiento entre cuentas propias':'Participa en el resultado del mes'}</strong><p>${internal?'Cambia la distribución entre cuentas; no es ingreso ni egreso.':`Se registra como ${t.type==='income'?'ingreso':'egreso'} de septiembre en ${esc(t.category)}. El resultado del período no es el saldo de la cuenta.`}</p></div></div><div class="context-line"><span class="context-node">3</span><div><strong>Del resumen al registro</strong><p>Al editar se mantienen el tipo, la cuenta y la clasificación del registro. La aplicación validará sus vínculos antes de guardar o eliminar.</p></div></div><p class="evidence-note">Esta explicación describe el registro de muestra; no es una recomendación ni una predicción.</p>`:
  `<dl class="record-facts"><div><dt>Fecha del movimiento</dt><dd>${t.date} 2026</dd></div><div><dt>Moneda original</dt><dd>${t.currency} · ${t.currency==='PEN'?'Sol peruano':'Dólar estadounidense'}</dd></div><div><dt>En el reporte del mes</dt><dd>${internal?'Excluido · Transferencia interna':'Incluido como '+(t.type==='income'?'ingreso':'egreso')}</dd></div><div><dt>Comprobante</dt><dd>Sin comprobante asociado</dd></div><div class="full"><dt>Descripción</dt><dd>${esc(t.description)}</dd></div></dl><div class="context-explanation"><h3>${internal?'Reubica dinero; no genera resultado':'El importe y su significado, juntos'}</h3><p>${internal?'Las transferencias entre tus cuentas no se suman a ingresos o egresos.':'El importe original se muestra aquí. La lectura de septiembre utiliza el importe de reporte correspondiente, sin sumar cuentas ni compromisos.'}</p></div>`;
}
detail=function(id){
  const t=tx.find(row=>row.id===id);if(!t)return;polish.record=id;
  const label=t.type==='income'?'Ingreso':t.type==='expense'?'Egreso':'Transferencia interna';
  openDialog(t.description,`${t.date} 2026 · Movimiento registrado`,
    `<section class="panel-summary"><div class="summary-eyebrow"><span>Importe original · ${t.currency}</span><span class="badge ${t.type==='income'?'good':''}">${label}</span></div><div class="detail-amount num ${t.type==='income'?'positive':''}">${txAmount(t)}</div><p class="summary-caption">${t.type==='transfer'?'Entre cuentas propias':'Registrado en '+t.account}</p><div class="record-path"><div><small>${t.type==='transfer'?'Recorrido':'Cuenta'}</small><strong>${esc(t.account)}</strong></div>${icon('chevron',14)}<div><small>Clasificación</small><strong>${esc(t.category)}</strong></div></div></section><div class="panel-tabs" role="tablist" aria-label="Vista del movimiento"><button role="tab" id="record-tab-detail" data-record-tab="detail" aria-controls="record-content" aria-selected="true">Detalle</button><button role="tab" id="record-tab-context" data-record-tab="context" aria-controls="record-content" aria-selected="false" tabindex="-1">Contexto financiero</button></div><div id="record-content" role="tabpanel" aria-labelledby="record-tab-detail">${recordContent(t)}</div>`,
    `<button class="btn" data-refine="record-more">${icon('more',16)}Más</button><button class="btn primary" data-edit="${id}">Editar movimiento</button>`);
  const rows=state.page==='transactions'?filteredTx():tx.slice(0,5),index=rows.findIndex(row=>row.id===id);
  if(index>=0)$('.panel-location').insertAdjacentHTML('afterend',`<div class="record-navigation" aria-label="Recorrer registros visibles"><button class="icon-btn previous" data-record-step="${rows[index-1]?.id||''}" aria-label="Movimiento anterior" ${index===0?'disabled':''}>${icon('chevron',14)}</button><span class="micro muted">${index+1} / ${rows.length}</span><button class="icon-btn" data-record-step="${rows[index+1]?.id||''}" aria-label="Movimiento siguiente" ${index===rows.length-1?'disabled':''}>${icon('chevron',14)}</button></div>`);
};

chart=function(){
  const data=series.slice(-Math.min(state.period,innerWidth<600?3:6)),step=510/data.length;
  if(!data.some(row=>row[0]===polish.pinned))polish.pinned='Sep';polish.month=polish.pinned;
  const selected=data.find(row=>row[0]===polish.month);
  return `<div class="flow-plot"><div class="flow-period"><strong>PEN de reporte</strong><span class="period-status"><i></i>Septiembre en curso</span></div><svg class="chart" viewBox="0 0 560 232" role="group" aria-label="Ingresos y egresos por mes. Valores exactos disponibles en Ver datos.">${[0,5000,10000,15000].map(n=>{const y=192-n/15000*159;return `<line class="${n===0?'zero-rule':'grid'}" x1="43" x2="556" y1="${y}" y2="${y}"/><text x="32" y="${y+4}" text-anchor="end">${n===0?'0':n/1000+' mil'}</text>`;}).join('')}${data.map(([month,inc,out],i)=>{
    const x=46+i*step+step/2,yi=192-inc/15000*159,yo=192-out/15000*159;
    const bar=(left,y,width)=>`M${left} 192V${y+4}Q${left} ${y} ${left+4} ${y}H${left+width-4}Q${left+width} ${y} ${left+width} ${y+4}V192Z`;
    return `<g class="chart-focus ${month===polish.month?'is-selected':''}" tabindex="${month===polish.month?'0':'-1'}" role="button" aria-pressed="${month===polish.month}" aria-label="${month} 2026, ${month==='Sep'?'1 al 21, parcial':'mes completo'}: ingresos ${money(inc)}, egresos ${money(out)}, resultado ${money(inc-out,'PEN',true)}" data-flow-month="${month}"><rect class="month-wash" x="${x-step/2+3}" y="15" width="${step-6}" height="186" rx="10"/><path class="income-bar" d="${bar(x-25,yi,20)}"/><path class="expense-bar" d="${bar(x+1,yo,20)}"/><path class="gap-bracket" d="M${x+25} ${yi}h5v${yo-yi}h-5"/><text class="month-label" x="${x}" y="222" text-anchor="middle">${month}${month==='Sep'?'*':''}</text><rect class="month-bottom" x="${x-10}" y="229" width="20" height="2" rx="1"/><rect class="chart-hit" x="${x-step/2}" y="0" width="${step}" height="232" fill="transparent"/></g>`;
  }).join('')}</svg><div class="flow-reading" aria-live="polite"><span><span id="flow-month-label">${selected[0]}${selected[0]==='Sep'?' · 1–21':''}</span> · Resultado</span><strong class="num" id="flow-result">${money(selected[1]-selected[2],'PEN',true)}</strong></div><div class="chart-float" id="flow-tooltip" role="tooltip" hidden></div></div>`;
};
categoryAnalysis=function(){
  const type=state.categoryType,rows=categoryTotals(type),total=rows.reduce((sum,row)=>sum+row[1],0),max=rows[0]?.[1]||1;
  return `<div class="category-analysis"><div class="category-heading"><h3>Por categoría</h3><div class="segmented" aria-label="Tipo de distribución"><button data-category-type="expense" aria-pressed="${type==='expense'}">Egresos</button><button data-category-type="income" aria-pressed="${type==='income'}">Ingresos</button></div></div><div class="category-rank">${rows.map(([name,amount],index)=>`<button class="category-line" data-category-link="${name}" data-category-direction="${type}"><span class="rank-index">${String(index+1).padStart(2,'0')}</span><span class="category-name">${name}</span><strong class="num">${money(amount)}</strong><span class="category-track"><i style="width:${amount/max*100}%"></i></span><small class="num">${(amount/total*100).toFixed(1)}%</small></button>`).join('')}</div><div class="category-scale"><span>Porción del ${type==='income'?'ingreso':'egreso'}</span><span>PEN · Septiembre</span></div></div>`;
};
function selectMonth(month,tooltip=true,pin=false){
  const row=series.find(r=>r[0]===month),plot=$('.flow-plot');if(!row||!plot)return;
  if(pin)polish.pinned=month;polish.month=month;
  $$('.chart-focus').forEach(g=>{g.classList.toggle('is-selected',g.dataset.flowMonth===month);g.setAttribute('aria-pressed',String(g.dataset.flowMonth===month));g.tabIndex=g.dataset.flowMonth===month?0:-1;g.removeAttribute('aria-describedby');});
  $('#flow-month-label').textContent=month+(month==='Sep'?' · 1–21':'');$('#flow-result').textContent=money(row[1]-row[2],'PEN',true);
  const tip=$('#flow-tooltip');if(!tooltip){tip.hidden=true;return;}
  const wasHidden=tip.hidden;tip.hidden=false;
  tip.innerHTML=`<header><strong>${month} 2026</strong><small>${month==='Sep'?'1–21 · Parcial':'Mes completo'}</small></header><div class="fact"><span>Ingresos</span><strong class="num positive">${money(row[1])}</strong></div><div class="fact"><span>Egresos</span><strong class="num">${money(row[2])}</strong></div><div class="fact tooltip-result"><span>Resultado</span><strong class="num">${money(row[1]-row[2],'PEN',true)}</strong></div><p>PEN de reporte · Sin transferencias</p>`;
  const selected=$(`[data-flow-month="${month}"]`),anchor=selected.getBoundingClientRect(),bounds=plot.getBoundingClientRect();
  selected.setAttribute('aria-describedby','flow-tooltip');
  tip.style.left=`${Math.max(0,Math.min(bounds.width-tip.offsetWidth,anchor.x-bounds.x+anchor.width/2-tip.offsetWidth/2))}px`;
  tip.style.top='36px';
  if(wasHidden)move(tip,[{opacity:0,transform:'translateY(3px)'},{opacity:1,transform:'none'}],110);
}

function closePopover(animate=true){
  const pop=polish.popover;if(!pop)return;polish.popover=null;
  const anchor=polish.anchor;anchor?.setAttribute('aria-expanded','false');polish.anchor=null;
  const focused=pop.contains(document.activeElement);
  const remove=()=>{pop.remove();if(focused&&anchor?.isConnected)anchor.focus({preventScroll:true});};
  stopMotion(pop);
  const animation=animate?move(pop,[{opacity:1,transform:'none'},{opacity:0,transform:'translateY(-3px) scale(.985)'}],110):null;
  if(animation)animation.finished.then(remove).catch(remove);else remove();
}
function showPopover(anchor,title,content,menu=true){
  if(polish.anchor===anchor){closePopover();return;}
  closePopover(false);const pop=document.createElement('div');pop.className='context-popover';pop.id='context-popover';pop.setAttribute('popover','manual');pop.setAttribute('role',menu?'menu':'dialog');pop.setAttribute('aria-label',title);
  pop.innerHTML=`<div class="popover-heading">${title}</div>${content}`;
  ($('#overlay').open?$('#overlay'):document.body).append(pop);pop.showPopover();
  polish.popover=pop;polish.anchor=anchor;anchor.setAttribute('aria-expanded','true');anchor.setAttribute('aria-controls',pop.id);anchor.setAttribute('aria-haspopup',menu?'menu':'dialog');
  const a=anchor.getBoundingClientRect(),r=pop.getBoundingClientRect(),below=a.bottom+8+r.height<=innerHeight-12;
  const x=Math.max(12,Math.min(a.right-r.width,innerWidth-r.width-12)),y=below?a.bottom+8:Math.max(12,a.top-r.height-8);
  pop.style.left=`${x}px`;pop.style.top=`${y}px`;pop.style.transformOrigin=`${Math.max(12,Math.min(r.width-12,a.left+a.width/2-x))}px ${below?'top':'bottom'}`;
  move(pop,[{opacity:.6,transform:`translateY(${below?-4:4}px) scale(.97)`},{opacity:1,transform:'none'}],160,'dock');
  if(polish.input==='keyboard')$('button',pop)?.focus();
}
function menuItem(label,attributes,description='',ico='file'){return `<button class="popover-item" role="menuitem" ${attributes}>${icon(ico,16)}<span>${label}${description?`<small>${description}</small>`:''}</span></button>`;}
function glideSelection(oldRect,selector){
  const selected=$(selector),group=selected?.closest('.segmented');if(!oldRect||!group||!canMove())return;
  const rect=selected.getBoundingClientRect(),box=group.getBoundingClientRect(),glide=document.createElement('i');glide.className='selection-glide';glide.style.cssText=`left:${rect.left-box.left-1}px;top:${rect.top-box.top-1}px;width:${rect.width}px;height:${rect.height}px`;
  group.classList.add('is-gliding');group.append(glide);
  const animation=move(glide,[{transform:`translateX(${oldRect.left-rect.left}px) scaleX(${oldRect.width/rect.width})`},{transform:'none'}],180,'shift');
  animation?.finished.then(()=>{group.classList.remove('is-gliding');glide.remove();}).catch(()=>{});
}
const renderBeforePolish=render;
// Review-only: hidden fixture geometry demonstrates the intended zero-jump boundary.
// Production skeletons must use component geometry/last-success state, not hidden fetched data.
dashboardSkeleton=function(){return `<div class="skeleton-model" inert aria-hidden="true">${dashboard()}</div><span class="sr-only" role="status">Cargando panorama financiero</span>`;};
render=function(){
  closePopover(false);renderBeforePolish();
  const range=$('[data-action="chart-range"]');if(range)range.innerHTML=`${innerWidth<600?'3 meses':state.period+' meses'}${icon('chevrondown',12)}`;
  if(state.scenario==='loading')$('#main').insertAdjacentHTML('beforeend','<div class="loading-resolve"><button class="btn" data-refine="resolve-loading">Simular carga completada</button><p class="micro muted">Control de revisión · No es una acción del producto</p></div>');
};
document.addEventListener('click',event=>{
  const target=event.target.closest('button,a,[data-flow-month]');
  if(polish.popover&&!polish.popover.contains(event.target)&&!polish.anchor?.contains(event.target))closePopover();
  if(!target)return;
  if($('#flow-tooltip')&&!event.target.closest('.flow-plot'))selectMonth(polish.pinned,false);
  const consume=()=>{event.preventDefault();event.stopImmediatePropagation();};
  if(target.dataset.flowMonth){consume();selectMonth(target.dataset.flowMonth,true,true);return;}
  if(target.dataset.recordTab){consume();const context=target.dataset.recordTab==='context';$$('[data-record-tab]').forEach(b=>{b.setAttribute('aria-selected',String(b===target));b.tabIndex=b===target?0:-1;});const content=$('#record-content');content.innerHTML=recordContent(tx.find(t=>t.id===polish.record),context);content.setAttribute('aria-labelledby',target.id);move(content,[{transform:'translateX(8px)',opacity:.55},{transform:'none',opacity:1}],160);return;}
  if(target.dataset.recordStep){consume();detail(+target.dataset.recordStep);return;}
  if(target.dataset.refine==='back-record'){consume();requestLeave(polish.back);return;}
  if(target.dataset.action==='discard'&&polish.discardNext){consume();const next=polish.discardNext;dirty=false;polish.discardNext=null;next();return;}
  if(target.dataset.refine==='record-more'){consume();showPopover(target,'Acciones del movimiento',menuItem('Eliminar movimiento',`data-delete="${polish.record}"`,'Revisar vínculos antes de confirmar','info'));return;}
  if(target.dataset.delete){consume();const t=tx.find(row=>row.id===Number(target.dataset.delete));polish.record=t.id;openDialog('Eliminar movimiento','Revisa el registro antes de continuar.',`<div class="effect" style="margin:0"><p>${esc(t.description)}</p><strong class="num">${txAmount(t)}</strong><p class="muted small" style="margin-top:10px">${t.date} 2026 · ${esc(t.account)}</p></div><p class="evidence-note">La app real validará vínculos y efectos sobre saldos. La preview no elimina datos.</p>`,`<button class="btn" data-refine="restore-record">Conservar</button><button class="btn danger" data-action="simulate">Simular eliminación</button>`,'');return;}
  if(target.dataset.refine==='restore-record'){consume();detail(polish.record);return;}
  if(target.dataset.refine==='resolve-loading'){consume();state.scenario='ready';render();move($('#main'),[{opacity:.3,transform:'translateY(4px)'},{opacity:1,transform:'none'}],140);return;}
  if(target.dataset.range){consume();closePopover(false);if(target.dataset.range==='table'){const old=state.period;state.period=6;action('chart-data');state.period=old;}else{state.period=+target.dataset.range;render();}return;}
  if(target.dataset.categoryType||target.dataset.agendaWindow){consume();const group=target.closest('.segmented'),old=$('[aria-pressed="true"]',group).getBoundingClientRect(),attribute=target.dataset.categoryType?'category-type':'agenda-window',value=target.dataset.categoryType||target.dataset.agendaWindow;if(attribute==='category-type')state.categoryType=value;else state.agendaWindow=+value;render();glideSelection(old,`[data-${attribute}="${value}"]`);if(polish.input==='keyboard')$(`[data-${attribute}="${value}"]`).focus();return;}
  if(target.dataset.action==='create'&&innerWidth>=768){consume();showPopover(target,'Registrar una operación',menuItem('Ingreso','data-operation="income"','Dinero que recibes','down')+menuItem('Egreso','data-operation="expense"','Dinero que sale','up')+menuItem('Transferencia interna','data-operation="transfer"','Entre tus propias cuentas','moves')+menuItem('Prestar dinero','data-operation="receivable_issue"','','down')+menuItem('Registrar cobro','data-operation="receivable_collect"','','down')+menuItem('Dinero recibido a devolver','data-operation="payable_issue"','','up')+menuItem('Registrar pago','data-operation="payable_pay"','','up')+menuItem('Comprar un activo','data-operation="asset_purchase"','','box'));return;}
  if(target.dataset.action==='period'){consume();showPopover(target,'Alcance del período',`<div class="popover-copy"><p><strong>Movimientos y categorías</strong><br>1–21 de septiembre de 2026.</p><p><strong>Saldos de tus cuentas</strong><br>Posición registrada actual, no saldo al cierre del mes.</p><p>Esta muestra no activa un filtro global que los servicios actuales no puedan cumplir.</p><button class="btn sm" data-refine="popover-close">Entendido</button></div>`,false);return;}
  if(target.dataset.refine==='popover-close'){consume();closePopover();return;}
  if(target.dataset.action==='chart-range'){consume();showPopover(target,'Lectura del flujo',menuItem('3 meses','data-range="3"','Julio–septiembre 2026','calendar')+(innerWidth>=600?menuItem('6 meses','data-range="6"','Abril–septiembre 2026','calendar'):'')+menuItem('Ver los 6 meses en tabla','data-range="table"','Importes exactos, sin redondear','grid'));return;}
  if(polish.popover?.contains(target))closePopover(false);
},true);
document.addEventListener('pointerover',event=>{if(event.pointerType==='touch')return;const g=event.target.closest('[data-flow-month]');if(g&&!g.contains(event.relatedTarget))selectMonth(g.dataset.flowMonth);});
document.addEventListener('pointerout',event=>{const g=event.target.closest('[data-flow-month]');if(g&&!g.closest('.flow-plot').contains(event.relatedTarget))selectMonth(polish.pinned,false);});
document.addEventListener('focusin',event=>{const g=event.target.closest('[data-flow-month]');if(g)selectMonth(g.dataset.flowMonth);});
document.addEventListener('focusout',event=>{const g=event.target.closest('[data-flow-month]');if(g&&!g.closest('.flow-plot').contains(event.relatedTarget))selectMonth(polish.pinned,false);});
document.addEventListener('keydown',event=>{
  if(polish.popover){const buttons=$$('button',polish.popover);if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();closePopover(false);return;}if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();const index=buttons.indexOf(document.activeElement),next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[next]?.focus();return;}if(event.key==='Tab')closePopover(false);}
  const g=event.target.closest('[data-flow-month]');
  if(g&&['ArrowLeft','ArrowRight','Enter',' ','Escape'].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();if(event.key==='Escape'){selectMonth(polish.pinned,false);return;}if(['Enter',' '].includes(event.key)){selectMonth(g.dataset.flowMonth,true,true);return;}const nodes=$$('[data-flow-month]'),i=nodes.indexOf(g),next=Math.max(0,Math.min(nodes.length-1,i+(event.key==='ArrowRight'?1:-1)));nodes[next].focus();}
  if(event.target.matches('[data-record-tab]')&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();const next=$$('[data-record-tab]').find(b=>b!==event.target);next.click();next.focus();}
},true);
window.addEventListener('resize',()=>closePopover(false));
document.addEventListener('scroll',event=>{if(polish.popover&&!polish.popover.contains(event.target))closePopover(false);},true);
// Explicitly review-only hooks: the workshop and automated QA exercise the exact same UI.
window.FinTrackReview={detail,form,close(){closePopover();closeDialog();},finish:finishMotion,setRate(value){polish.rate=value;},setReduced(value){polish.reduce=value;document.body.dataset.reduced=String(value);if(value)finishMotion();},pointer(){polish.input='pointer';document.body.dataset.input='pointer';},get phase(){return $('#overlay').dataset.phase;}};
// Round 04 performs the initial render after all isolated refinements are loaded.
