# Fase 3 — Plan de Implementación Paso a Paso

> Orden: componentes de **mayor riesgo visual primero** (radar hexagonal + waterfall).
> Cada paso termina con verificación automatizada + pausa para aprobación.
> Skills consultados antes de cada SVG custom: `/chart-visualization`, `/high-end-visual-design`.

---

## Reglas de ejecución

1. **Un paso a la vez.** No avanzar al siguiente sin aprobación explícita.
2. **Verificación después de cada paso:**
   ```bash
   npx tsc --noEmit && npm run build
   ```
3. **Validación visual** para Steps 3 y 4: levantar `npm run dev` y mostrar captura del componente renderizado antes de continuar.
4. **No modificar lógica de negocio** de módulos fuera de `/dashboard`.
5. **Tokens:** solo `--ft-*` en código nuevo. Migrar `--c-*` cuando se toque un archivo existente.

---

## FASE A — Utilidades SVG + Componentes de alto riesgo

### Step 1: Crear `lib/charts/svg-utils.ts`

- `[ ]` Extraer de `widgets/CashFlowChart.tsx`:
  - `smoothPath(points: Array<{x:number, y:number}>): string`
  - `controlPoint(current, previous, next, reverse?): {x, y}`
  - `formatAxisValue(value: number, preferred: 'PEN'|'USD'): string`
  - `clamp(value: number, min: number, max: number): number`
- `[ ]` Agregar nuevas utilidades:
  - `polarToCartesian(cx, cy, radius, angleDeg): {x, y}` — para el radar hexagonal
  - `hexagonPoints(cx, cy, radius, values: number[], maxValue: number): string` — genera el atributo `points` de un `<polygon>` para 6 ejes
- `[ ]` Verificar: `npx tsc --noEmit && npm run build`

**Input:** `widgets/CashFlowChart.tsx` (lectura), math pura
**Output:** `lib/charts/svg-utils.ts` (archivo nuevo, ~80 líneas)
**Riesgo:** Bajo — funciones puras sin dependencias

---

### Step 2: Crear `lib/charts/radar-score.ts` — Lógica de cálculo del HealthScore

- `[ ]` Implementar los 6 factores como funciones puras:
  - `calcSavingsScore(ingresos, egresos): number` — `savingsRate * 5`, capped 100
  - `calcCreditScore(creditUsagePct): number` — `100 - creditUsage`
  - `calcLiquidityScore(balance, egresos): number` — `min(100, (balance/egresos)*33)`
  - `calcDebtScore(totalDeuda, totalActivos): number` — **fórmula corregida**: `deuda=0 && activos=0 → 80`, `deuda>0 && activos=0 → 15`, else `clamp(100 - ratio, 0, 100)`
  - `calcDiversificationScore(uniqueAssetTypes): number` — `min(100, types*25)`
  - `calcDisciplineScore(alertas, criticalDue): number` — `clamp(100 - alertas*15 - critical*25, 0, 100)`
- `[ ]` Implementar `calcHealthScore(factors): { scores: number[], average: number, tone }` — promedio de los 6 factores
- `[ ]` Implementar `scoreTone(score)` — reutilizar lógica existente de `FinancialHealthScore.tsx`
- `[ ]` Verificar: `npx tsc --noEmit && npm run build`

**Input:** Tipos de `lib/dashboard/types.ts`
**Output:** `lib/charts/radar-score.ts` (archivo nuevo, ~70 líneas)
**Riesgo:** Bajo — lógica pura, testeable

---

### Step 3: REWRITE `FinancialHealthScore.tsx` — SVG Radar Hexagonal

> [!IMPORTANT]
> **PAUSA OBLIGATORIA** después de este paso para validación visual.

- `[ ]` Re-leer `/chart-visualization` SKILL.md (tipo `radar`) y `/high-end-visual-design` SKILL.md antes de escribir SVG
- `[ ]` Reescribir el componente completo:
  - SVG `viewBox="0 0 280 280"`, hexágono centrado en `(140, 140)`, radio `100px`
  - **Hexágono de referencia** (score "sano" = 75): `<polygon>` con stroke `var(--ft-border)`, fill `none`
  - **Polígono del usuario**: `<polygon>` con fill `color-mix(in oklch, var(--ft-primary) 14%, transparent)`, stroke `var(--ft-primary)` strokeWidth `2`
  - **6 ejes**: `<line>` desde centro a cada vértice, stroke `var(--ft-border)` opacity `0.4`
  - **Dots interactivos**: `<circle r=4>` en cada vértice del polígono, con `onMouseEnter`/`onMouseLeave` para tooltip
  - **Labels**: `<text>` en cada vértice exterior con nombre del factor + valor
  - **Score central**: `<text>` centrado con score promedio + "sobre 100"
  - **Tone pill**: badge JSX arriba del SVG
  - **Tooltip**: estado `hoveredAxis: number | null`, renderiza card posicionada cerca del dot hover
- `[ ]` Loading skeleton: hexágono placeholder con pulse animation
- `[ ]` Empty state: si no hay datos suficientes (ej: `ingresos_mes = 0 && egresos_mes = 0`), mostrar hexágono gris con mensaje
- `[ ]` Migrar todos los tokens a `--ft-*`
- `[ ]` Verificar: `npx tsc --noEmit && npm run build`
- `[ ]` **Levantar `npm run dev`** y navegar a `/dashboard` para validación visual
- `[ ]` **PAUSAR — esperar aprobación visual del usuario**

**Input:** `lib/charts/svg-utils.ts`, `lib/charts/radar-score.ts`, datos de SWR existentes
**Output:** `components/dashboard/FinancialHealthScore.tsx` (rewrite completo, ~280 líneas)
**Riesgo:** ALTO — SVG custom con interactividad, posicionamiento de labels, responsive

---

### Step 4: Crear `CashFlowProjectionWidget.tsx` + endpoint `/api/dashboard/projection`

> [!IMPORTANT]
> **PAUSA OBLIGATORIA** después de este paso para validación visual.

#### Sub-step 4a: Endpoint `/api/dashboard/projection`

- `[ ]` Crear `app/api/dashboard/projection/route.ts`
- `[ ]` Query 1: Recurrentes activas del usuario (`recurring_transactions` where `is_active = true`)
- `[ ]` Query 2: Cuentas por cobrar con `dueDate` en próximos 90 días
- `[ ]` Query 3: Cuentas por pagar con `dueDate` en próximos 90 días
- `[ ]` Query 4: Cuotas de crédito con `dueDate` en próximos 90 días
- `[ ]` Query 5: Balance consolidado actual (reutilizar `fn_dashboard_summary`)
- `[ ]` Calcular `projectionPoints[]`: iterar día por día, acumular inflows/outflows, calcular balance proyectado
- `[ ]` Asignar `confidence`: `1.0` para 0-30D, `0.8` para 31-60D, `0.6` para 61-90D
- `[ ]` Response tipada con `currentBalance`, `recurringMonthlyExpense`, `recurringMonthlyIncome`, `projectionPoints[]`
- `[ ]` Verificar: `npx tsc --noEmit && npm run build`

#### Sub-step 4b: Widget `CashFlowProjectionWidget.tsx`

- `[ ]` Re-leer `/chart-visualization` SKILL.md (tipo `waterfall`) y `/high-end-visual-design` SKILL.md antes de escribir SVG
- `[ ]` Crear componente SVG custom:
  - `viewBox` dinámico basado en `projectionPoints.length`
  - **Eje X**: fechas agrupadas por semana (no por día — demasiado denso). Labels cada 7 días
  - **Eje Y**: rango automático basado en `min/max` del balance proyectado
  - **Línea vertical "HOY"**: `<line>` punteada con label "Hoy"
  - **Bloques waterfall**: `<rect>` por cada agrupación semanal. Verde (inflows netos) o rojo (outflows netos). Cada rect empieza donde terminó el anterior
  - **Línea de balance proyectado**: `smoothPath()` sobre los puntos de `projectedBalance`
  - **Confidence bands**: `<path>` con fill = `--ft-primary` y opacity decreciente por horizonte (0.18 → 0.10 → 0.05)
  - **Tooltip**: hover en cada bloque muestra detalle de los conceptos que lo componen
- `[ ]` **Pills de resumen**: debajo del chart, 3 pills con balances proyectados a 30D/60D/90D con color semafórico
- `[ ]` **Pill de recurrentes**: junto al título, `"S/ X/mes en recurrentes"`
- `[ ]` Loading skeleton: rectángulos placeholder con pulse
- `[ ]` Empty state: "Sin datos suficientes para proyectar" con CTA a registrar recurrentes
- `[ ]` Verificar: `npx tsc --noEmit && npm run build`
- `[ ]` **Levantar `npm run dev`** y navegar a `/dashboard` — montar temporalmente el widget para validación
- `[ ]` **PAUSAR — esperar aprobación visual del usuario**

**Input:** `/api/dashboard/projection`, `lib/charts/svg-utils.ts`, SWR
**Output:** `app/api/dashboard/projection/route.ts` (~120 líneas), `components/dashboard/CashFlowProjectionWidget.tsx` (~350 líneas)
**Riesgo:** ALTO — endpoint nuevo + SVG complejo con waterfall + confidence bands

---

## FASE B — Rewrite de widgets existentes

> No empezar hasta que Steps 3 y 4 estén aprobados visualmente.

### Step 5: REWRITE `MoneyFlowChart.tsx` — Barras duales + línea neta

- `[ ]` Eliminar toggle "acumulado/mensual". Solo modo "mensual"
- `[ ]` Reemplazar `AreaChart` por `ComposedChart` con:
  - `<Bar dataKey="ingresos">` con fill `var(--ft-primary)`, radius `[4,4,0,0]`, barSize `18`
  - `<Bar dataKey="egresos">` con fill `var(--ft-danger)`, radius `[4,4,0,0]`, barSize `18`
  - `<Line dataKey="neto">` superpuesta, strokeWidth `2`, dot solo en activeDot
- `[ ]` Nuevo tooltip vertical (no grid) con border-left coloreada
- `[ ]` Selector de período: dropdown pill 3M/6M/12M (default 6M)
- `[ ]` Migrar tokens a `--ft-*`
- `[ ]` Verificar: `npx tsc --noEmit && npm run build`

---

### Step 6: Crear `lib/charts/treemap-layout.ts` + REWRITE `EgresosCategoriasWidget.tsx`

- `[ ]` Crear algoritmo squarified treemap en `lib/charts/treemap-layout.ts`:
  - Input: `Array<{ id: string, value: number }>`, `{ width: number, height: number }`
  - Output: `Array<{ id: string, x: number, y: number, w: number, h: number }>`
  - ~40 líneas, función pura
- `[ ]` Reescribir `EgresosCategoriasWidget.tsx`:
  - Reemplazar Recharts `PieChart` por SVG treemap custom
  - Cada `<rect>` con `rx=8`, coloreado por categoría, label + monto inline
  - Toggle Ingresos/Egresos se mantiene
  - Hover: `brightness(1.08)` + tooltip con % y monto
  - Funciona con 1, 2, o N categorías sin romperse
  - Nota al pie: "3 categorías = X% del gasto" (absorbe TopCategoriesWidget)
- `[ ]` Migrar tokens a `--ft-*`
- `[ ]` Verificar: `npx tsc --noEmit && npm run build`

---

### Step 7: REWRITE `SavingsRateTrendChart.tsx` — Bullet gauge + sparkline

- `[ ]` Reemplazar Recharts `AreaChart` por:
  - **Bullet gauge SVG** horizontal (~40px alto): 3 zonas coloreadas (rojo 0-10%, amarillo 10-20%, verde 20%+), marcador triangular en rate actual, referencia 20% con label "Meta"
  - **Sparkline SVG** (6 dots + línea, ~32px alto): dots colorizados por zona (rojo/amarillo/verde)
- `[ ]` Click en dot de sparkline → mini-card con mes, rate, ingreso, egreso
- `[ ]` Migrar tokens a `--ft-*`
- `[ ]` Verificar: `npx tsc --noEmit && npm run build`

---

### Step 8: REWRITE `SaldosDiaChart.tsx` — Range bars

- `[ ]` Reemplazar SVG area chart por range bar chart:
  - Cada día = barra vertical mostrando rango [min, max] con dot central para cierre
  - Fallback a dot plot si solo hay datos de cierre
- `[ ]` Rediseñar selector de período como segmented control con background animado (translateX)
- `[ ]` Agregar línea de promedio punteada con label inline
- `[ ]` Migrar tokens a `--ft-*`
- `[ ]` Verificar: `npx tsc --noEmit && npm run build`

---

## FASE C — Nuevos componentes e infraestructura

### Step 9: Crear endpoint `/api/dashboard/alerts` + `AlertBanner.tsx`

- `[ ]` Crear `app/api/dashboard/alerts/route.ts`:
  - Query cuotas vencidas, payables vencidas, presupuestos >100%, vencimientos DUE_SOON
  - Response: `{ criticalCount, alerts[] }`
- `[ ]` Crear `components/dashboard/AlertBanner.tsx`:
  - Banner full-width condicional (se oculta si criticalCount = 0)
  - Drawer inline expandible (no modal)
  - Animación de entrada `translateY(-100%) → 0`
  - Reutiliza lógica de sorting de `widgets/AlertsWidget.tsx`
- `[ ]` Verificar: `npx tsc --noEmit && npm run build`

---

### Step 10: REWRITE `DashboardHeader.tsx` — Command Strip (4 KPI tiles)

- `[ ]` Reescribir de hero card a 4 tiles en `grid grid-cols-2 lg:grid-cols-4 gap-3`
- `[ ]` Tile 1 — Patrimonio Neto: número + micro area chart de fondo (SVG inline, height 40px, opacity 0.12)
- `[ ]` Tile 2 — Ingresos: número + delta pill + bullet bar horizontal (vs mes anterior)
- `[ ]` Tile 3 — Egresos: número + delta pill + bullet bar + helper "S/ X en recurrentes" (requiere fetch a `/api/recurring`)
- `[ ]` Tile 4 — Balance Neto: número + sparkline SVG inline (smoothPath de svg-utils)
- `[ ]` Staggered entry: `translateY(12px) opacity(0)` con delay incremental
- `[ ]` Verificar: `npx tsc --noEmit && npm run build`

---

## FASE D — Integración en el grid

### Step 11: Rewrite `DashboardWorkspace.tsx` — Nuevo layout de 4 zonas

- `[ ]` Reestructurar el layout:
  - Zona 0: `<AlertBanner />` (condicional, fuera del grid principal)
  - Zona 1: `<DashboardHeader />` (Command Strip — ya reescrito)
  - Zona 2: `grid xl:grid-cols-[7fr_5fr] gap-3` con:
    - Col izquierda: `MoneyFlowChart` + `CashFlowProjectionWidget`
    - Col derecha: `FinancialHealthScore` + `VencimientosWidget` (se mantiene)
  - Zona 3: `grid md:grid-cols-2 gap-3` con: `EgresosCategoriasWidget` + `SavingsRateTrendChart`
  - Zona 4: `grid md:grid-cols-3 gap-3` con: `PresupuestosMesWidget` + `CreditosUsoRapidoWidget` + `SaldosBancariosWidget`
- `[ ]` Eliminar imports y renderizado de:
  - `MetricCards`
  - `ModulesMiniCards`
  - `DailyBalanceDeltaChart`
  - `TopCategoriesWidget`
  - `FlujoPendienteWidget` (absorbido en AlertBanner + Projection)
  - `SaldosDiaChart` (reubicado dentro de Zona 2 col izquierda, debajo de MoneyFlow — o evaluar si cabe)
- `[ ]` Verificar: `npx tsc --noEmit && npm run build`

---

### Step 12: Eliminar archivos obsoletos

- `[ ]` Eliminar `components/dashboard/MetricCards.tsx`
- `[ ]` Eliminar `components/dashboard/ModulesMiniCards.tsx`
- `[ ]` Eliminar `components/dashboard/DailyBalanceDeltaChart.tsx`
- `[ ]` Eliminar `components/dashboard/TopCategoriesWidget.tsx`
- `[ ]` Verificar que no hay imports rotos: `npx tsc --noEmit && npm run build`

---

## FASE E — Module Snapshots

### Step 13: Mejorar `CreditosUsoRapidoWidget.tsx` — Circular progress ring

- `[ ]` Reemplazar `ProgressBar` lineal por SVG `<circle>` con `stroke-dasharray`/`stroke-dashoffset`
- `[ ]` Nuevo empty state con CTA → `/credits`
- `[ ]` Migrar tokens a `--ft-*`
- `[ ]` Verificar: `npx tsc --noEmit && npm run build`

---

### Step 14: Mejorar `SaldosBancariosWidget.tsx` — Stacked horizontal bar

- `[ ]` Reemplazar lista plana por barra horizontal segmentada (cada cuenta = segmento coloreado)
- `[ ]` Labels de porcentaje por segmento
- `[ ]` Total consolidado como hero number arriba
- `[ ]` Nuevo empty state con CTA → `/portfolio`
- `[ ]` Migrar tokens a `--ft-*`
- `[ ]` Verificar: `npx tsc --noEmit && npm run build`

---

### Step 15: Mejorar `PresupuestosMesWidget.tsx` — Empty state con CTA

- `[ ]` Agregar SVG inline de budget icon para empty state
- `[ ]` CTA "Crear primer presupuesto" → `/budgets`
- `[ ]` Migrar tokens a `--ft-*`
- `[ ]` Verificar: `npx tsc --noEmit && npm run build`

---

## FASE F — Polish

### Step 16: Transversales (chartTheme, primitives, responsive, dark mode)

- `[ ]` `chartTheme.ts`: migrar `--c-*` → `--ft-*`, agregar `chartTransition` y `chartRadius`
- `[ ]` `primitives.tsx`: reemplazar hardcoded colors, agregar `EmptyWidget` con prop `action`
- `[ ]` Responsive: verificar breakpoints 1440/768/375 en todos los widgets nuevos
- `[ ]` Dark mode: verificar que ningún token hardcodeado se escape
- `[ ]` Skeletons: verificar que todos los widgets tienen loading state con structural skeleton
- `[ ]` Staggered animations: entry animations en Command Strip tiles, waterfall blocks
- `[ ]` Verificar final: `npx tsc --noEmit && npm run build && npm run lint`
- `[ ]` **PAUSAR — validación visual completa del dashboard**

---

## Resumen de archivos por step

| Step | Archivos tocados | Tipo |
|------|-----------------|------|
| 1 | `lib/charts/svg-utils.ts` | NEW |
| 2 | `lib/charts/radar-score.ts` | NEW |
| 3 | `FinancialHealthScore.tsx` | REWRITE |
| 4a | `api/dashboard/projection/route.ts` | NEW |
| 4b | `CashFlowProjectionWidget.tsx` | NEW |
| 5 | `MoneyFlowChart.tsx` | REWRITE |
| 6 | `lib/charts/treemap-layout.ts`, `EgresosCategoriasWidget.tsx` | NEW + REWRITE |
| 7 | `SavingsRateTrendChart.tsx` | REWRITE |
| 8 | `SaldosDiaChart.tsx` | REWRITE |
| 9 | `api/dashboard/alerts/route.ts`, `AlertBanner.tsx` | NEW + NEW |
| 10 | `DashboardHeader.tsx` | REWRITE |
| 11 | `DashboardWorkspace.tsx` | REWRITE |
| 12 | `MetricCards.tsx`, `ModulesMiniCards.tsx`, `DailyBalanceDeltaChart.tsx`, `TopCategoriesWidget.tsx` | DELETE ×4 |
| 13 | `CreditosUsoRapidoWidget.tsx` | MODIFY |
| 14 | `SaldosBancariosWidget.tsx` | MODIFY |
| 15 | `PresupuestosMesWidget.tsx` | MODIFY |
| 16 | `chartTheme.ts`, `primitives.tsx`, responsive/dark | MODIFY ×2 + QA |

**Total:** 6 archivos nuevos, 8 rewrites, 4 deletes, 5 modifies = **23 operaciones en 16 steps**
