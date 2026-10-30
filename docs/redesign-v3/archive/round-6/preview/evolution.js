/* Round 04. All records are synthetic. Only a presentation preference is persisted. */
'use strict';
const evolution={collapsed:false,tabletOpen:false,lastPage:null,tip:null,tipTimer:null,tipRecent:0,creditType:'all',creditSearch:'',creditStatus:'all',creditPage:1,creditSample:12,pageSize:8,routeAnimations:[]};
try{evolution.collapsed=localStorage.getItem('fintrack.preview.v3.sidebar')==='compact';}catch{/* Storage is optional. */}
const isTablet=()=>innerWidth>=768&&innerWidth<1200;
const isRail=()=>innerWidth>=1200?evolution.collapsed:isTablet()&&!evolution.tabletOpen;
const shellIcon=()=>'<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16m7-12-3 4 3 4"/></svg>';
const navScrim=document.createElement('button');navScrim.id='nav-scrim';navScrim.tabIndex=-1;navScrim.setAttribute('aria-label','Cerrar navegación');navScrim.dataset.evolve='navigation';document.body.append(navScrim);
const quick=document.createElement('button');quick.id='quick-register';quick.className='quick-register';quick.dataset.evolve='quick';quick.setAttribute('aria-label','Registrar');quick.setAttribute('aria-haspopup','menu');quick.setAttribute('aria-expanded','false');quick.innerHTML=`${icon('plus',21)}<span>Registrar</span>`;document.body.append(quick);
const routeStatus=document.createElement('div');routeStatus.className='route-status';routeStatus.setAttribute('role','status');routeStatus.setAttribute('aria-live','polite');document.body.append(routeStatus);
function hideRailTip(){clearTimeout(evolution.tipTimer);if(evolution.tip){evolution.tip.remove();evolution.tip=null;evolution.tipRecent=performance.now();}$$('[data-rail-tip]').forEach(el=>{el.removeAttribute('aria-describedby');delete el.dataset.railTip;});}
function railTip(anchor,immediate=false){
  if(!isRail()||!anchor)return;hideRailTip();
  const show=()=>{if(!anchor.isConnected||!isRail())return;const r=anchor.getBoundingClientRect(),tip=document.createElement('div');tip.className='rail-tip';tip.id='rail-label';tip.setAttribute('role','tooltip');tip.textContent=anchor.getAttribute('aria-label');tip.style.left=`${r.right+12}px`;tip.style.top=`${Math.max(36,Math.min(innerHeight-44,r.top+2))}px`;document.body.append(tip);anchor.dataset.railTip='true';anchor.setAttribute('aria-describedby','rail-label');evolution.tip=tip;};
  if(immediate||performance.now()-evolution.tipRecent<800)show();else evolution.tipTimer=setTimeout(show,300);
}
function syncShellState(){
  document.body.dataset.rail=String(isRail());document.body.dataset.tabletNav=evolution.tabletOpen&&isTablet()?'open':'closed';
  const expanded=!isRail();$$('[data-evolve="navigation"]').filter(b=>b!==navScrim).forEach(b=>{b.setAttribute('aria-expanded',String(expanded));b.setAttribute('aria-label',expanded?'Contraer navegación':'Expandir navegación');});
  const modalNav=isTablet()&&evolution.tabletOpen;
  $('.workspace').inert=modalNav;quick.inert=modalNav;$('.review-bar').inert=modalNav;
  if(modalNav){$('#sidebar').setAttribute('role','dialog');$('#sidebar').setAttribute('aria-modal','true');$('#sidebar').setAttribute('aria-label','Navegación principal');}
  else{$('#sidebar').removeAttribute('role');$('#sidebar').removeAttribute('aria-modal');}
  document.body.style.overflow=modalNav||$('#overlay').open?'hidden':'';
}
const shellBeforeEvolution=shell;
shell=function(){
  shellBeforeEvolution();
  $('#topbar .breadcrumb').insertAdjacentHTML('afterbegin',`<button class="icon-btn shell-toggle" data-evolve="navigation" aria-controls="sidebar" aria-label="Contraer navegación" aria-expanded="true">${shellIcon()}</button>`);
  $('#sidebar').insertAdjacentHTML('afterbegin',`<button class="icon-btn tablet-nav-close" data-evolve="navigation" aria-controls="sidebar" aria-label="Contraer navegación">${icon('close',16)}</button>`);
  $$('.sidebar .nav-item').forEach(anchor=>{anchor.setAttribute('aria-label',$('.nav-label',anchor).textContent);anchor.removeAttribute('title');});
  $('#bottom-nav').innerHTML=[['dashboard','Inicio','home'],['transactions','Movimientos','moves'],['portfolio','Cuentas','wallet']].map(([id,label,ico])=>`<a class="bottom-item ${state.page===id?'active':''}" href="#${id}" ${state.page===id?'aria-current="page"':''}>${icon(ico,19)}${label}</a>`).join('')+`<button class="bottom-item more" data-action="menu" aria-label="Más">${icon('menu',20)}Más</button>`;
  syncShellState();
};
function toggleNavigation(force){
  if(innerWidth<768)return;
  hideRailTip();closePopover(false);const wasRail=isRail(),oldMain=$('.workspace').getBoundingClientRect();
  const oldBackground=getComputedStyle($('#sidebar'),'::before').transform;
  $$('.shell-label-ghost').forEach(node=>{stopMotion(node);node.remove();});
  const labelPoses=!wasRail&&canMove()?$$('.sidebar .brand>span,.sidebar .nav-label,.sidebar .profile-copy').map(node=>({node:node.cloneNode(true),rect:node.getBoundingClientRect(),style:getComputedStyle(node)})):[];
  stopMotion($('#sidebar'));stopMotion($('.workspace'));
  if(isTablet())evolution.tabletOpen=force===undefined?!evolution.tabletOpen:force;
  else{evolution.collapsed=force===undefined?!evolution.collapsed:!force;try{localStorage.setItem('fintrack.preview.v3.sidebar',evolution.collapsed?'compact':'expanded');}catch{/* Ephemeral fallback. */}}
  syncShellState();const newScale=isRail()?68/208:1;
  if(canMove()){
    // Only the flat background scales. The mark, labels and content never stretch.
    const bg=$('#sidebar').animate([{transform:oldBackground},{transform:`scaleX(${newScale})`}],{pseudoElement:'::before',duration:240*polish.rate,easing:polish.curves.dock});bg.finished.catch(()=>{});
    const delta=oldMain.left-$('.workspace').getBoundingClientRect().left;
    if(delta)move($('.workspace'),[{transform:`translateX(${delta}px)`},{transform:'none'}],240,'dock');
    if(!isRail())$$('.sidebar .brand>span,.sidebar .nav-label,.sidebar .profile-copy').forEach(label=>move(label,[{opacity:0,transform:'translateX(-6px)'},{opacity:1,transform:'none'}],150,'out',55));
    else labelPoses.forEach(({node,rect,style})=>{const ghost=document.createElement('div');ghost.className='shell-label-ghost';ghost.inert=true;ghost.setAttribute('aria-hidden','true');ghost.style.cssText=`position:fixed;z-index:41;pointer-events:none;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;font:${style.font};color:${style.color};letter-spacing:${style.letterSpacing};white-space:nowrap`;ghost.append(node);document.body.append(ghost);const animation=move(ghost,[{opacity:1,transform:'none'},{opacity:0,transform:'translateX(-6px)'}],100);animation?.finished.then(()=>ghost.remove()).catch(()=>ghost.remove());});
  }
  if(isTablet()){if(evolution.tabletOpen)$('.tablet-nav-close').focus({preventScroll:true});else $('.shell-toggle').focus({preventScroll:true});}
  requestAnimationFrame(calibrateChartLabels);
}
function quickMenu(){
  if(polish.popover&&polish.anchor===quick){closePopover();return;}
  const context={portfolio:['Añadir cuenta','account-create','wallet'],budgets:['Crear presupuesto','budget-create','target'],credits:['Añadir crédito','credit-create','card']}[state.page];
  const common=menuItem('Egreso','data-operation="expense"','Dinero que sale','up')+menuItem('Ingreso','data-operation="income"','Dinero que recibes','down')+menuItem('Transferencia interna','data-operation="transfer"','Entre tus cuentas, sin ingreso ni egreso','moves');
  const others=menuItem('Prestar dinero','data-operation="receivable_issue"','','down')+menuItem('Registrar cobro','data-operation="receivable_collect"','','down')+menuItem('Dinero recibido a devolver','data-operation="payable_issue"','','up')+menuItem('Registrar pago','data-operation="payable_pay"','','up')+menuItem('Comprar un activo','data-operation="asset_purchase"','','box');
  showPopover(quick,'Acceso rápido',`<div class="quick-menu-title" role="presentation">Registrar un movimiento</div>${common}<div class="quick-menu-divider" role="separator"></div>${others}${context?`<div class="quick-menu-divider" role="separator"></div><div class="quick-menu-title" role="presentation">En ${names[state.page]}</div>${menuItem(context[0],`data-action="${context[1]}"`,'',context[2])}`:''}`);
}

// The default twelve products share their registered agenda with Inicio; alternate sizes are internal QA only.
const baseCreditRecords=[
  {id:'card-andino',type:'CARD',name:'Andino Visa',bank:'Banco Andino',tail:'4821',active:true,currency:'PEN',amount:4800,usd:180,limit:15500,util:35.4,equivalent:5484,due:'23 sep',payment:1200},
  {id:'loan-personal',type:'LOAN',name:'Préstamo personal',bank:'Banco Costa',active:true,currency:'PEN',amount:10800,due:'28 sep',payment:680,installment:'08 de 24',parts:[500,150,20,10]},
];
const expandedCreditRecords=[
  baseCreditRecords[0],
  {id:'card-costa',type:'CARD',name:'Costa Mastercard',bank:'Banco Costa',tail:'9034',active:true,currency:'PEN',amount:2150,limit:10000,util:21.5,due:'26 sep',payment:460},
  {id:'card-viajes',type:'CARD',name:'Andino Viajes',bank:'Banco Andino',tail:'7750',active:true,currency:'USD',amount:620,limit:4000,util:15.5,due:'02 oct',payment:180},
  {id:'card-reserva',type:'CARD',name:'Pacífico Reserva',bank:'Banco Pacífico',tail:'1038',active:true,currency:'PEN',amount:0,limit:8000,util:0},
  {id:'card-familiar',type:'CARD',name:'Costa Familiar',bank:'Banco Costa',tail:'5206',active:true,currency:'PEN',amount:3420,limit:6000,util:57,due:'05 oct',payment:510},
  baseCreditRecords[1],
  {id:'loan-estudios',type:'LOAN',name:'Préstamo de estudios',bank:'Banco Andino',active:true,currency:'PEN',amount:24000,due:'30 sep',payment:1120,installment:'04 de 24',parts:[850,220,40,10]},
  {id:'loan-hogar',type:'LOAN',name:'Mejoras del hogar',bank:'Banco Pacífico',active:true,currency:'PEN',amount:16000,due:'03 oct',payment:780,installment:'11 de 24',parts:[600,145,25,10]},
  {id:'loan-libre',type:'LOAN',name:'Libre disponibilidad',bank:'Banco Costa',active:true,currency:'PEN',amount:6500},
  {id:'line-emprende',type:'LINE',name:'Línea Emprende',bank:'Banco Andino',active:true,currency:'PEN',amount:4200,limit:10000},
  {id:'line-flexible',type:'LINE',name:'Línea Flexible',bank:'Banco Costa',active:true,currency:'USD',amount:1250,limit:2500},
  {id:'card-cerrada',type:'CARD',name:'Andino Clásica',bank:'Banco Andino',tail:'2210',active:false,currency:'PEN',amount:0,limit:5000,util:0},
];
function creditRecords(){if(evolution.creditSample===2)return baseCreditRecords;if(evolution.creditSample===12)return expandedCreditRecords;return [...expandedCreditRecords,...Array.from({length:28},(_,index)=>{const record=expandedCreditRecords[index%11];return {...record,id:`scale-${index+13}`,name:`${record.name} · ${index+13}`,tail:String(3000+index),active:true};})];}
const creditTypes={CARD:'Tarjeta',LOAN:'Préstamo',LINE:'Línea de crédito'};
const creditMeaning=record=>record.type==='CARD'?'Deuda registrada':record.type==='LOAN'?'Capital original':'Disponible de la línea';
const creditGlyph=record=>record.type==='CARD'?'card':record.type==='LOAN'?'file':'wallet';
function selectedCreditRecords(){return creditRecords().filter(record=>(evolution.creditType==='all'||evolution.creditType===record.type)&&(evolution.creditStatus==='all'||record.active===(evolution.creditStatus==='active'))&&normalizeChoice(`${record.name} ${record.bank} ${record.tail||''}`).includes(normalizeChoice(evolution.creditSearch)));}
function creditAmountMarkup(record){return `<span class="credit-value num">${money(record.amount,record.currency)}</span>${record.usd?`<span class="secondary-value num">${money(record.usd,'USD')}</span>`:''}`;}
function creditUsage(record){return record.type==='CARD'&&record.active?`<div class="credit-util-mini"><span class="track" aria-hidden="true"><span class="fill" style="width:${Math.min(100,record.util)}%"></span></span><span class="num">${record.util.toFixed(1)}%</span></div><small>${record.equivalent?'Uso equivalente · PEN':'Uso de línea · '+record.currency}</small>`:record.type==='LOAN'?`<span class="small">${record.installment?'Cuota '+record.installment:'Sin cronograma verificado'}</span><small>${record.installment?'Desglose disponible':'No estimamos cuotas'}</small>`:record.type==='LINE'?`<span class="small num">${money(record.limit,record.currency)}</span><small>Límite registrado</small>`:'<span class="badge">Cerrada</span>';}
function creditDue(record){return record.payment?`<div class="credit-next"><strong class="num">${money(record.payment,record.currency)}</strong><span>${record.due}</span></div><small>${record.type==='LOAN'?'Cuota registrada':'Pago del ciclo registrado'}</small>`:`<span class="small muted">${record.active?'Sin vencimiento registrado':'Sin pagos pendientes'}</span>`;}
function creditRegister(){
  const rows=selectedCreditRecords(),pages=Math.max(1,Math.ceil(rows.length/evolution.pageSize));evolution.creditPage=Math.min(evolution.creditPage,pages);const start=(evolution.creditPage-1)*evolution.pageSize,visible=rows.slice(start,start+evolution.pageSize);
  return `<div class="register credit-register"><table class="credit-table"><thead><tr><th scope="col">Producto</th><th scope="col">Importe y significado</th><th scope="col">Línea / cronograma</th><th scope="col">Vencimiento registrado</th><th><span class="sr-only">Detalle</span></th></tr></thead><tbody>${visible.map(record=>`<tr data-credit-row="${record.id}" class="${record.active?'':'credit-row-closed'}"><td><div class="credit-product"><span class="credit-glyph">${icon(creditGlyph(record),16)}</span><div><button class="row-button" data-credit-record="${record.id}">${esc(record.name)}</button><small>${creditTypes[record.type]} · ${record.tail?'•• '+record.tail:record.bank}</small></div></div></td><td>${creditAmountMarkup(record)}<small>${creditMeaning(record)}</small></td><td>${creditUsage(record)}</td><td>${creditDue(record)}</td><td><button class="icon-btn" data-credit-record="${record.id}" aria-label="Abrir ${esc(record.name)}">${icon('chevron',14)}</button></td></tr>`).join('')}</tbody></table><div class="credit-mobile-list">${visible.map(record=>`<article class="credit-mobile-row"><div class="credit-mobile-top"><div><button class="row-button" data-credit-record="${record.id}">${esc(record.name)}</button><small>${creditTypes[record.type]}${record.tail?' · •• '+record.tail:''}</small></div><div class="credit-mobile-amount">${creditAmountMarkup(record)}<small>${creditMeaning(record)}</small></div></div><div class="credit-mobile-next"><span>${record.payment?`${record.due} · ${record.type==='LOAN'?'Cuota':'Pago'} ${money(record.payment,record.currency)}`:record.active?'Sin vencimiento registrado':'Cerrada'}</span><button class="icon-btn" data-credit-record="${record.id}" aria-label="Abrir ${esc(record.name)}">${icon('chevron',14)}</button></div></article>`).join('')}</div>${!rows.length?'<div class="credit-no-results"><h2>No hay coincidencias</h2><p>Prueba otra entidad, producto o estado.</p><button class="btn" data-evolve="reset-credits">Limpiar filtros</button></div>':''}<div class="table-footer"><span>${rows.length?start+1:0}–${Math.min(start+evolution.pageSize,rows.length)} de ${rows.length} productos · Importes originales</span><div class="credit-pagination"><button class="icon-btn" data-credit-page="-1" aria-label="Página anterior" ${evolution.creditPage===1?'disabled':''}>${icon('chevron',14).replace('viewBox','style="transform:rotate(180deg)" viewBox')}</button><span>Pág. ${evolution.creditPage} / ${pages}</span><button class="icon-btn" data-credit-page="1" aria-label="Página siguiente" ${evolution.creditPage===pages?'disabled':''}>${icon('chevron',14)}</button></div></div></div>`;
}
function creditSummary(){
  const active=creditRecords().filter(record=>record.active),cards=active.filter(record=>record.type==='CARD'),loans=active.filter(record=>record.type==='LOAN'),pen=cards.reduce((total,record)=>total+(record.currency==='PEN'?record.amount:0),0),usd=cards.reduce((total,record)=>total+(record.currency==='USD'?record.amount:record.usd||0),0),principal=loans.reduce((total,record)=>total+record.amount,0);
  return `<div class="module-summary planning-summary"><div><p>Deuda en tarjetas · Por moneda</p><strong class="num">${money(pen)}</strong><strong class="num secondary-money">${money(usd,'USD')}</strong><small>${cards.length} tarjetas activas · Sin convertir monedas</small></div><div><p>Préstamos · Capital original PEN</p><strong class="num">${money(principal)}</strong><small>${loans.length} préstamos · No es capital pendiente</small></div><div><p>Productos activos</p><strong class="summary-count">${active.length} <span>de ${creditRecords().length} registrados</span></strong><small>${active.filter(record=>record.type==='LINE').length} líneas · Disponibilidad fuera del saldo propio</small></div></div>`;
}
credits=function(){
  const records=creditRecords();return `${heading('Créditos','Cada producto, su importe y su próximo compromiso.','Añadir crédito','credit-create')}${creditSummary()}<div class="tabs credit-tabs" aria-label="Tipo de crédito">${[['all','Todos'],['CARD','Tarjetas'],['LOAN','Préstamos'],['LINE','Líneas']].map(([type,label])=>`<button class="tab ${evolution.creditType===type?'active':''}" data-credit-type="${type}" aria-pressed="${evolution.creditType===type}">${label}<span class="tab-count">${records.filter(record=>type==='all'||record.type===type).length}</span></button>`).join('')}</div><div class="toolbar credit-toolbar"><label class="search">${icon('search',16)}<input id="credit-search" type="search" value="${esc(evolution.creditSearch)}" placeholder="Buscar producto, entidad o terminación" aria-label="Buscar créditos"></label><select class="credit-status-select" id="credit-status" aria-label="Estado de créditos">${[['active','Activos'],['closed','Cerrados'],['all','Todos los estados']].map(([value,label])=>`<option value="${value}" ${evolution.creditStatus===value?'selected':''}>${label}</option>`).join('')}</select><span class="credit-results" aria-live="polite">${selectedCreditRecords().length} resultados</span></div><div id="credit-results">${creditRegister()}</div><p class="evidence-note">Resumen de todos los productos activos; no cambia al buscar. Deuda, capital original y disponibilidad no se suman entre sí. Los vencimientos solo aparecen cuando están registrados.</p>`;
};
function refreshCreditRows(){const input=$('#credit-search');$('#credit-results').innerHTML=creditRegister();$('.credit-results').textContent=`${selectedCreditRecords().length} resultados`;if(input?.matches(':focus'))input.focus({preventScroll:true});}
function creditDetail(id,installment=false){
  const record=creditRecords().find(item=>item.id===id)||baseCreditRecords.find(item=>item.id===id);if(!record)return;
  const facts=record.type==='CARD'?`<div><dt>Límite registrado · ${record.currency}</dt><dd class="num">${money(record.limit,record.currency)}</dd></div><div><dt>Uso de la línea</dt><dd class="num">${record.util.toFixed(1)}%${record.equivalent?' · Equivalente informado':''}</dd></div>`:record.type==='LOAN'?`<div><dt>Capital pendiente</dt><dd>No disponible en esta muestra</dd></div><div><dt>Cronograma</dt><dd>${record.installment?'Cuota '+record.installment:'No verificado'}</dd></div>`:`<div><dt>Límite registrado</dt><dd class="num">${money(record.limit,record.currency)}</dd></div><div><dt>Disponibilidad</dt><dd>No es dinero propio</dd></div>`;
  const schedule=record.payment?`<section class="credit-evidence"><strong>${record.type==='LOAN'?'Próxima cuota registrada':'Próximo pago del ciclo'}</strong><div class="fact"><span>${record.due} 2026</span><strong class="num">${money(record.payment,record.currency)}</strong></div>${record.parts?`<div class="installment-breakdown">${['Capital','Intereses','Seguro','Otros'].map((label,index)=>`<div class="fact"><span>${label}</span><strong class="num">${money(record.parts[index],record.currency)}</strong></div>`).join('')}</div>`:'<p>Importe registrado en el ciclo; no es un pago mínimo calculado.</p>'}</section>`:'<div class="credit-evidence"><strong>Sin vencimiento registrado</strong>No se genera una fecha ni un importe a partir de un día de pago o de un límite.</div>';
  openDialog(record.name,`${creditTypes[record.type]} · ${record.bank} · ${record.active?'Activo':'Cerrado'}`,`<section class="panel-summary"><div class="summary-eyebrow"><span>${installment?'Compromiso registrado':creditMeaning(record)}</span><span class="badge">${record.currency}</span></div><div class="credit-detail-stat"><div><strong class="num">${money(installment?record.payment:record.amount,record.currency)}</strong><small>${installment?record.due+' 2026':creditMeaning(record)}</small></div>${record.usd&&!installment?`<div class="secondary-credit"><strong class="num">${money(record.usd,'USD')}</strong><small>Deuda en USD · Separada</small></div>`:''}</div></section>${installment?schedule:`<dl class="record-facts">${facts}<div><dt>Estado</dt><dd>${record.active?'Activo':'Cerrado'}</dd></div><div><dt>Identificador</dt><dd>${record.tail?'Terminación •• '+record.tail:esc(record.id)}</dd></div></dl>${schedule}`}${record.equivalent&&!installment?'<p class="evidence-note">Uso equivalente: S/ 5,484.00 de S/ 15,500.00. Tipo de cambio ilustrativo informado: 1 USD = 3.8000 PEN. Los saldos originales no se sustituyen por esta equivalencia.</p>':''}<p class="evidence-note">Registro ficticio. Esta muestra no procesa pagos ni modifica cronogramas. La implementación conservará los flujos financieros existentes con el producto seleccionado.</p>`,`${installment?`<button class="btn" data-credit-record="${record.id}">Volver al crédito</button>`:'<button class="btn" data-action="close">Cerrar</button>'}${record.payment&&!installment?`<button class="btn primary" data-credit-installment="${record.id}">Revisar vencimiento</button>`:''}`);
}
const budgetBeforeEvolution=budgetPage;
budgetPage=function(){const template=document.createElement('template');template.innerHTML=budgetBeforeEvolution();$('.module-summary',template.content).classList.add('planning-summary');$('.note-panel',template.content).innerHTML=`<div class="budget-context"><h2><span class="badge warn">1 límite superado</span> Transporte necesita una revisión</h2><p>${money(860)} de ${money(800)} · Exceso ${money(60)}. Revisa los registros antes de ajustar el límite.</p></div><button class="btn" data-budget="Transporte">Revisar movimientos${icon('chevron',14)}</button>`;return template.innerHTML;};

function colorTransactionAmounts(root=document){
  $$('[data-detail]',root).forEach(button=>{const record=tx.find(item=>item.id===Number(button.dataset.detail));if(!record)return;const row=button.closest('tr,.mobile-record,.recent-row');const amount=row?.querySelector('td.amount,.mobile-record-head>strong,.recent-row>.num');if(amount)amount.classList.add(`amount-${record.type}`);const symbol=row?.querySelector('.tx-symbol');if(symbol){symbol.setAttribute('role','img');symbol.setAttribute('aria-label',record.type==='income'?'Ingreso':record.type==='expense'?'Egreso':'Transferencia interna');}});
  if($('#overlay').open&&polish.record){const record=tx.find(item=>item.id===polish.record),amount=$('.detail-amount');if(record&&amount)amount.classList.add(`amount-${record.type}`);}
}
const rowsBeforeEvolution=transactionRows;transactionRows=function(){const template=document.createElement('template');template.innerHTML=rowsBeforeEvolution();colorTransactionAmounts(template.content);return template.innerHTML;};
const detailBeforeEvolution=detail;detail=function(id){detailBeforeEvolution(id);colorTransactionAmounts();};window.FinTrackReview.detail=detail;
const creditOverviewBeforeEvolution=creditOverview;creditOverview=function(){return creditOverviewBeforeEvolution().replace('Capital pendiente','Capital original').replace('data-action="credit-schedule"','data-credit-record="card-andino"').replace('data-action="loan-schedule"','data-credit-record="loan-personal"');};
const renderBeforeEvolution=render;
render=function(){
  const changed=evolution.lastPage!==null&&evolution.lastPage!==state.page;
  evolution.routeAnimations.forEach(animation=>animation?.cancel());evolution.routeAnimations=[];hideRailTip();
  renderBeforeEvolution();colorTransactionAmounts();
  const contextAction=$('.page-head .head-actions>.btn.primary');
  if(contextAction){contextAction.setAttribute('aria-label',$('.long-label',contextAction)?.textContent||contextAction.textContent);contextAction.classList.add('context-create');const label=$('.short-label',contextAction);if(label)label.textContent={credits:'Crédito',budgets:'Presupuesto',portfolio:'Cuenta'}[state.page]||'Nuevo';}
  if(state.page==='credits'){const scope=$('.head-actions [data-action="period"]');if(scope){delete scope.dataset.action;scope.dataset.evolve='credit-scope';scope.innerHTML=`${icon('info',15)}Posición registrada`;}}
  if(changed){
    const main=$('#main'),head=$('.page-head',main),summary=$('.module-summary,.position-band',main);
    const rest=[...main.children].filter(node=>node!==head&&node!==summary&&!node.matches('.planning-scope,.evidence-note,.workspace-scope,.warning-banner'));
    if(canMove()){
      const groups=[[head,0,160,3],[summary,24,180,5],...rest.map(node=>[node,48,180,6])];
      groups.forEach(([node,delay,duration,y])=>evolution.routeAnimations.push(move(node,[{opacity:.35,transform:`translateY(${y}px)`},{opacity:1,transform:'none'}],duration,'out',delay)));
    }
    const title=$('h1',main);if(title){title.tabIndex=-1;title.focus({preventScroll:true});}
    routeStatus.textContent=`${names[state.page]} · Contenido actualizado`;
  }
  evolution.lastPage=state.page;
};
document.addEventListener('click',event=>{
  const target=event.target.closest('button,a');if(!target)return;
  const consume=()=>{event.preventDefault();event.stopImmediatePropagation();};
  if(target.dataset.evolve==='navigation'){consume();toggleNavigation();return;}
  if(target.dataset.evolve==='quick'){consume();quickMenu();return;}
  if(target.dataset.evolve==='credit-scope'){consume();showPopover(target,'Lectura de Créditos','<div class="popover-copy"><p><strong>Posición de cada producto</strong><br>Deuda de tarjetas, capital original de préstamos y disponibilidad de líneas tienen significados diferentes.</p><p>Buscar o cambiar de página solo filtra el listado. El resumen conserva los productos activos de la muestra completa.</p><p>Los próximos compromisos usan fechas registradas, no un cálculo a partir del día de pago.</p><button class="btn sm" data-refine="popover-close">Entendido</button></div>',false);return;}
  if(target.dataset.creditRecord){consume();creditDetail(target.dataset.creditRecord);return;}
  if(target.dataset.creditInstallment){consume();creditDetail(target.dataset.creditInstallment,true);return;}
  if(target.dataset.creditType){consume();evolution.creditType=target.dataset.creditType;evolution.creditPage=1;render();$(`[data-credit-type="${evolution.creditType}"]`).focus({preventScroll:true});return;}
  if(target.dataset.creditPage){consume();evolution.creditPage+=Number(target.dataset.creditPage);refreshCreditRows();$('#credit-results').scrollIntoView({block:'nearest',behavior:'instant'});const next=$(`[data-credit-page="${target.dataset.creditPage}"]`);(next?.disabled?$('#credit-results .row-button'):next)?.focus({preventScroll:true});return;}
  if(target.dataset.evolve==='reset-credits'){consume();evolution.creditType='all';evolution.creditStatus='all';evolution.creditSearch='';evolution.creditPage=1;render();$('#credit-search').focus();return;}
  if(isTablet()&&evolution.tabletOpen&&target.closest('.sidebar')&&target.matches('a')){evolution.tabletOpen=false;syncShellState();}
},true);
document.addEventListener('input',event=>{if(event.target.id==='credit-search'){evolution.creditSearch=event.target.value;evolution.creditPage=1;refreshCreditRows();}});
document.addEventListener('change',event=>{

  if(event.target.id==='credit-status'){evolution.creditStatus=event.target.value;evolution.creditPage=1;refreshCreditRows();}
});
document.addEventListener('pointerover',event=>{if(event.pointerType==='touch')return;const anchor=event.target.closest('.sidebar .nav-item');if(anchor&&!anchor.contains(event.relatedTarget))railTip(anchor);});
document.addEventListener('pointerout',event=>{const anchor=event.target.closest('.sidebar .nav-item');if(anchor&&!anchor.contains(event.relatedTarget))hideRailTip();});
document.addEventListener('focusin',event=>{if(event.target.matches('.sidebar .nav-item'))railTip(event.target,true);});
document.addEventListener('focusout',event=>{if(event.target.matches('.sidebar .nav-item'))hideRailTip();});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape')hideRailTip();
  if(!isTablet()||!evolution.tabletOpen)return;
  if(event.key==='Escape'){event.preventDefault();toggleNavigation(false);return;}
  if(event.key==='Tab'){const nodes=$$('a,button:not([disabled])',$('#sidebar')),first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
},true);
window.addEventListener('resize',()=>{hideRailTip();if(!isTablet())evolution.tabletOpen=false;syncShellState();});
// Focus-safe, origin-aware quick menu uses the same production-intent popover contract.
const closePopoverBeforeEvolution=closePopover;
closePopover=function(animate=true){closePopoverBeforeEvolution(animate);if(!polish.popover)quick.setAttribute('aria-expanded','false');};
Object.assign(window.FinTrackReview,{toggleNavigation,quickMenu,creditDetail,navigate(page){if(names[page])location.hash=page;}});
// Round 05 initializes after selection and action refinements.
