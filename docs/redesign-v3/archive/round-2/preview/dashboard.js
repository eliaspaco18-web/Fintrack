/* Round 02 design simulator. All records below are fictional. No external reads or writes. */
'use strict';

const commitments = [
  {id:'card-cycle',day:23,month:'sep',title:'Tarjeta Andino',kind:'Pago de ciclo',amount:1200,currency:'PEN',direction:'out',source:'credits'},
  {id:'ar-norte',day:25,month:'sep',title:'Estudio Norte',kind:'Cobro pendiente',amount:850,currency:'PEN',direction:'in',source:'receivables'},
  {id:'ap-rivera',day:26,month:'sep',title:'Servicios Rivera',kind:'Pago pendiente',amount:1100,currency:'PEN',direction:'out',source:'payables'},
  {id:'loan-08',day:28,month:'sep',title:'Préstamo personal',kind:'Cuota 08 de 24',amount:680,currency:'PEN',direction:'out',source:'credits'},
  {id:'ar-horizonte',day:10,month:'oct',title:'Taller Horizonte',kind:'Cobro pendiente',amount:400,currency:'USD',direction:'in',source:'receivables'},
  {id:'ap-editorial',day:10,month:'oct',title:'Editorial Sur',kind:'Pago pendiente',amount:250,currency:'USD',direction:'out',source:'payables'},
];

function categoryTotals(type) {
  const totals = new Map();
  tx.filter(t=>t.type===type).forEach(t=>totals.set(t.category,(totals.get(t.category)||0)+t.amount));
  return [...totals].sort((a,b)=>b[1]-a[1]);
}

function dashboardHeader() {
  return `<div class="page-head dashboard-head"><div><h1>Tu panorama financiero</h1><p class="subtitle">Lunes, 21 de septiembre de 2026</p></div><div class="head-actions"><button class="btn scope-button" data-action="period">${icon('calendar',15)}Mes actual: septiembre</button><div class="split-action"><button class="btn primary" data-operation="expense">${icon('plus',16)}Registrar egreso</button><button class="btn primary" data-action="create" aria-label="Otras formas de registrar">${icon('chevrondown',16)}</button></div></div></div>`;
}

function positionOverview() {
  return `<section class="position-band" aria-label="Posición registrada"><div class="native-position"><div class="position-heading"><span>Saldos de tus cuentas</span><button class="text-action" data-action="workspace-accounts">4 cuentas${icon('chevron',12)}</button></div><div class="native-values"><button class="amount-fact" data-action="workspace-accounts"><span>Soles · PEN</span><strong class="num">${money(26840)}</strong></button><button class="amount-fact" data-action="workspace-accounts"><span>Dólares · USD</span><strong class="num">${money(3200,'USD')}</strong></button></div></div><a href="#receivables" class="pending-position"><span>Por cobrar${icon('chevron',12)}</span><strong class="num">${money(2850)}</strong><small class="num">${money(400,'USD')}</small><em>Pendiente documentado</em></a><a href="#payables" class="pending-position"><span>Por pagar${icon('chevron',12)}</span><strong class="num">${money(3100)}</strong><small class="num">${money(250,'USD')}</small><em>Pendiente documentado</em></a></section>`;
}

function attentionLine() {
  return `<div class="attention-line"><span class="attention-label">${icon('info',14)}Para revisar</span><button data-budget="Transporte">Transporte: <span class="num">${money(60)}</span> sobre el límite${icon('chevron',12)}</button><button data-action="unverified">1 saldo inicial sin moneda${icon('chevron',12)}</button></div>`;
}

function categoryAnalysis() {
  const type=state.categoryType;
  const rows=categoryTotals(type),total=rows.reduce((sum,row)=>sum+row[1],0),max=rows[0]?.[1]||1;
  return `<div class="category-analysis"><div class="category-heading"><h3>Por categoría</h3><div class="segmented" aria-label="Tipo de distribución"><button data-category-type="expense" aria-pressed="${type==='expense'}">Egresos</button><button data-category-type="income" aria-pressed="${type==='income'}">Ingresos</button></div></div><p class="micro muted">Septiembre · PEN de reporte</p><div class="category-rank">${rows.map(([name,amount])=>`<button class="category-line" data-category-link="${name}" data-category-direction="${type}"><span class="category-name">${name}</span><strong class="num">${money(amount)}</strong><span class="category-track"><i style="width:${amount/max*100}%;background:var(--${type==='income'?'positive':'expense'})"></i></span><small class="num">${(amount/total*100).toFixed(1)}%</small></button>`).join('')}</div></div>`;
}

function monthReport() {
  return `<section class="workspace-panel month-report" aria-label="Lectura del mes"><div class="panel-heading"><div><h2>Así va septiembre</h2><p>Del 1 al 21 · PEN de reporte</p></div><button class="icon-btn" data-action="workspace-result" aria-label="Cómo se calcula el resultado">${icon('info',16)}</button></div><div class="month-values"><button data-report-link="income"><span>Ingresos</span><strong class="num positive">${money(12480)}</strong></button><button data-report-link="expense"><span>Egresos</span><strong class="num">${money(7360)}</strong></button><button class="month-result" data-action="workspace-result"><span>Resultado del período</span><strong class="num">${money(5120,'PEN',true)}</strong></button></div><button class="mobile-analysis-toggle" data-action="workspace-analysis" aria-expanded="${state.analysisExpanded}" aria-controls="report-analysis">${state.analysisExpanded?'Ocultar análisis':'Ver flujo y categorías'}${icon('chevrondown',15)}</button><div id="report-analysis" class="report-analysis ${state.analysisExpanded?'expanded':''}"><div class="trend-analysis"><div class="trend-heading"><h3>Ingresos y egresos</h3><button class="btn ghost sm" data-action="chart-range">${innerWidth<360?'6 meses · tabla':state.period+' meses'}${icon('chevrondown',12)}</button></div>${chart()}<div class="chart-foot"><div class="legend"><span><i class="swatch"></i>Ingresos</span><span><i class="swatch out"></i>Egresos</span></div><button class="text-action" data-action="chart-data">Ver datos</button></div><div id="chart-tooltip" class="tooltip-panel" role="status"></div><p class="micro muted partial-month">* Septiembre: 1–21. Los demás meses están completos.</p></div>${categoryAnalysis()}</div><div class="report-foot"><span>Sin transferencias internas</span><button class="text-action" data-action="workspace-result"><span class="num">41.0%</span> de los ingresos queda como resultado${icon('info',12)}</button></div></section>`;
}

function agendaPanel() {
  const all=commitments.filter(c=>state.agendaWindow===30||c.month==='sep');
  const shown=innerWidth<768&&!state.agendaExpanded?all.slice(0,2):all.slice(0,4);
  return `<section class="workspace-panel agenda-panel"><div class="panel-heading"><div><h2>Tu próxima agenda</h2><p>${state.agendaWindow===7?'21–28 sep':'21 sep–21 oct'} · Fechas registradas</p></div><div class="segmented" aria-label="Intervalo de la agenda"><button data-agenda-window="7" aria-pressed="${state.agendaWindow===7}">7 días</button><button data-agenda-window="30" aria-pressed="${state.agendaWindow===30}">30 días</button></div></div>${state.scenario==='error'?`<div class="local-error"><span>${icon('info',20)}</span><h3>No pudimos cargar la agenda</h3><p>El mes y tus saldos siguen disponibles.</p><button class="btn" data-action="retry">Reintentar</button></div>`:`<div class="agenda-items">${shown.map(c=>agendaRow(c)).join('')}</div><div class="agenda-foot"><span>${all.length} compromisos · No son pagos automáticos</span><button class="text-action" data-action="workspace-agenda">${all.length>shown.length?'Ver los '+all.length:'Ver agenda'}${icon('chevron',12)}</button></div>`}</section>`;
}

function agendaRow(c) {
  return `<button class="agenda-row" data-commitment="${c.id}"><span class="date-stamp"><strong>${c.day}</strong><small>${c.month}</small></span><span class="agenda-copy"><strong>${c.title}</strong><small>${c.kind}</small></span><span class="agenda-money"><strong class="num">${money(c.amount,c.currency)}</strong><small class="${c.direction==='in'?'positive':'muted'}">${c.direction==='in'?'Por cobrar':'Por pagar'}</small></span>${icon('chevron',12)}</button>`;
}

function dashboardBudgets() {
  return `<section class="workspace-panel dashboard-budgets"><div class="panel-heading"><div><h2>Presupuestos</h2><p>Septiembre · Importes vinculados</p></div>${link('budgets','Ver todos')}</div>${budgets.slice(0,3).map(b=>`<button class="budget-review-row ${b.spent>b.limit?'over':''}" data-budget="${b.name}"><span class="budget-name">${b.name}</span><strong class="num">${(b.spent/b.limit*100).toFixed(1)}%</strong><span class="track"><span class="fill" style="width:${Math.min(100,b.spent/b.limit*100)}%"></span></span><small class="num">${money(b.spent)} de ${money(b.limit)}</small><span class="budget-room num">${b.spent>b.limit?money(b.spent-b.limit)+' excedidos':money(b.limit-b.spent)+' restantes'}</span></button>`).join('')}<div class="budget-total"><span>Disponible en 4 presupuestos · PEN</span><strong class="num">${money(1070)}</strong></div></section>`;
}

function recentRegister() {
  return `<section class="workspace-panel recent-register"><div class="panel-heading"><div><h2>Últimos movimientos</h2><p>Comprueba lo último que registraste</p></div>${link('transactions','Ver todos')}</div><div class="recent-list">${tx.slice(0,5).map(t=>`<button class="recent-row" data-detail="${t.id}"><span class="recent-date">${t.date}</span><span class="recent-description"><strong>${t.description}</strong><small><span class="recent-date-inline">${t.date} · </span>${t.type==='transfer'?'Transferencia interna':t.category}</small></span><span class="recent-account">${t.account}</span><strong class="num ${t.type==='income'?'positive':''}">${txAmount(t)}</strong>${icon('chevron',12)}</button>`).join('')}</div><div class="recent-foot"><button class="text-action" data-operation="income">${icon('plus',14)}Registrar ingreso</button><button class="text-action" data-operation="transfer">${icon('moves',14)}Transferir entre cuentas</button><button class="text-action" data-action="create">Otras operaciones${icon('chevron',12)}</button></div></section>`;
}

function creditOverview() {
  return `<section class="workspace-panel credit-overview"><div class="panel-heading"><h2>Créditos, por separado</h2>${link('credits','Revisar')}</div><button class="credit-glance" data-action="credit-schedule"><span><strong>Andino Visa</strong><small>Deuda en tarjeta</small></span><span><strong class="num">${money(4800)}</strong><small class="num">${money(180,'USD')}</small></span></button><div class="credit-utilization"><span>Línea en PEN · Uso equivalente</span><strong class="num">35.4%</strong><span class="track"><span class="fill" style="width:35.4%"></span></span></div><button class="credit-glance" data-action="loan-schedule"><span><strong>Préstamo personal</strong><small>Capital pendiente</small></span><strong class="num">${money(10800)}</strong></button><p class="micro muted">No se suma como dinero disponible.</p></section>`;
}

function dashboard() {
  return `${dashboardHeader()}${positionOverview()}${attentionLine()}<div class="dashboard-workspace"><div class="dashboard-primary">${monthReport()}${recentRegister()}</div><div class="dashboard-secondary">${agendaPanel()}${dashboardBudgets()}${creditOverview()}</div></div><p class="workspace-scope">Los saldos describen hoy; el resultado describe septiembre. Cobros, pagos y crédito conservan su moneda y su significado.</p>`;
}

function dashboardSkeleton() {
  return `<div role="status" aria-label="Cargando panorama financiero"><div class="skeleton title"></div><div class="skeleton position-skeleton"></div><div class="skeleton attention-skeleton"></div><div class="dashboard-workspace"><div class="dashboard-primary"><div class="skeleton report-skeleton"></div><div class="skeleton recent-skeleton"></div></div><div class="dashboard-secondary"><div class="skeleton agenda-skeleton"></div><div class="skeleton budget-skeleton"></div><div class="skeleton credit-skeleton"></div></div></div><p class="small muted" style="margin-top:20px">Muestra del estado de carga. Cambia «Estado» para continuar.</p></div>`;
}

function commitmentDetail(id) {
  const c=commitments.find(row=>row.id===id);if(!c)return;
  const amount=money(c.amount,c.currency),isCard=c.id==='card-cycle',isLoan=c.id==='loan-08';
  openDialog(c.title,`${c.kind} · ${c.day} ${c.month} 2026`, `<span class="badge ${c.direction==='in'?'good':'warn'}">${c.direction==='in'?'Por cobrar':'Por pagar'}</span><div class="detail-amount num">${amount}</div><div class="detail-list"><div class="fact"><span>Moneda original</span><strong>${c.currency}</strong></div><div class="fact"><span>Fuente</span><strong>${isCard?'Ciclo de tarjeta':isLoan?'Cronograma del préstamo':'Obligación documentada'}</strong></div><div class="fact"><span>Fecha de vencimiento</span><strong>${c.day} ${c.month} 2026</strong></div></div><p class="evidence-note">${isCard?'Importe registrado en el ciclo, no un pago mínimo calculado.':isLoan?'Capital S/ 500.00 · Interés S/ 150.00 · Seguro S/ 20.00 · Otros S/ 10.00.':'Este pendiente no modifica los saldos hasta que se registre el cobro o pago.'}</p>`, `<a class="btn" href="#${c.source}">Ver registro de origen</a><button class="btn primary" data-action="${isCard||isLoan?'credit-payment':c.direction==='in'?'collect':'pay'}">Registrar ${c.direction==='in'?'cobro':'pago'}</button>`);
}

function goToCategory(name,type) {
  state.category=name;state.filter=type;state.currency='all';state.search='';state.selected.clear();
  if(location.hash==='#transactions')render();else location.hash='transactions';
}

function resultExplanation() {
  openDialog('Qué explica tu resultado','Del 1 al 21 de septiembre de 2026 · PEN de reporte', `<div class="detail-amount num">${money(5120,'PEN',true)}</div><p class="small muted">Ingresos menos egresos que afectan tus reportes.</p><div class="equation"><span class="num">${money(12480)}</span><span>−</span><span class="num">${money(7360)}</span><span>=</span><strong class="num">${money(5120)}</strong></div><h3>De dónde vinieron tus ingresos</h3>${categoryTotals('income').map(([name,n])=>`<button class="explanation-row" data-category-link="${name}" data-category-direction="income"><span>${name}</span><strong class="num">${money(n)}</strong>${icon('chevron',14)}</button>`).join('')}<h3 class="subsection-title">En qué se registraron los egresos</h3>${categoryTotals('expense').map(([name,n])=>`<button class="explanation-row" data-category-link="${name}" data-category-direction="expense"><span>${name}</span><strong class="num">${money(n)}</strong>${icon('chevron',14)}</button>`).join('')}<div class="effect"><strong class="num">41.0%</strong><p>Resultado / ingresos del mismo período.</p><span>No es una meta ni un rendimiento. Las transferencias internas no entran en este cálculo. El resultado no equivale al saldo disponible.</span></div>`, `<button class="btn" data-action="close">Cerrar</button><a class="btn primary" href="#transactions">Explorar movimientos</a>`);
}

document.addEventListener('click',event=>{
  const target=event.target.closest('button,a');if(!target)return;
  if(target.dataset.categoryType){state.categoryType=target.dataset.categoryType;render();$(`[data-category-type="${state.categoryType}"]`)?.focus();}
  if(target.dataset.categoryLink){dirty=false;closeDialog();goToCategory(target.dataset.categoryLink,target.dataset.categoryDirection);}
  if(target.dataset.reportLink){state.category=null;state.filter=target.dataset.reportLink;state.search='';location.hash='transactions';}
  if(target.dataset.agendaWindow){state.agendaWindow=Number(target.dataset.agendaWindow);render();$(`[data-agenda-window="${state.agendaWindow}"]`)?.focus();}
  if(target.dataset.commitment)commitmentDetail(target.dataset.commitment);
  switch(target.dataset.action){
    case 'workspace-clear-category':state.category=null;render();break;
    case 'workspace-result':resultExplanation();break;
    case 'workspace-analysis':state.analysisExpanded=!state.analysisExpanded;render();$('[data-action="workspace-analysis"]')?.focus();break;
    case 'workspace-agenda':openDialog('Tu agenda registrada',`${state.agendaWindow===7?'21–28 septiembre':'21 septiembre–21 octubre'} 2026 · Importes originales`, `<div class="agenda-items">${commitments.filter(c=>state.agendaWindow===30||c.month==='sep').map(agendaRow).join('')}</div><p class="evidence-note">Solo compromisos con fecha registrada. Los cobros no son ingresos garantizados y los pagos no son automáticos.</p>`, `<button class="btn" data-action="close">Cerrar</button>`);break;
    case 'workspace-accounts':openDialog('Dónde están tus saldos','4 cuentas activas · Cada moneda conserva su importe original', `<div class="account-peek">${accounts.map(a=>`<button data-account="${a.name}" class="explanation-row"><span><strong>${a.name}</strong><small>${a.bank} · ${a.currency}</small></span><strong class="num">${money(a.balance,a.currency)}</strong>${icon('chevron',14)}</button>`).join('')}</div><p class="evidence-note">No incluye cuentas técnicas de tarjeta. Una cuenta no implica saldo líquido garantizado. No consolidamos estas monedas.</p>`, `<button class="btn" data-action="close">Cerrar</button><a class="btn primary" href="#portfolio">Abrir Cuentas</a>`);break;
  }
});

const baseTransactions=transactions;
transactions=function(){return baseTransactions().replace('<div id="transaction-rows">',`${state.category?`<div class="filter-chips"><button class="filter-chip" data-action="workspace-clear-category">Categoría: ${esc(state.category)}${icon('close',12)}</button></div>`:''}<div id="transaction-rows">`)+`<p class="register-scope">${state.category?`Filtro de categoría: <strong>${esc(state.category)}</strong>. `:''}El resumen corresponde al mes completo registrado; los filtros cambian la lista, no sus totales.</p>`;};

matchMedia('(max-width: 767px)').addEventListener('change',()=>{if(state.page==='dashboard')render();});
render();
