# Propuesta de reestructuracion del Dashboard FinTrack

## 1. Skills consultados y uso concreto

- `redesign-existing-projects`: estrategia de migracion incremental. Lo use para decidir que la reestructuracion debe hacerse dentro de `/dashboard`, sin romper la ruta actual, conservando SWR/data fetching dentro de cada widget y moviendo primero la composicion visual antes de tocar logica.
- `design-taste-frontend`: arquitectura del shell de tabs, estado local, separacion de componentes interactivos y uso de grid estable en vez de calculos fragiles de layout.
- `high-end-visual-design`: jerarquia del Overview compacto, densidad visual, estados activo/inactivo de tabs, uso de bordes/sombras sobrias y evitar un dashboard convertido en pared de cards equivalentes.
- `impeccable`: criterio de producto para priorizar decision, claridad, estados vacios/carga/error y evitar que el dashboard mezcle lectura ejecutiva con exploracion profunda en el mismo scroll.
- `chart-visualization`: decisiones sobre variantes compactas de graficos. En particular: conservar el radar completo porque es una lectura multivariable, hacer el waterfall compacto solo para 30D y no comprimir ejes/labels hasta volverlos ilegibles.
- `mercury-ui-skills`: patron visual de tabs para light mode: navegacion sobria, 4px grid, pill segmentada, bordes sutiles, foco visible y estados activos claros. No use `linear-ui-skills` porque su referencia principal es dark mode y el redisenio actual de FinTrack es light mode.

## 2. Diagnostico

El dashboard actual ya tiene buenos widgets individuales, pero la pagina no distingue entre:

- Lectura ejecutiva inmediata: salud, caja, alertas, KPIs.
- Exploracion por modulo: movimientos, presupuestos, creditos, cobros/pagos, patrimonio.

El problema no es que falten widgets, sino que todos compiten en un scroll unico. La solucion propuesta es mantener `/dashboard` como una sola ruta y convertir el contenido en vistas por tab. Esto evita romper navegacion, cache y permisos, y permite que cada tab sea una "mini pagina" coherente.

La regla principal: el Overview solo debe responder "como estoy y que requiere atencion ahora". Todo lo que sea analisis, historico o gestion por modulo va a su tab.

## 3. Estructura propuesta de tabs

Tabs superiores:

1. `Overview`
2. `Transacciones`
3. `Presupuestos`
4. `Creditos`
5. `Cobros y Pagos`
6. `Ahorro y Patrimonio`

Los nombres siguen la navegacion conceptual de la app, pero agrupan modulos relacionados para no crear demasiadas pestañas.

## 4. Overview compacto

Objetivo: todo visible sin scroll en desktop 1440x900, tomando en cuenta sidebar/topbar.

Contenido:

1. `DashboardHeader`
   - KPI strip actual: Patrimonio neto, Ingresos, Egresos, Balance neto.
   - Razon: es la lectura ejecutiva mas rapida y ya resume el estado financiero del mes.
   - Movimiento: se queda en Overview.
   - Variante: tal cual, con posibilidad de `density="compact"` si la captura 1440x900 no cabe.

2. `FinancialHealthScore`
   - Radar completo de salud financiera.
   - Razon: es la senal compuesta mas importante. Cruza ahorro, credito, liquidez, deuda, diversificacion y disciplina.
   - Movimiento: Overview.
   - Variante: reutilizar el componente con `variant="overview"` si hace falta ajustar padding/altura. No duplicar el radar.

3. `CashFlowProjectionWidget compact`
   - Waterfall compacto solo 30D.
   - Razon: el Overview necesita riesgo de caja inmediato, no exploracion 30/60/90.
   - Movimiento: Overview en version compacta.
   - Variante necesaria: `variant="compact"` y `horizon="30D"`. Debe reutilizar la preparacion de datos del widget actual.

4. Banda corta de riesgo inmediato
   - Fuente: `AlertBanner`, `VencimientosWidget` y/o `/api/dashboard/alerts`.
   - Razon: alertas criticas y vencimientos proximos son accion inmediata.
   - Variante necesaria: nuevo `OverviewRiskStrip` o `VencimientosWidget variant="compact"`, con maximo 3 items y texto, no grafico.

No debe entrar en Overview:

- `MoneyFlowChart`: es exploratorio/historico.
- `SaldosDiaChart`: lectura operativa de movimientos/saldos.
- `EgresosCategoriasWidget`: analisis de distribucion.
- `SavingsRateTrendChart`: importante, pero pertenece a ahorro/patrimonio.
- `PresupuestosMesWidget`, `CreditosUsoRapidoWidget`, `SaldosBancariosWidget`: modulares.

## 5. Mapeo widget a tab

| Widget | Tab destino | Orden | Variante | Razon |
| --- | --- | ---: | --- | --- |
| `DashboardHeader` | Overview | 1 | Tal cual o `density="compact"` | Lectura ejecutiva de estado actual. |
| `FinancialHealthScore` | Overview | 2 | `variant="overview"` si hace falta | Score compuesto critico, no exploratorio. |
| `CashFlowProjectionWidget` | Overview y Cobros y Pagos | Overview 3, Cobros/Pagos 2 | `compact` en Overview, full en Cobros/Pagos | En Overview muestra riesgo 30D; en tab dedicado permite 30/60/90. |
| `AlertBanner` | Overview | 4 | Integrado en banda compacta | Solo debe ocupar espacio cuando hay alertas criticas. |
| `VencimientosWidget` | Overview y Cobros y Pagos | Overview 4, Cobros/Pagos 1 | `compact` en Overview, full en Cobros/Pagos | Vencimientos son urgencia inmediata y tambien modulo de gestion. |
| `MoneyFlowChart` | Transacciones | 1 | Tal cual | Comparacion mensual de ingresos, egresos y neto. |
| `SaldosDiaChart` | Transacciones | 2 | Tal cual, conservar altura controlada | Cierre diario y volatilidad de saldo pertenecen a movimientos/caja. |
| `EgresosCategoriasWidget` | Transacciones | 3 | Tal cual | Distribucion por categoria deriva de movimientos. |
| `PresupuestosMesWidget` | Presupuestos | 1 | Tal cual al inicio | Control del periodo presupuestal. |
| `SavingsRateTrendChart` | Ahorro y Patrimonio | 1 | Tal cual | Tasa de ahorro es metrica patrimonial, no transaccional pura. |
| `SaldosBancariosWidget` | Ahorro y Patrimonio | 2 | Tal cual | Distribucion de liquidez/portafolios. |
| `CreditosUsoRapidoWidget` | Creditos | 1 | Tal cual | Uso de credito consolidado y margen disponible. |
| `FlujoPendienteWidget` | Cobros y Pagos | 3 | Tal cual, preferido sobre legacy | Ya usa `--ft-*` y resume por cobrar vs por pagar. |
| `ReceivablesPayablesWidget` | Ninguno | Eliminar | Borrar archivo legacy | Reemplazado por `FlujoPendienteWidget`, que ya usa tokens `--ft-*`. |
| `AlertsWidget` | Ninguno | Eliminar | Borrar archivo legacy | Reemplazado por `AlertBanner` y `VencimientosWidget`. |
| `AccountsWidget` | Ninguno | Eliminar | Borrar export legacy | Reemplazado por `SaldosBancariosWidget`. |
| `AssetsWidget` | Ahorro y Patrimonio | Futuro | Migrable/nuevo | Hay gap real de activos; el widget existente es legacy. |
| `CreditsWidget` | Ninguno | Eliminar | Borrar export legacy | Reemplazado por `CreditosUsoRapidoWidget`. |
| `ExpenseBreakdown` | Transacciones | Retirar | No usar | Fue reemplazado por barras horizontales en `EgresosCategoriasWidget`. |
| `CashFlowChart` | Transacciones | Retirar | No usar | Fue reemplazado por `MoneyFlowChart` y `SaldosDiaChart`. |
| `KpiCards` | Ninguno | Retirar/legacy | No usar | Reemplazado por `DashboardHeader`. |

## 6. Layout por tab

### Overview

Orden recomendado:

1. Header de seccion con refresh.
2. `DashboardHeader` en 4 columnas.
3. Grid principal `xl:grid-cols-[5fr_4fr]`:
   - Izquierda: `FinancialHealthScore`.
   - Derecha: `CashFlowProjectionWidget compact`.
4. `OverviewRiskStrip` debajo, en una sola banda horizontal.

Si no cabe en 1440x900, el primer ajuste debe ser reducir padding/altura de `DashboardHeader` y del waterfall compacto, no eliminar el radar.

### Transacciones

Orden:

1. `MoneyFlowChart`
2. `SaldosDiaChart`
3. `EgresosCategoriasWidget`

Layout:

- `MoneyFlowChart` ancho completo.
- `SaldosDiaChart` y `EgresosCategoriasWidget` en grid de dos columnas en desktop, `items-start`, sin estirar alturas.
- En mobile: columna unica.

Versiones compactas:

- Ninguna obligatoria. Son widgets de exploracion y pueden respirar en este tab.

### Presupuestos

Orden:

1. `PresupuestosMesWidget`
2. Nuevo `BudgetVarianceBars` si se aprueba el gap.

Layout:

- `PresupuestosMesWidget` primero, ancho completo o 2/3 segun contenido.
- El grafico nuevo seria barras horizontales por presupuesto/categoria, mostrando definido, ejecutado, disponible y sobre-ejecucion.

Versiones compactas:

- `PresupuestosMesWidget` puede moverse tal cual. Ya tiene selector de periodo.

### Creditos

Orden:

1. `CreditosUsoRapidoWidget`
2. Nuevo `CreditPressureTimeline` o `CreditUtilizationTrend` si se aprueba el gap.

Layout:

- Widget de uso consolidado arriba.
- Debajo, lista/grafico de cuotas o ciclos proximos si hay data.

Versiones compactas:

- Ninguna al inicio.

### Cobros y Pagos

Orden:

1. `VencimientosWidget` full
2. `CashFlowProjectionWidget` full
3. `FlujoPendienteWidget`
4. Alertas detalladas migradas, si se decide mantener un panel de alertas completo.

Layout:

- `VencimientosWidget` y `FlujoPendienteWidget` pueden convivir en dos columnas si el contenido es corto.
- `CashFlowProjectionWidget` full debe tener ancho completo por legibilidad del waterfall.

Versiones compactas:

- Solo el Overview usa compact. En esta tab, mantener la version full.

### Ahorro y Patrimonio

Orden:

1. `SavingsRateTrendChart`
2. `SaldosBancariosWidget`
3. Nuevo `PatrimonioComposicionWidget` si se aprueba el gap de activos.

Layout:

- `SavingsRateTrendChart` y `SaldosBancariosWidget` en dos columnas.
- Composicion patrimonial ancho completo si incluye activos + liquidez + deuda.

Versiones compactas:

- Ninguna obligatoria. Si el tab crece demasiado, `SaldosBancariosWidget` podria tener `maxVisible=5` como ya hace.

## 7. Gaps identificados

### Gap 1: Activos y patrimonio no tienen una lectura representativa completa

Existe `/assets` y el radar usa tipos de activos para diversificacion, pero el dashboard solo muestra `SaldosBancariosWidget`, que representa liquidez/portafolios, no patrimonio total.

Propuesta:

- `PatrimonioComposicionWidget`
- Grafico: barra apilada horizontal + lista de contribuciones.
- Datos: efectivo/cuentas, activos, deuda usada.
- Razon visual: una barra apilada comunica composicion y proporcion mejor que donut cuando hay pocos segmentos y labels importantes.
- Tab: `Ahorro y Patrimonio`.

### Gap 2: Presupuestos no muestran variacion por categoria/limite

`PresupuestosMesWidget` resume el mes, pero no da una comparacion clara entre presupuestos. El usuario debe abrir `/budgets` para entender que limite esta consumiendo mas margen.

Propuesta:

- `BudgetVarianceBars`
- Grafico: barras horizontales tipo bullet/progress por presupuesto, ordenadas por mayor riesgo: excedido, >=80%, resto.
- Datos: `/api/budget-periods?period=YYYY-MM`.
- Tab: `Presupuestos`.

### Gap 3: Recurrentes existen como modulo, pero solo aparecen indirectamente en proyeccion (fase posterior)

`/recurring` alimenta el waterfall, pero no hay lectura propia de compromisos recurrentes mensuales.

Propuesta:

- `RecurringCommitmentsStrip`
- Visual: lista compacta con barras horizontales ingreso recurrente vs egreso recurrente y proximos 3 eventos.
- Datos: `/api/recurring` o extension de `/api/dashboard/projection`.
- Tab: `Cobros y Pagos`.
- Decision: queda fuera de esta ronda. No debe entrar al Overview salvo que genere una alerta critica.

### Gap 4: Creditos no tienen tendencia o calendario de presion (fase posterior)

`CreditosUsoRapidoWidget` muestra uso actual, pero no muestra evolucion ni proximos cortes/cuotas de forma dedicada.

Propuesta:

- `CreditPressureTimeline`
- Visual: timeline/lista priorizada de proximos cortes/cuotas, con importe y urgencia.
- Datos: creditos + billing cycles existentes.
- Tab: `Creditos`.
- Decision: queda fuera de esta ronda. `CreditosUsoRapidoWidget` cubre el tab de Creditos por ahora.

### Gap 5: Alertas tiene modulo propio, pero el dashboard solo muestra criticas

`AlertBanner` es correcto para Overview, pero el tab dedicado podria mostrar alertas no criticas agrupadas.

Propuesta:

- No crear grafico por defecto. Usar lista priorizada por severidad y fecha.
- Si luego se necesita visualizacion: small multiples por modulo con conteos, no pie chart.
- Tab: `Cobros y Pagos` o futuro subtab `Alertas`.

## 8. Reutilizacion vs duplicacion

Confirmacion:

- `FinancialHealthScore` puede reutilizarse. No hace falta duplicar radar. Si no entra bien en Overview, agregar props como `variant="overview"` o `density="compact"` para ajustar padding, side cards y altura, conservando el mismo calculo de factores.
- `CashFlowProjectionWidget` debe reutilizarse. La version compacta debe salir de props, no de un componente copiado. Propuesta: extraer calculo de `chartData` a helper/hook interno y renderizar:
  - `variant="compact"`: 30D, sin pills 30D/60D/90D, sin tooltip flotante grande, sin detalle semanal extenso.
  - `variant="full"`: comportamiento actual.
- `VencimientosWidget` puede reutilizarse con `variant="compact"` o alimentar un nuevo `OverviewRiskStrip`. Si la diferencia de markup es grande, `OverviewRiskStrip` puede ser nuevo, pero debe usar los mismos contratos de `/api/dashboard/sidebar` o `/api/dashboard/alerts`.
- `MoneyFlowChart`, `SaldosDiaChart`, `EgresosCategoriasWidget`, `PresupuestosMesWidget`, `SavingsRateTrendChart`, `CreditosUsoRapidoWidget` y `SaldosBancariosWidget` se mueven inicialmente tal cual.
- Widgets en `components/dashboard/widgets/*` que ya tienen reemplazo nuevo se eliminan en esta fase: `ReceivablesPayablesWidget`, `AlertsWidget`, `AccountsWidget` y `CreditsWidget`.

## 9. Estrategia tecnica de migracion

1. Mantener `/dashboard`.
2. Agregar un shell de tabs dentro de `DashboardWorkspaceContent`.
3. Usar estado local para `activeTab` en el primer paso. Opcionalmente sincronizar con query param `?tab=...` despues, para deep links.
4. Mantener SWR dentro de widgets para reducir riesgo. La reestructura no debe mover consultas a un mega store global.
5. Montar solo el tab activo para reducir peticiones y peso DOM, salvo Overview. Si se percibe latencia al cambiar tabs, se puede prefetch en hover o mantener tabs visitados.
6. Usar `items-start` en grids para evitar que widgets vecinos se estiren por altura.
7. Respetar tokens nuevos: todo codigo nuevo solo `--ft-*`.
8. Los widgets legacy con `--c-*` o `--color-*` no entran al nuevo layout sin migracion explicita.
9. Durante Step 2, cualquier contenido temporal de migracion debe vivir en un tab separado `Legacy`, nunca dentro de `Overview`, para no romper el requisito de Overview sin scroll. Ese tab temporal se elimina al terminar Step 3.

## 10. Plan de implementacion por pasos

Cada paso termina con:

```bash
npx tsc --noEmit && npm run build
```

Y pausa para aprobacion antes de seguir.

### Step 1: Crear mapa de tabs y componente base de navegacion

- Crear `components/dashboard/DashboardTabs.tsx`.
- Crear config tipada de tabs: id, label, descripcion corta, aria label.
- No mover widgets todavia.
- Verificacion: TypeScript + build.
- Pausa para aprobacion.

### Step 2: Integrar shell de tabs en `DashboardWorkspace`

- Agregar `activeTab`.
- Si se necesita mantener el layout largo durante la migracion, ponerlo en un tab temporal `Legacy`.
- Confirmacion explicita: el contenido temporal NO vive dentro de `Overview`, porque romperia el requisito de "sin scroll".
- El tab `Legacy` se elimina al completar Step 3.
- Conservar boton `Actualizar`.
- Verificacion: TypeScript + build.
- Pausa para aprobacion.

### Step 3: Reorganizar widgets existentes por tabs sin variantes compactas

- Mover componentes segun el mapeo.
- No cambiar logica interna de widgets.
- Usar grids con `items-start`.
- Verificacion: TypeScript + build.
- Validacion visual desktop y mobile.
- Pausa para aprobacion.

### Step 4: Implementar `CashFlowProjectionWidget compact`

- Consultar nuevamente `chart-visualization` antes de tocar el grafico compacto.
- Extraer calculo compartido si hace falta.
- Agregar `variant="compact"` y `horizon="30D"`.
- Verificar que ejes/labels sigan legibles.
- Verificacion: TypeScript + build.
- Captura Overview 1440x900.
- Pausa para aprobacion.

### Step 5: Implementar banda compacta de riesgos del Overview

- Crear `OverviewRiskStrip` o `VencimientosWidget variant="compact"`.
- Mostrar maximo 3 eventos criticos/proximos.
- Usar texto y montos, no grafico.
- Verificacion: TypeScript + build.
- Captura Overview 1440x900.
- Pausa para aprobacion.

### Step 6: Ajustar densidad del Overview

- Si no cabe sin scroll: compactar padding/altura de KPI strip, waterfall compacto o risk strip.
- No sacrificar legibilidad del radar.
- Verificacion: TypeScript + build.
- Capturas 1440x900 y viewport menor.
- Pausa para aprobacion.

### Step 7: Completar tab Cobros y Pagos

- Integrar `FlujoPendienteWidget`.
- Mantener `VencimientosWidget` full y `CashFlowProjectionWidget` full.
- Verificacion: TypeScript + build.
- Pausa para aprobacion.

### Step 8: Completar tab Ahorro y Patrimonio

- Mover `SavingsRateTrendChart` y `SaldosBancariosWidget`.
- Evaluar si `PatrimonioComposicionWidget` entra en esta fase o queda para fase siguiente.
- Verificacion: TypeScript + build.
- Pausa para aprobacion.

### Step 9: Completar tabs Transacciones, Presupuestos y Creditos

- Validar jerarquia interna y alturas.
- No crear graficos nuevos aun.
- Verificacion: TypeScript + build.
- Pausa para aprobacion.

### Step 10: Limpieza de widgets legacy reemplazados

- Eliminar `components/dashboard/widgets/ReceivablesPayablesWidget.tsx`.
- Eliminar `components/dashboard/widgets/AlertsWidget.tsx`.
- Eliminar `AccountsWidget` y `CreditsWidget` de `components/dashboard/widgets/FinanceWidgets.tsx`, o eliminar el archivo completo si ya no queda ningun export activo requerido.
- Confirmar con `rg` que no quedan imports activos a esos widgets.
- No borrar referencias historicas en documentos de auditoria salvo que estorben el build.
- Verificacion: TypeScript + build.
- Pausa para aprobacion.

### Step 11: Gaps aprobados para esta ronda

Implementar uno por uno:

1. `BudgetVarianceBars`.
2. `PatrimonioComposicionWidget`.

`RecurringCommitmentsStrip` y `CreditPressureTimeline` quedan explicitamente fuera de esta fase.

Cada widget aprobado debe ser un step independiente con consulta previa de `chart-visualization`, verificacion tecnica y captura.

### Step 12: QA final responsive y accesibilidad

- Revisar keyboard/focus de tabs.
- Confirmar `aria-selected`, `role="tablist"`, `role="tab"`, `role="tabpanel"`.
- Revisar estados vacios en cada tab.
- Verificar que no se introdujeron tokens no `--ft-*`.
- Verificacion final: TypeScript + build.
- Pausa para aprobacion final.

## 11. Criterio de aprobacion de la fase

La fase queda aprobada cuando:

- Overview cabe sin scroll en 1440x900.
- Cada tab tiene un foco conceptual claro.
- No hay widgets legacy con tokens viejos dentro del nuevo layout.
- Radar y waterfall compacto reutilizan componentes existentes.
- No se modifica logica de negocio fuera de `/dashboard`.
- Cada step fue verificado con TypeScript + build y aprobado antes de avanzar.
