# DASHBOARD REDESIGN v2 — FinTrack

> **Fase 2 (revisada)** — Rediseño visual total del dashboard.
> Cada widget se evalúa desde cero: tipo de chart, interacción, densidad, y legibilidad.
> No es un reordenamiento; es una reconstrucción de la experiencia visual.

---

## Skills aplicados

| Skill | Criterio extraído |
|-------|-------------------|
| **design-taste-frontend** | VISUAL_DENSITY=4 (Daily App), MOTION_INTENSITY=6 (Fluid CSS), monospace `tabular-nums` para cifras, empty/loading/error states obligatorios, no donut cuando `categories < 3`, spring physics en transiciones |
| **high-end-visual-design** | Double-bezel card architecture (outer shell + inner core = PremiumCard ya lo implementa), eyebrow tags para labels, `cubic-bezier(0.32,0.72,0,1)` para transiciones, staggered entry animations |
| **gpt-taste** | Zero empty cells en grids (`grid-auto-flow: dense`), card restraint (3-5 cards max por fila), massive section spacing (`gap-6`), no meta-labels genéricos |
| **impeccable** | Cards solo cuando la elevación comunica jerarquía. Varied spacing for rhythm. No nested cards. OKLCH color space. Ease-out exponential curves (quart/quint). No side-stripe borders |
| **chart-visualization** | Waterfall para flujo proyectado, dual-axes para income vs expense, treemap para distribución jerárquica, radar para multi-dimensional scoring, liquid para progress gauges |
| **mercury-ui** | `tabular-nums` en toda cifra, `13px` default border-radius, 4px grid spacing, pill-shaped toggles con `21px+` radius |
| **linear-ui** | `6px`/`8px` border-radius para elementos compactos, `ease-out` en entrances `≤200ms`, structural skeletons |

---

## Auditoría de widgets muertos en `widgets/`

> [!IMPORTANT]
> Estos 4 archivos existen en `components/dashboard/widgets/` pero **ninguno se monta** en `DashboardWorkspace.tsx`. Auditoría completa de cada uno:

### 1. [CashFlowChart.tsx](file:///Users/eliasgustavopacopauccara/Documents/Fintrack_v1/fintrack/components/dashboard/widgets/CashFlowChart.tsx) (386 líneas)

**Qué hace:** SVG puro (sin Recharts) que renderiza un line chart con smooth Bézier curves. Soporta dos fuentes de datos: `CashFlowPoint[]` (mensual) y `DailyFlowPoint[]` (diario). Incluye range selector (5D/1M/3M/6M/1Y), tooltip flotante tipo badge, y resumen de ingresos/egresos totales.

**Lógica reutilizable:**
- La función `smoothPath()` (Bézier cúbico) y `controlPoint()` — matemática de curvas que produce trazos más orgánicos que el `monotone` de Recharts.
- `formatAxisValue()` — formateador compacto (1k, 1.2M) para ejes.
- El pattern de `hitWidth` para zonas de hover accesibles en SVG.

**Decisión:** **DESCARTAR el componente, REUTILIZAR `smoothPath` y `formatAxisValue`**. El SVG puro tiene valor técnico pero el componente duplica funcionalidad con `SaldosDiaChart` y el selector de rango. Las funciones de utilidad se extraen a un archivo `lib/charts/svg-utils.ts`.

---

### 2. [ReceivablesPayablesWidget.tsx](file:///Users/eliasgustavopacopauccara/Documents/Fintrack_v1/fintrack/components/dashboard/widgets/ReceivablesPayablesWidget.tsx) (201 líneas)

**Qué hace:** Widget "Posición neta" con dos columnas (cobrar vs pagar). Muestra balance neto pendiente como hero number, y top 3 items por urgencia en cada columna con `UrgencyBadge`.

**Lógica reutilizable:**
- El cálculo de `netPen = rec.totalPendingPen - pay.totalPendingPen` y la presentación visual de posición neta (positiva vs negativa).
- El componente `Half` con pattern de items urgentes.

**Decisión:** **ABSORBER en el nuevo widget de Proyección de Flujo**. La posición neta (cobrar-pagar) se convierte en un dato de input para la proyección forward. Los items urgentes se absorben en el Alert Banner. El componente se **DESCARTA**.

---

### 3. [FinanceWidgets.tsx](file:///Users/eliasgustavopacopauccara/Documents/Fintrack_v1/fintrack/components/dashboard/widgets/FinanceWidgets.tsx) (309 líneas)

**Qué hace:** Tres widgets independientes exportados:
- `AccountsWidget` — lista de cuentas con total consolidado y `MoneyRow` por cuenta.
- `CreditsWidget` — uso global de crédito con `ProgressBar` + tarjetas individuales con `UTILIZATION_COLORS`.
- `AssetsWidget` — valor total de activos con desglose por tipo (`REAL_ESTATE`, `VEHICLE`, etc.) usando `ProgressBar`.

**Lógica reutilizable:**
- `UTILIZATION_COLORS()` — función de threshold cromático (verde → amarillo → naranja → rojo) basada en porcentaje de uso. Útil para el nuevo FinancialHealthScore.
- `ASSET_TYPE_LABELS` y `ASSET_TYPE_COLORS` — mapeos de tipo a etiqueta/color para activos.
- El pattern de `SkeletonRows` como loader genérico.

**Decisión:** **DESCARTAR los widgets, REUTILIZAR las constantes y `UTILIZATION_COLORS`**. Los datos de activos y créditos se integran como factores en el nuevo FinancialHealthScore (diversificación de activos, ratio de endeudamiento). AccountsWidget se reemplaza por el `SaldosBancariosWidget` existente que ya está activo y tiene mejor diseño.

---

### 4. [ExpenseBreakdown.tsx](file:///Users/eliasgustavopacopauccara/Documents/Fintrack_v1/fintrack/components/dashboard/widgets/ExpenseBreakdown.tsx) (168 líneas)

**Qué hace:** Donut SVG puro (no Recharts) + lista de categorías con `ProgressBar`. Similar a `EgresosCategoriasWidget` pero usa primitivos diferentes (`WidgetShell` vs `PremiumCard`).

**Lógica reutilizable:**
- El `DonutChart` SVG puro con cálculo de segmentos (`strokeDasharray`/`strokeDashoffset`) — más ligero que Recharts PieChart.
- El fallback visual para `total === 0`.

**Decisión:** **DESCARTAR completamente**. Es una versión anterior de `EgresosCategoriasWidget` con peor diseño. La lógica de donut SVG no se necesita porque vamos a reemplazar el donut por un treemap.

---

## Proposed Changes — Rediseño visual widget por widget

---

### ZONA 0 — Alert Banner (condicional)

#### [NEW] `/api/dashboard/alerts` endpoint

**Endpoint dedicado** que agrega alertas críticas de múltiples fuentes:

```typescript
// Fuentes de datos:
// 1. Cuotas de crédito vencidas (urgency = OVERDUE)
// 2. Cuentas por pagar vencidas
// 3. Presupuestos excedidos (>100%)
// 4. Vencimientos hoy/mañana (urgency = DUE_SOON)

// Response:
{
  criticalCount: number
  alerts: Array<{
    id: string
    type: 'installment' | 'receivable' | 'payable' | 'budget_exceeded'
    label: string
    amount: number
    currency: 'PEN' | 'USD'
    dueDate: string | null
    urgency: 'OVERDUE' | 'DUE_SOON'
    href: string
  }>
}
```

**No sobrecarga `/api/dashboard/sidebar`**. Es una query separada y ligera que solo filtra items con urgencia crítica.

#### [NEW] `AlertBanner.tsx`

**Reutiliza** la lógica de normalización de `widgets/AlertsWidget.tsx` (el sorting por urgencia, el tipo unificado `AlertItem`), pero con diseño completamente nuevo:

**Diseño visual:**
- **No es un widget-card.** Es un banner horizontal `full-width` que aparece *encima* del grid, fuera de cualquier `PremiumCard`.
- Fondo: `color-mix(in oklch, var(--ft-danger) 5%, var(--ft-surface))` con borde inferior `1px solid color-mix(in oklch, var(--ft-danger) 18%, transparent)`.
- Icono de alerta (Phosphor `Warning` weight `fill`) a la izquierda, texto condensado: "**3 vencimientos críticos** por S/ 2,450 requieren atención".
- Click expande un drawer inline (no modal) con la lista completa.
- Animación de entrada: `translateY(-100%) → translateY(0)` con `cubic-bezier(0.32,0.72,0,1)` en 400ms.
- **Se oculta completamente** si `criticalCount === 0`.

---

### ZONA 1 — Command Strip (4 KPI cards)

#### [MODIFY] [DashboardHeader.tsx](file:///Users/eliasgustavopacopauccara/Documents/Fintrack_v1/fintrack/components/dashboard/DashboardHeader.tsx)

**Rediseño total**: de hero card monolítico a **4 KPI tiles** con microcharts integrados.

**Grid:** `grid grid-cols-2 lg:grid-cols-4 gap-3`

| Tile | Visualización actual | **Nueva visualización** | Razón del cambio |
|------|---------------------|-------------------------|-------------------|
| **Patrimonio Neto** | Número grande en hero | **Número + micro area chart** (últimos 6 meses) integrado como fondo del tile (height 40px, opacity 0.12). El número flota sobre el area chart con posición absoluta. | El patrimonio necesita contexto temporal. Un número aislado no dice si va subiendo o bajando. El area chart de fondo da esa lectura instantánea sin ocupar espacio. |
| **Ingresos del Mes** | Número en MetricCards | **Número + delta pill + horizontal bullet bar** mostrando progreso vs mes anterior (barra de fondo = mes anterior, barra activa = mes actual). Si supera al anterior, la barra activa sobresale con overflow visible. | Los bullets bars son superiores a los delta percentages para comparar dos magnitudes absolutas de un vistazo. |
| **Egresos del Mes** | Número en MetricCards | **Número + delta pill + horizontal bullet bar** (mismo pattern que ingresos pero con tono `--ft-danger`). Incluye: `"S/ X en recurrentes programados"` como línea de helper text debajo del número. | **Integra el indicador de recurrentes** directamente en el KPI de egresos, donde tiene contexto natural. |
| **Balance Neto del Mes** | Sparkline en hero | **Número + inline sparkline SVG** (últimos 6 valores mensuales). La sparkline usa `smoothPath()` reutilizado de `CashFlowChart.tsx`. Punto final con dot activo. Color dinámico: `--ft-primary` si positivo, `--ft-danger` si negativo. | La sparkline se mantiene porque es la mejor micro-visualización para tendencia en espacio mínimo, pero se rediseña: de Recharts pesado a SVG inline ultra ligero. |

**Diseño de cada tile:**
- `PremiumCard` con `innerClassName="p-4"` (más compacto que p-5/p-6 de widgets principales).
- Label: eyebrow tag `text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ft-text-subtle)]`.
- Valor: `text-[1.5rem] font-semibold tabular-nums tracking-[-0.03em] text-[var(--ft-text)]`.
- Delta pill: `rounded-full px-2 py-0.5 text-[10px] font-bold` con colores según tono.
- **Staggered entry**: cada tile entra con `translateY(12px) opacity(0) → translateY(0) opacity(1)` con `delay` incremental de `80ms * index`.

**Eliminaciones confirmadas:**
- ❌ `MetricCards.tsx` — absorbido aquí.
- ❌ `ModulesMiniCards.tsx` — redundante con Zona 4.

---

### ZONA 2 — Operational Core

**Grid:** `grid grid-cols-1 xl:grid-cols-[7fr_5fr] gap-3`

---

#### [MODIFY] [MoneyFlowChart.tsx](file:///Users/eliasgustavopacopauccara/Documents/Fintrack_v1/fintrack/components/dashboard/MoneyFlowChart.tsx)

| Aspecto | Actual | **Rediseño** |
|---------|--------|-------------|
| **Tipo de chart** | `AreaChart` monotone con gradiente + líneas secundarias de ingreso/egreso en modo mensual | **Dual-axis `ComposedChart`**: barras agrupadas (ingreso = `--ft-primary`, egreso = `--ft-danger`) + línea de resultado neto superpuesta (`strokeWidth=2.5`, `dot` solo en punto activo) |
| **Razón** | El AreaChart actual funde visualmente ingresos y egresos en una sola masa cuando están en modo "acumulado". No se puede comparar la magnitud relativa de ingreso vs egreso en un punto dado. Las barras agrupadas hacen esa comparación instantánea. La línea neta sintetiza el resultado. | |
| **Toggle** | "Saldo acumulado" / "Flujo mensual" | **Se elimina el toggle**. Solo existe "Flujo mensual" con barras. El "saldo acumulado" se cubre por el KPI de patrimonio (tile 1 con area chart de fondo) y por el `SaldosDiaChart`. Eliminar el toggle reduce complejidad cognitiva. |
| **Tooltip** | Custom tooltip con grid 2×2 | **Tooltip rediseñado**: fondo `--ft-surface` con `shadow-[var(--shadow-lg)]`, esquinas `rounded-[16px]`. Muestra: **mes** (bold), **ingreso** (verde), **egreso** (rojo), **neto** (bold, con signo y color dinámico). Sin grid; layout vertical con `border-left` de 3px con el color del dato hover. |
| **Período** | Selector inline 6 meses | **Dropdown pill** con opciones 3M / 6M / 12M. Default: 6M. |
| **Animación** | `animationDuration={700} ease-out` | Barras con `animationDuration={600}` y easing `cubic-bezier(0.32,0.72,0,1)`. Entry stagger de 40ms por barra. |

**Implementación Recharts:**
```tsx
<ComposedChart>
  <Bar dataKey="ingresos" fill="var(--ft-primary)" radius={[4,4,0,0]} barSize={18} />
  <Bar dataKey="egresos"  fill="var(--ft-danger)"  radius={[4,4,0,0]} barSize={18} />
  <Line dataKey="neto" stroke="var(--ft-text)" strokeWidth={2} dot={false}
        activeDot={{ r:5, stroke:'var(--ft-surface)', strokeWidth:2 }} />
</ComposedChart>
```

---

#### [NEW] `CashFlowProjectionWidget.tsx` — Widget de Proyección a 30/60/90 días

> [!IMPORTANT]
> Este es el widget nuevo más significativo del rediseño. Combina 4 fuentes de datos para proyectar flujo futuro.

#### [NEW] `/api/dashboard/projection` endpoint

**Fuentes de datos combinadas:**
1. **Recurrentes activas** (`recurring_transactions` where `is_active = true`) — montos programados por tipo (INCOME/EXPENSE).
2. **Cuentas por cobrar** (`receivables` con `dueDate` futuro) — inflows esperados.
3. **Cuentas por pagar** (`payables` con `dueDate` futuro) — outflows esperados.
4. **Cuotas de crédito** (`credit_installments` con `dueDate` futuro) — outflows fijos.

**Response:**
```typescript
{
  currentBalance: number           // saldo consolidado actual
  recurringMonthlyExpense: number  // total recurrentes tipo EXPENSE del mes
  recurringMonthlyIncome: number   // total recurrentes tipo INCOME del mes
  projectionPoints: Array<{
    date: string                   // ISO date
    horizon: '30D' | '60D' | '90D'
    projectedBalance: number       // balance proyectado acumulativo
    inflows: number                // cobros + ingresos recurrentes del día
    outflows: number               // pagos + egresos recurrentes + cuotas del día
    confidence: number             // 1.0 → 0.6 (decrece con el horizonte)
  }>
}
```

**Tipo de visualización: Waterfall + Confidence Bands**

| Aspecto | Decisión | Razón |
|---------|----------|-------|
| **Chart base** | **Waterfall chart** (SVG custom, no Recharts — Recharts no tiene waterfall nativo) | El waterfall muestra cada inflow/outflow como un bloque que sube o baja desde el balance anterior. Es la forma más intuitiva de ver "¿por qué mi saldo va a cambiar?" porque cada bloque es una causa visible. |
| **Confidence bands** | Área con **opacity decreciente** alrededor de la línea de proyección. 30D = `opacity(0.18)`, 60D = `opacity(0.10)`, 90D = `opacity(0.05)`. | Comunica visualmente que la certeza decrece. No es un intervalo estadístico real (no tenemos datos para eso), sino un indicador visual honesto de que la proyección a 90 días es menos confiable que a 30. |
| **Separador visual** | Línea vertical punteada en el punto "HOY" que separa datos reales (izquierda) de proyección (derecha). | Fundamental para distinguir dato histórico de estimación. |
| **Colores** | Bloques positivos (inflows): `--ft-primary` con opacity 0.7. Bloques negativos (outflows): `--ft-danger` con opacity 0.7. Línea de balance proyectado: `--ft-accent` con stroke-dasharray para tramo futuro. | |
| **Interactividad** | Hover en cada bloque muestra tooltip con: nombre del concepto (ej: "Netflix — Recurrente"), monto, fecha, y tipo (recurrente/cobro/pago/cuota). | |
| **Resumen integrado** | Debajo del chart, 3 pills con los saldos proyectados: `30D: S/ 42,100` · `60D: S/ 38,200` · `90D: S/ 35,800`. Con color semafórico según si el balance proyectado es positivo/negativo. | |
| **Indicador de recurrentes** | Al lado del título del widget: pill con `"S/ 3,200/mes en recurrentes programados"` usando datos de `recurringMonthlyExpense`. | **Cumple el requisito 2** de integrar recurrentes. |

**Implementación SVG:** Se construye como componente SVG custom reutilizando `smoothPath()` y `formatAxisValue()` de `CashFlowChart.tsx` (las funciones de utilidad, no el componente). El waterfall usa `<rect>` para cada bloque con `<line>` conectores.

---

#### [MODIFY] [SaldosDiaChart.tsx](file:///Users/eliasgustavopacopauccara/Documents/Fintrack_v1/fintrack/components/dashboard/SaldosDiaChart.tsx)

| Aspecto | Actual | **Rediseño** |
|---------|--------|-------------|
| **Tipo de chart** | SVG area chart con gradiente, selector 5D/1M/3M/6M/1A | **Range bar chart** (estilo candlestick simplificado): cada día es una barra vertical que muestra el rango [mínimo del día, máximo del día] con un dot central para el cierre. |
| **Razón** | El area chart actual muestra una línea suave que oculta la volatilidad intradía. El range bar revela si un día tuvo mucho movimiento (barra alta) o fue tranquilo (barra baja), que es información más útil para un usuario financiero. |
| **Fallback** | Si solo hay datos de cierre (sin rango intraday), renderiza como **dot plot** con línea conectora — visualmente similar pero con dots prominentes en vez de área continua, para evitar interpolar falsamente entre puntos distantes. |
| **Selector de período** | Mismo selector pill (5D/1M/3M/6M/1A) pero rediseñado como **segmented control** con background animado que desliza al tab activo (`translateX` + `width` animados). |
| **Línea de promedio** | **NUEVO**: línea horizontal punteada mostrando el promedio del período, con label inline `"Prom: S/ 41,200"`. |

---

#### [MODIFY] [FinancialHealthScore.tsx](file:///Users/eliasgustavopacopauccara/Documents/Fintrack_v1/fintrack/components/dashboard/FinancialHealthScore.tsx)

**Rediseño total** — de radial bar + 4 progress bars a **SVG radar hexagonal** con 6 ejes.

| Aspecto | Actual | **Rediseño** |
|---------|--------|-------------|
| **Visualización** | Recharts `RadialBarChart` (score global) + 4 `HealthFactor` components con progress bars individuales | **SVG radar chart hexagonal** con 6 ejes. El polígono del usuario se superpone a un hexágono de referencia (score "sano"). Los 6 ejes se etiquetan en los vértices. El score numérico aparece centrado dentro del hexágono. |
| **Factores** | 4: Ahorro (35pts), Crédito (25pts), Alertas (20pts), Pendiente (20pts) | **6 factores** (normalizados a 0-100 cada uno, promedio = score global): |

**Los 6 factores del radar:**

| Eje | Cálculo | Fuente de datos |
|-----|---------|-----------------|
| **Ahorro** | `savingsRate * 5` (capped 100). Rate = `(ingresos - egresos) / ingresos * 100` | `summary.ingresos_mes`, `summary.egresos_mes` |
| **Crédito** | `100 - creditUsage` (invertido: menor uso = mejor score) | `modules.creditos_uso_pct` |
| **Liquidez** | `min(100, (balanceConsolidado / egresosMes) * 33)`. Mide meses de runway. 3+ meses = 100. | `summary.balance_consolidado`, `summary.egresos_mes` |
| **Deuda** | `100 - debtToAssetRatio`. Ratio = `totalDeuda / totalActivos * 100`. Sin activos → 50 neutral. | **NUEVO**: requiere `modules.creditos_uso_total` + `modules.activos.total_soles` |
| **Diversificación** | `min(100, uniqueAssetTypes * 25)`. 4+ tipos = 100. 0 tipos = 0. | **NUEVO**: requiere `assets.byType.length` de `AssetsWidget` data |
| **Disciplina** | `100 - (alertasPendientes * 15) - (criticalDueCount * 25)`. Penaliza alertas y vencimientos críticos. | `summary.alertas_pendientes`, `sidebar.vencimientos_proximos` |

**Diseño visual del radar:**
- SVG `viewBox="0 0 280 280"`, hexágono centrado en `(140, 140)`, radio 100px.
- **Hexágono de referencia** (score "sano"): stroke `--ft-border`, fill `none`, valor = 75 en cada eje.
- **Polígono del usuario**: fill `color-mix(in oklch, var(--ft-primary) 14%, transparent)`, stroke `var(--ft-primary)` strokeWidth `2`.
- **Dots** en cada vértice del polígono del usuario: `r=4`, fill `var(--ft-surface)`, stroke `var(--ft-primary)`.
- **Labels** en cada vértice exterior: `text-[10px] font-semibold` con el nombre del factor + valor numérico debajo en `text-[9px] tabular-nums`.
- **Score central**: `text-[2.2rem] font-semibold tabular-nums` + label "sobre 100" en `text-[9px]`.
- **Tone pill** (arriba del radar): "Salud sólida" / "Atención moderada" / "Presión financiera" con colores semafóricos.

**Tooltip al hover sobre un vértice:** card pequeña con el nombre del factor, el valor numérico, y una explicación de una línea (ej: "Tasa de ahorro del 24.3% del ingreso mensual").

**No usa Recharts RadarChart** — es SVG custom porque Recharts radar no soporta: hexágono de referencia superpuesto, dots interactivos individuales por vértice, ni el label layout que necesitamos.

---

### ZONA 3 — Analysis Layer

**Grid:** `grid grid-cols-1 md:grid-cols-2 gap-3`

> [!IMPORTANT]
> Se reduce de 3 columnas a 2. `TopCategoriesWidget` se fusiona con `EgresosCategoriasWidget` como un solo widget más rico. El espacio liberado lo toma el `SavingsRateTrendChart` con más respiro.

---

#### [MODIFY] [EgresosCategoriasWidget.tsx](file:///Users/eliasgustavopacopauccara/Documents/Fintrack_v1/fintrack/components/dashboard/EgresosCategoriasWidget.tsx)

| Aspecto | Actual | **Rediseño** |
|---------|--------|-------------|
| **Tipo de chart** | Recharts `PieChart` (donut) + lista de categorías con progress bars | **Treemap SVG** con rectángulos proporcionales al gasto, coloreados por la categoría. Cada rectángulo muestra nombre + monto inline. |
| **Razón** | El donut tiene 3 problemas: (1) se rompe visualmente con `< 3` categorías, (2) los humanos somos malos comparando ángulos — los estudios de Cleveland/McGill demuestran que comparamos longitudes y áreas rectangulares con mucha más precisión, (3) el donut necesita una lista separada para ser legible (redundancia visual). El treemap resuelve los 3 problemas: funciona con 1 categoría, las áreas rectangulares son comparables instantáneamente, y los labels van *dentro* de los rectángulos. |
| **Integra ranking** | No | **SÍ**: los rectángulos se ordenan de mayor a menor (squarified layout). El más grande = categoría top. Esto absorbe completamente la función de `TopCategoriesWidget`. La "concentración top 3" se muestra como nota al pie (ej: "3 categorías = 78% del gasto"). |
| **Toggle Ingresos/Egresos** | Existe, se mantiene | Se mantiene con el mismo diseño de segmented control pill. |
| **Hover** | Recharts Tooltip genérico | Cada rectángulo se ilumina (`brightness(1.08)`) al hover, y muestra tooltip con % y monto. |
| **Pocos datos** | Se rompe | Con 1 categoría: rectángulo único al 100% con label centrado. Con 2: split horizontal. Siempre funciona. |

**Implementación:** Treemap layout se calcula con el algoritmo squarified (implementado como función pura, ~40 líneas). Renderizado como `<svg>` con `<rect>` + `<text>` por nodo. Cada rect usa `rx=8` para esquinas redondeadas.

---

#### [DELETE] [TopCategoriesWidget.tsx](file:///Users/eliasgustavopacopauccara/Documents/Fintrack_v1/fintrack/components/dashboard/TopCategoriesWidget.tsx)

**Absorbido** completamente en el treemap de EgresosCategoriasWidget. El ranking visual ahora es inherente al tamaño de cada rectángulo en el treemap. La métrica de "concentración top 3" se mantiene como texto debajo del treemap.

---

#### [MODIFY] [SavingsRateTrendChart.tsx](file:///Users/eliasgustavopacopauccara/Documents/Fintrack_v1/fintrack/components/dashboard/SavingsRateTrendChart.tsx)

| Aspecto | Actual | **Rediseño** |
|---------|--------|-------------|
| **Tipo de chart** | Recharts `AreaChart` con gradiente + `ReferenceLine` a 20% | **Bullet gauge horizontal** (principal) + **sparkline de 6 meses** (secundario). |
| **Razón** | El AreaChart usa demasiado espacio vertical (220px) para mostrar un solo dato (porcentaje). La información clave es: "¿estoy por encima o debajo del 20%?". Un bullet gauge responde esa pregunta en 40px de alto. La sparkline de tendencia (6 puntos) se agrega debajo en 32px para mantener el contexto temporal. Total: ~90px vs 220px actuales. |
| **Bullet gauge** | N/A | Barra horizontal con 3 zonas: rojo (0-10%), amarillo (10-20%), verde (20%+). Marcador tipo flecha/triángulo en la posición del rate actual. Label numérico al lado derecho. Referencia de 20% como línea vertical prominente con label "Meta". |
| **Sparkline** | N/A | 6 dots + línea conectora (SVG inline). Cada dot colorizado: rojo si `< 10%`, amarillo si `10-20%`, verde si `> 20%`. |
| **Tooltip** | Custom tooltip con ingreso/egreso | Click en un dot de la sparkline muestra mini-card con mes, rate, ingreso y egreso de ese mes. |

---

### ZONA 4 — Module Snapshots

**Grid:** `grid grid-cols-1 md:grid-cols-3 gap-3`

Se mantienen los 3 widgets actuales (`PresupuestosMesWidget`, `CreditosUsoRapidoWidget`, `SaldosBancariosWidget`) pero con mejoras de empty state y tokens.

#### [MODIFY] [PresupuestosMesWidget.tsx](file:///Users/eliasgustavopacopauccara/Documents/Fintrack_v1/fintrack/components/dashboard/PresupuestosMesWidget.tsx)

- **Nuevo empty state**: ilustración minimalista (SVG inline de un budget icon) + "Crear primer presupuesto" como botón con `href="/budgets"`.
- Migrar tokens a `--ft-*`.

#### [MODIFY] [CreditosUsoRapidoWidget.tsx](file:///Users/eliasgustavopacopauccara/Documents/Fintrack_v1/fintrack/components/dashboard/CreditosUsoRapidoWidget.tsx)

- **Visualización mejorada**: reemplazar `ProgressBar` lineal por **circular progress ring** (SVG `<circle>` con `stroke-dasharray`) para el uso global. Más impactante visualmente y usa mejor el espacio cuadrado del card.
- **Nuevo empty state**: "Registrar línea de crédito" → `/credits`.

#### [MODIFY] [SaldosBancariosWidget.tsx](file:///Users/eliasgustavopacopauccara/Documents/Fintrack_v1/fintrack/components/dashboard/SaldosBancariosWidget.tsx)

- **Visualización mejorada**: reemplazar la lista plana por **stacked horizontal bar** mostrando la distribución del portafolio como un segmented bar. Cada segmento coloreado por la cuenta, con labels de porcentaje. Total consolidado como hero number arriba.
- **Nuevo empty state**: "Agregar portafolio" → `/portfolio`.

---

### Cambios transversales

#### [MODIFY] [chartTheme.ts](file:///Users/eliasgustavopacopauccara/Documents/Fintrack_v1/fintrack/components/dashboard/chartTheme.ts)

- Migrar todas las referencias `--c-*` a `--ft-*`.
- Agregar `chartTransition: 'cubic-bezier(0.32,0.72,0,1)'` como easing default.
- Agregar `chartRadius: { bar: [4,4,0,0], pill: [8,8,8,8] }` para consistencia de bordes en barras.

#### [MODIFY] [primitives.tsx](file:///Users/eliasgustavopacopauccara/Documents/Fintrack_v1/fintrack/components/dashboard/primitives.tsx)

- Reemplazar colores hardcodeados: `'#C14554'` → `var(--ft-danger)`, `'#B88435'` → `var(--ft-warning)`, `'#3F68A7'` → `var(--ft-info)`.
- Agregar nuevo primitivo `EmptyWidget` con prop `action: { label, href }` para CTAs en empty states.

#### [NEW] `lib/charts/svg-utils.ts`

Extraer de `CashFlowChart.tsx`:
- `smoothPath(points)` — Bézier cúbico smooth.
- `controlPoint(current, previous, next, reverse)` — puntos de control.
- `formatAxisValue(value, preferred)` — formateador compacto para ejes.
- `clamp(value, min, max)` — utilidad numérica.

#### [NEW] `lib/charts/treemap-layout.ts`

Algoritmo squarified treemap layout (~40 líneas). Input: `Array<{ id, value }>` + `{ width, height }`. Output: `Array<{ id, x, y, w, h }>`.

---

### Eliminaciones confirmadas

| Archivo | Acción | Razón |
|---------|--------|-------|
| `MetricCards.tsx` | **DELETE** | Absorbido en Command Strip tiles |
| `ModulesMiniCards.tsx` | **DELETE** | Redundante con Module Snapshots (Zona 4) |
| `DailyBalanceDeltaChart.tsx` | **DELETE** | Redundante con SaldosDiaChart rediseñado |
| `TopCategoriesWidget.tsx` | **DELETE** | Absorbido en treemap de EgresosCategoriasWidget |
| `widgets/CashFlowChart.tsx` | **KEEP (dead)** | No se monta, pero `smoothPath`/`formatAxisValue` se extraen a `svg-utils.ts` |
| `widgets/ReceivablesPayablesWidget.tsx` | **KEEP (dead)** | No se monta, datos absorbidos en Projection widget |
| `widgets/FinanceWidgets.tsx` | **KEEP (dead)** | No se monta, `UTILIZATION_COLORS` se reutiliza |
| `widgets/ExpenseBreakdown.tsx` | **KEEP (dead)** | No se monta, descartado completamente |

---

### Resumen de archivos

| Acción | Archivo | Cambio visual |
|--------|---------|---------------|
| **NEW** | `AlertBanner.tsx` | Banner condicional con drawer inline |
| **NEW** | `CashFlowProjectionWidget.tsx` | Waterfall + confidence bands (SVG custom) |
| **NEW** | `/api/dashboard/alerts/route.ts` | Endpoint dedicado para alertas críticas |
| **NEW** | `/api/dashboard/projection/route.ts` | Endpoint de proyección 30/60/90 días |
| **NEW** | `lib/charts/svg-utils.ts` | Utilidades SVG reutilizables |
| **NEW** | `lib/charts/treemap-layout.ts` | Algoritmo squarified treemap |
| **REWRITE** | `DashboardHeader.tsx` | Hero card → 4 KPI tiles con microcharts |
| **REWRITE** | `MoneyFlowChart.tsx` | AreaChart → dual-axis bars + line |
| **REWRITE** | `FinancialHealthScore.tsx` | Radial bar → SVG radar hexagonal con 6 ejes |
| **REWRITE** | `EgresosCategoriasWidget.tsx` | Donut → Treemap (absorbe TopCategories) |
| **REWRITE** | `SavingsRateTrendChart.tsx` | AreaChart → Bullet gauge + sparkline |
| **REWRITE** | `SaldosDiaChart.tsx` | Area → Range bar (candlestick simplificado) |
| **MODIFY** | `DashboardWorkspace.tsx` | Nuevo grid de 4 zonas, integra Alert + Projection |
| **MODIFY** | `CreditosUsoRapidoWidget.tsx` | ProgressBar → Circular progress ring |
| **MODIFY** | `SaldosBancariosWidget.tsx` | Lista → Stacked horizontal bar |
| **MODIFY** | `PresupuestosMesWidget.tsx` | Empty state con CTA |
| **MODIFY** | `chartTheme.ts` | Estandarizar tokens + agregar easing/radius |
| **MODIFY** | `primitives.tsx` | Eliminar hardcoded colors, agregar EmptyWidget CTA |
| **DELETE** | `MetricCards.tsx` | Absorbido |
| **DELETE** | `ModulesMiniCards.tsx` | Redundante |
| **DELETE** | `DailyBalanceDeltaChart.tsx` | Redundante |
| **DELETE** | `TopCategoriesWidget.tsx` | Absorbido en treemap |

---

### Responsive behavior

| Viewport | Zona 1 | Zona 2 | Zona 3 | Zona 4 |
|----------|--------|--------|--------|--------|
| **≥1280px** | 4 cols | 7fr/5fr | 2 cols | 3 cols |
| **≥768px** | 2×2 | Stack (12col) | Stack | 2+1 |
| **<768px** | Stack | Stack | Stack | Stack |

- Alert Banner: siempre full-width, texto truncado en mobile.
- Waterfall chart: simplifica a 30D only en `< 768px`, oculta confidence bands.
- Radar hexagonal: escala a `viewBox` responsive, labels se reposicionan a list debajo del hexágono en mobile.
- Treemap: respeta `ResponsiveContainer`, mínimo 200px height.

---

## Verification Plan

### Automated Tests

```bash
npm run build          # Compilación sin errores
npx tsc --noEmit       # Type check
npm run lint           # Lint
```

### Manual Verification

1. **Datos reales**: Dashboard con usuario que tiene datos en todos los módulos. Verificar que los 4 KPIs coinciden con los valores del hero card actual.
2. **Proyección**: Crear recurrentes + por cobrar + por pagar y verificar que el waterfall muestra los bloques correctos a 30/60/90 días.
3. **Radar**: Verificar que los 6 ejes calculan correctamente y el polígono se dibuja proporcionalmente.
4. **Treemap**: Verificar con 1, 2, 5, y 10+ categorías. Confirmar que no hay gaps ni overflow.
5. **Empty states**: Usuario nuevo sin datos — todos los widgets deben mostrar CTAs con links funcionales.
6. **Responsive**: 1440px, 768px, 375px.
7. **Dark mode**: Todos los tokens `--ft-*` tienen variantes dark. Ningún color hardcodeado visible.
8. **Performance**: Solo 2 endpoints nuevos (`/alerts` y `/projection`). Los 4 endpoints existentes no cambian.

### Phased Rollout

1. **Fase A**: Crear endpoints + utilidades (`alerts`, `projection`, `svg-utils`, `treemap-layout`).
2. **Fase B**: Rewrite widgets visuales (MoneyFlow, HealthScore, Egresos, Savings, SaldosDia).
3. **Fase C**: Crear widgets nuevos (AlertBanner, CashFlowProjection, Command Strip tiles).
4. **Fase D**: Integrar en DashboardWorkspace (nuevo grid, eliminar widgets obsoletos).
5. **Fase E**: Módulo Snapshots (CreditosRing, SaldosBar, empty states).
6. **Fase F**: Polish (responsive, dark mode, skeletons, staggered animations).
