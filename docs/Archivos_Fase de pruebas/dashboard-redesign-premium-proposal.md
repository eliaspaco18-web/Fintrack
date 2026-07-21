# Propuesta de rediseño premium del dashboard FinTrack

Fecha: 2026-05-17

Alcance: `components/dashboard/**` y `app/(dashboard)/dashboard/page.tsx`

Restriccion principal: no cambiar la logica de datos. La propuesta reutiliza los endpoints y contratos actuales:

- `/api/dashboard/summary`
- `/api/dashboard/money-flow?months=6&mode=acumulado|mensual`
- `/api/dashboard/saldos-dia?period=5D|1M|3M|6M|1A`
- `/api/dashboard/modules-summary`
- `/api/dashboard/sidebar`

## 0. Diagnostico rapido del dashboard actual

El dashboard ya tiene buenos datos, pero su presentacion se siente demasiado uniforme. Casi todo vive en cards similares, con jerarquia plana, dos columnas predecibles y graficos correctos pero poco memorables.

| Area actual | Que veo | Riesgo visual |
| --- | --- | --- |
| `DashboardWorkspace.tsx` | Layout de dos columnas: izquierda larga, derecha fija | El primer viewport no crea un momento principal; el usuario debe escanear demasiado |
| `DashboardHeader.tsx` | Balance consolidado y resultado mensual | El dato mas importante no domina lo suficiente |
| `MoneyFlowChart.tsx` | `LineChart` con dos lineas | Pierde profundidad financiera; no muestra delta ni contexto |
| `SaldosDiaChart.tsx` | `AreaChart` correcto | Falta promedio, banda de referencia y tooltip con insight |
| `KpiCards.tsx` y `MetricCards.tsx` | KPIs duplicados conceptualmente | Mucha repeticion de ingresos, egresos, balance |
| `EgresosCategoriasWidget.tsx` | Donut + lista simple | El donut no conversa con ranking proporcional |
| `VencimientosWidget.tsx` | Lista de vencimientos | Falta timeline visual y severidad clara |
| `widgets/*` | Segunda familia de widgets mas avanzada, pero no montada en workspace actual | Oportunidad de consolidar patrones sin tocar datos |

Direccion visual propuesta: dashboard financiero editorial y operativo, inspirado en Mercury, Brex, Stripe y Linear. Mucho aire donde importa, densidad donde se comparan datos, tarjetas con doble superficie sutil, numeros monoespaciados, acentos verdes/azules/amber/rojo solo para significado.

Referencia visual global:

- Mercury: balance principal calmado, banca sobria, foco en confianza.
- Brex: gasto por categoria, alertas accionables, ritmo corporativo.
- Stripe: tooltips ricos, graficos limpios, tarjetas con profundidad minima.
- Linear: densidad elegante, filas escaneables, microinteracciones rapidas.

## 1. Layout general

### Que cambio

Reemplazar el grid actual `xl:grid-cols-[minmax(0,1.75fr)_minmax(320px,1fr)]` por una composicion asimetrica de 12 columnas:

- Hero financiero en 8 columnas: balance consolidado, sparkline, tendencia del mes.
- Rail critico en 4 columnas: alertas por severidad y proximos vencimientos prioritarios.
- Segunda fila: flujo de dinero amplio en 7 columnas, score de salud + flujo pendiente en 5 columnas.
- Tercera fila: categorias, saldos diarios, top categorias, modulos.

Primer viewport objetivo:

- Balance principal visible sin scroll.
- Tendencia mensual visible sin scroll.
- Alertas criticas y vencimientos inmediatos visibles sin scroll.
- En desktop, el usuario debe entender "cuanto tengo, como va el mes, que requiere accion" en 5 segundos.

### Por que

Finanzas personales no se escanean como un CMS. El primer viewport debe responder tres preguntas:

1. Estoy bien o en riesgo?
2. Mi mes mejora o empeora?
3. Que debo atender ahora?

### Codigo propuesto

```tsx
// components/dashboard/DashboardWorkspace.tsx
// Reordena componentes, no cambia fetchers ni contratos.

<section className="dashboard-grid grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
  <div className="lg:col-span-8">
    <HeroBalanceCard />
  </div>

  <div className="lg:col-span-4">
    <CriticalAlertsPanel />
  </div>

  <div className="lg:col-span-7">
    <MoneyFlowAreaChart />
  </div>

  <div className="grid gap-4 lg:col-span-5">
    <FinancialHealthScore />
    <FlujoPendienteWidget />
  </div>

  <div className="lg:col-span-7">
    <SaldosDiaAreaChart />
  </div>

  <div className="lg:col-span-5">
    <CategoryDonutWithBars />
  </div>

  <div className="lg:col-span-4">
    <SavingsRateTrendChart />
  </div>

  <div className="lg:col-span-4">
    <DailyBalanceDeltaChart />
  </div>

  <div className="lg:col-span-4">
    <TopCategoriesWidget />
  </div>

  <div className="lg:col-span-8">
    <ModulesMiniCards />
  </div>

  <div className="lg:col-span-4">
    <VencimientosTimeline />
  </div>
</section>
```

### Referencia visual

Stripe dashboard: grafico principal amplio con rail contextual. Linear: grid denso pero calmado. Mercury: balance como primer objeto visual.

### Responsive mobile

En 375px:

- `HeroBalanceCard`
- `CriticalAlertsPanel`
- `MoneyFlowAreaChart`
- `FinancialHealthScore`
- `VencimientosTimeline`
- resto de widgets

La zona critica sube antes que los modulos secundarios. Tap targets minimos de 44px. No hay columnas comprimidas en mobile.

## 2. Sistema visual compartido

### Que cambio

Crear un shell premium para todas las cards del dashboard. El proyecto ya tiene tokens `--c-*`, dark mode y `editorial-card`; se puede extender sin romper estilos.

### Por que

La UI actual usa muchas cards planas. Una capa exterior tenue y una interior limpia dan sensacion de producto financiero premium sin caer en blur pesado.

### Codigo propuesto

```tsx
// components/dashboard/PremiumCard.tsx

import type { ReactNode } from 'react'

export function PremiumCard({
  children,
  className = '',
  innerClassName = '',
}: {
  children: ReactNode
  className?: string
  innerClassName?: string
}) {
  return (
    <section
      className={[
        'rounded-[24px] border border-[var(--c-border)] bg-[var(--c-surface-2)] p-1',
        'shadow-[0_1px_2px_var(--c-shadow)] transition-[border-color,box-shadow,transform]',
        'duration-200 ease-[var(--ease-out)] hover:border-[var(--c-border-hover)]',
        'hover:shadow-[0_18px_48px_color-mix(in_srgb,var(--c-shadow)_34%,transparent)]',
        'active:scale-[0.995]',
        className,
      ].join(' ')}
    >
      <div
        className={[
          'rounded-[20px] border border-[var(--c-border)] bg-[var(--c-surface)]',
          'shadow-[inset_0_1px_0_color-mix(in_srgb,var(--c-surface)_90%,white)]',
          innerClassName,
        ].join(' ')}
      >
        {children}
      </div>
    </section>
  )
}
```

### Referencia visual

Brex y Stripe: superficies sobrias con profundidad minima. Linear: hover casi invisible pero perceptible.

## 3. Graficos

### 3.1 Flujo de dinero: area chart con gradiente y tooltip enriquecido

#### Que cambio

`MoneyFlowChart.tsx` pasa de `LineChart` a `AreaChart` con:

- Gradiente bajo la curva.
- Linea principal segun modo: `saldo_acumulado` o `saldo_mensual`.
- Lineas auxiliares suaves para ingresos y egresos si el modo lo requiere.
- Tooltip custom con delta vs punto anterior.
- Dark mode usando tokens CSS en vez de colores fijos.

#### Por que

Un area chart comunica acumulacion y presion de caja mejor que una linea desnuda. El delta en tooltip responde "que cambio frente al mes anterior?" sin agregar un nuevo endpoint.

#### Codigo Recharts concreto

```tsx
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

function getDelta(series: Array<{ value: number }>, index: number) {
  const current = series[index]?.value ?? 0
  const previous = series[index - 1]?.value ?? 0
  return {
    amount: current - previous,
    pct: previous === 0 ? null : ((current - previous) / Math.abs(previous)) * 100,
  }
}

function MoneyFlowTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  const row = payload[0].payload
  const delta = row.deltaAmount ?? 0
  const isPositive = delta >= 0

  return (
    <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 shadow-[var(--shadow-md)]">
      <p className="text-[11px] font-semibold text-[var(--c-text)]">{label}</p>
      <p className="mt-1 text-[18px] font-semibold tabular-nums text-[var(--c-text)]">
        S/ {formatNumber(row.value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
        <span className="text-[var(--c-text-muted)]">Ingresos</span>
        <span className="text-right font-semibold text-[var(--c-primary)]">
          S/ {formatNumber(row.ingresos, { maximumFractionDigits: 0 })}
        </span>
        <span className="text-[var(--c-text-muted)]">Egresos</span>
        <span className="text-right font-semibold text-[var(--c-danger)]">
          S/ {formatNumber(row.egresos, { maximumFractionDigits: 0 })}
        </span>
      </div>
      <p className={isPositive ? 'mt-2 text-[11px] text-[var(--c-primary)]' : 'mt-2 text-[11px] text-[var(--c-danger)]'}>
        {isPositive ? '+' : ''}S/ {formatNumber(delta, { maximumFractionDigits: 0 })} vs mes anterior
      </p>
    </div>
  )
}

const chartData = (data?.series ?? []).map((point, index, all) => {
  const value = mode === 'mensual' ? point.saldo_mensual : point.saldo_acumulado
  const previous = index > 0
    ? mode === 'mensual'
      ? all[index - 1]!.saldo_mensual
      : all[index - 1]!.saldo_acumulado
    : value

  return {
    month: point.month,
    value,
    ingresos: point.ingresos,
    egresos: point.egresos,
    deltaAmount: value - previous,
  }
})

<ResponsiveContainer>
  <AreaChart data={chartData} margin={{ top: 16, right: 18, left: 0, bottom: 8 }}>
    <defs>
      <linearGradient id="moneyFlowGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--c-primary)" stopOpacity={0.34} />
        <stop offset="55%" stopColor="var(--c-primary)" stopOpacity={0.10} />
        <stop offset="100%" stopColor="var(--c-primary)" stopOpacity={0.00} />
      </linearGradient>
    </defs>

    <CartesianGrid
      vertical={false}
      stroke="color-mix(in srgb, var(--c-border) 76%, transparent)"
    />
    <XAxis
      dataKey="month"
      tickLine={false}
      axisLine={false}
      tick={{ fontSize: 11, fill: 'var(--c-text-muted)' }}
    />
    <YAxis
      tickLine={false}
      axisLine={false}
      width={48}
      tick={{ fontSize: 11, fill: 'var(--c-text-muted)' }}
      tickFormatter={(value: number) => `S/${formatNumber(value, { maximumFractionDigits: 0 })}`}
    />
    <Tooltip cursor={{ stroke: 'var(--c-border-hover)', strokeDasharray: '4 4' }} content={<MoneyFlowTooltip />} />
    <Area
      type="monotone"
      dataKey="value"
      stroke="var(--c-primary)"
      strokeWidth={3}
      fill="url(#moneyFlowGradient)"
      activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--c-surface)', fill: 'var(--c-primary)' }}
      animationDuration={700}
      animationEasing="ease-out"
    />
  </AreaChart>
</ResponsiveContainer>
```

#### Referencia visual

Stripe: tooltip con contexto, no solo valor. Mercury: balance/acumulado como area tranquila. Brex: delta visible para accion.

### 3.2 Saldos por dia: area chart suave con referencia de promedio

#### Que cambio

Mantener `AreaChart`, pero agregar:

- `ReferenceLine` con promedio del periodo.
- Tooltip con distancia contra promedio.
- Gradiente mas suave y grid horizontal.
- Banda visual de ingreso/egreso acumulado debajo del chart.

#### Por que

El promedio da una lectura inmediata: "estoy por encima o debajo de mi liquidez normal?".

#### Codigo Recharts concreto

```tsx
import { Area, AreaChart, ReferenceLine } from 'recharts'

const avgSaldo = points.length
  ? points.reduce((sum, point) => sum + point.saldo, 0) / points.length
  : 0

function SaldosTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  const row = payload[0].payload
  const diff = row.saldo - avgSaldo

  return (
    <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 shadow-[var(--shadow-md)]">
      <p className="text-[11px] text-[var(--c-text-muted)]">
        {new Date(`${label}T12:00:00`).toLocaleDateString('es-PE', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })}
      </p>
      <p className="mt-1 text-[18px] font-semibold tabular-nums text-[var(--c-text)]">
        S/ {formatNumber(row.saldo, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
      <p className={diff >= 0 ? 'mt-1 text-[11px] text-[var(--c-primary)]' : 'mt-1 text-[11px] text-[var(--c-danger)]'}>
        {diff >= 0 ? '+' : ''}S/ {formatNumber(diff, { maximumFractionDigits: 0 })} vs promedio
      </p>
    </div>
  )
}

<AreaChart data={points} margin={{ top: 12, right: 18, left: 0, bottom: 8 }}>
  <defs>
    <linearGradient id="dailyBalanceGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="var(--c-accent-landing)" stopOpacity={0.26} />
      <stop offset="100%" stopColor="var(--c-accent-landing)" stopOpacity={0.02} />
    </linearGradient>
  </defs>
  <CartesianGrid vertical={false} stroke="color-mix(in srgb, var(--c-border) 70%, transparent)" />
  <ReferenceLine
    y={avgSaldo}
    stroke="var(--c-warning)"
    strokeDasharray="5 5"
    label={{
      value: 'Promedio',
      position: 'insideTopRight',
      fill: 'var(--c-text-muted)',
      fontSize: 11,
    }}
  />
  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--c-text-muted)' }} />
  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--c-text-muted)' }} />
  <Tooltip content={<SaldosTooltip />} cursor={{ stroke: 'var(--c-border-hover)', strokeDasharray: '4 4' }} />
  <Area
    type="monotone"
    dataKey="saldo"
    stroke="var(--c-accent-landing)"
    strokeWidth={2.5}
    fill="url(#dailyBalanceGradient)"
  />
</AreaChart>
```

#### Referencia visual

Mercury: liquidez diaria clara. Stripe: reference line sutil para contexto analitico.

### 3.3 Egresos por categoria: donut + lista lateral con barras

#### Que cambio

El donut actual se mantiene, pero se vuelve un bloque horizontal:

- Donut a la izquierda con total en el centro.
- Lista lateral de top 5 con barras proporcionales.
- Cada fila muestra categoria, porcentaje y monto.
- En mobile: donut arriba, lista abajo.

#### Por que

Un donut solo muestra proporcion, pero no compara bien. La barra lateral permite ranking y lectura rapida.

#### Codigo Recharts concreto

```tsx
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

const items = data?.egresos_categoria ?? []
const total = items.reduce((sum, item) => sum + item.monto, 0)

<div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)] md:items-center">
  <div className="relative h-[180px]">
    <ResponsiveContainer>
      <PieChart>
        <Pie
          data={items}
          dataKey="monto"
          nameKey="name"
          innerRadius={58}
          outerRadius={78}
          paddingAngle={3}
          cornerRadius={4}
          stroke="var(--c-surface)"
          strokeWidth={3}
        >
          {items.map((entry) => (
            <Cell key={entry.category_id ?? entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number, name: string) => [
            `S/ ${formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            name,
          ]}
          contentStyle={{
            borderRadius: 14,
            border: '1px solid var(--c-border)',
            background: 'var(--c-surface)',
            color: 'var(--c-text)',
          }}
        />
      </PieChart>
    </ResponsiveContainer>
    <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
      <div>
        <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--c-text-faint)]">Total</p>
        <p className="text-[16px] font-semibold tabular-nums text-[var(--c-text)]">
          S/ {formatNumber(total, { maximumFractionDigits: 0 })}
        </p>
      </div>
    </div>
  </div>

  <div className="space-y-3">
    {items.slice(0, 5).map((item) => (
      <div key={item.category_id ?? item.name}>
        <div className="mb-1 flex items-center justify-between gap-3 text-[12px]">
          <span className="truncate font-medium text-[var(--c-text)]">{item.name}</span>
          <span className="tabular-nums text-[var(--c-text-muted)]">
            {formatNumber(item.pct, { maximumFractionDigits: 1 })}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--c-surface-2)]">
          <div
            className="h-full rounded-full transition-[width] duration-700 ease-[var(--ease-out)]"
            style={{ width: `${Math.max(4, item.pct)}%`, backgroundColor: item.color }}
          />
        </div>
      </div>
    ))}
  </div>
</div>
```

#### Referencia visual

Brex: expense intelligence, ranking visual y color semantico.

### 3.4 Grafico nuevo 1: tasa de ahorro mensual

#### Que agrega

Nuevo widget derivado de `MoneyFlowPoint`:

`tasa_ahorro = (ingresos - egresos) / ingresos`

No requiere endpoint nuevo. Usa la serie de `moneyFlow`.

#### Por que aporta valor real

El balance puede subir por ingresos altos, pero la tasa de ahorro muestra disciplina financiera. Para finanzas personales, es una metrica mas accionable que solo "ingresos vs egresos".

#### Codigo Recharts concreto

```tsx
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const savingsData = (moneyFlow?.series ?? []).map((point) => ({
  month: point.month,
  savingsRate: point.ingresos > 0
    ? ((point.ingresos - point.egresos) / point.ingresos) * 100
    : 0,
  ingresos: point.ingresos,
  egresos: point.egresos,
}))

<ResponsiveContainer height={220}>
  <AreaChart data={savingsData} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
    <defs>
      <linearGradient id="savingsRateGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--c-primary)" stopOpacity={0.24} />
        <stop offset="100%" stopColor="var(--c-primary)" stopOpacity={0.02} />
      </linearGradient>
    </defs>
    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--c-text-muted)' }} />
    <YAxis tickFormatter={(value) => `${value}%`} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--c-text-muted)' }} />
    <ReferenceLine y={20} stroke="var(--c-warning)" strokeDasharray="4 4" />
    <Tooltip
      formatter={(value: number) => [`${formatNumber(value, { maximumFractionDigits: 1 })}%`, 'Tasa de ahorro']}
      contentStyle={{
        borderRadius: 14,
        border: '1px solid var(--c-border)',
        background: 'var(--c-surface)',
        color: 'var(--c-text)',
      }}
    />
    <Area
      type="monotone"
      dataKey="savingsRate"
      stroke="var(--c-primary)"
      strokeWidth={2.5}
      fill="url(#savingsRateGradient)"
    />
  </AreaChart>
</ResponsiveContainer>
```

#### Referencia visual

Mercury/Brex: metricas de salud operativa, no solo saldos.

### 3.5 Grafico nuevo 2: variacion diaria de liquidez

#### Que agrega

Nuevo widget derivado de `SaldoDiaPoint`:

`delta_dia = saldo_hoy - saldo_ayer`

Usa `BarChart` con barras positivas y negativas. No requiere endpoint nuevo.

#### Por que aporta valor real

El saldo por dia muestra estado. La variacion diaria muestra shocks: dias donde el dinero sale o entra con fuerza.

#### Codigo Recharts concreto

```tsx
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const deltaData = points.map((point, index) => {
  const previous = points[index - 1]?.saldo ?? point.saldo
  return {
    date: point.date,
    delta: point.saldo - previous,
  }
})

<ResponsiveContainer height={220}>
  <BarChart data={deltaData} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
    <XAxis
      dataKey="date"
      tickLine={false}
      axisLine={false}
      tick={{ fontSize: 11, fill: 'var(--c-text-muted)' }}
      tickFormatter={(value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }).replace('.', '')}
    />
    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--c-text-muted)' }} />
    <ReferenceLine y={0} stroke="var(--c-border-hover)" />
    <Tooltip
      formatter={(value: number) => [
        `S/ ${formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        'Variacion diaria',
      ]}
      contentStyle={{
        borderRadius: 14,
        border: '1px solid var(--c-border)',
        background: 'var(--c-surface)',
        color: 'var(--c-text)',
      }}
    />
    <Bar dataKey="delta" radius={[6, 6, 6, 6]} barSize={10}>
      {deltaData.map((entry) => (
        <Cell
          key={entry.date}
          fill={entry.delta >= 0 ? 'var(--c-primary)' : 'var(--c-danger)'}
          fillOpacity={0.82}
        />
      ))}
    </Bar>
  </BarChart>
</ResponsiveContainer>
```

#### Referencia visual

Stripe: barras finas para eventos. Linear: lectura compacta y densa.

## 4. Cards de KPI

### 4.1 Balance prominente con sparkline

#### Que cambio

`DashboardHeader.tsx` se convierte en `HeroBalanceCard`:

- Balance consolidado como numero dominante.
- Equivalencia USD como subdato.
- Resultado mensual como badge grande con tono positivo/negativo.
- Sparkline de `moneyFlow.series` en la parte inferior.
- Mini resumen: ingresos, egresos, alertas.

#### Por que

El balance es el ancla emocional. Debe sentirse como "home base", no como una card mas.

#### Codigo Recharts concreto

```tsx
import { Area, AreaChart, ResponsiveContainer } from 'recharts'

function BalanceSparkline({ series }: { series: MoneyFlowPoint[] }) {
  const data = series.map((point) => ({
    month: point.month,
    value: point.saldo_acumulado,
  }))

  return (
    <ResponsiveContainer width="100%" height={84}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="balanceSparkline" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--c-primary)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--c-primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--c-primary)"
          strokeWidth={2.5}
          fill="url(#balanceSparkline)"
          dot={false}
          isAnimationActive
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
```

#### Referencia visual

Mercury: balance al frente. Stripe: mini chart integrado al KPI.

### 4.2 Ingresos y egresos con delta visual

#### Que cambio

`KpiCards.tsx` deja de ser una fila generica de 3 cards. Se vuelve una banda secundaria bajo el hero:

- Ingresos y egresos con mini sparkline de 6 meses.
- Delta contra mes anterior derivado de `moneyFlow.series`.
- Iconos ligeros o flechas semanticas.

#### Por que

El usuario no solo necesita saber cuanto ingreso o gasto, sino si el ritmo mejora o empeora.

#### Codigo concreto

```tsx
const last = moneyFlow.series.at(-1)
const prev = moneyFlow.series.at(-2)

const incomeDelta = last && prev ? last.ingresos - prev.ingresos : 0
const expenseDelta = last && prev ? last.egresos - prev.egresos : 0

<KpiDeltaCard
  label="Ingresos"
  value={summary.ingresos_mes}
  delta={incomeDelta}
  tone="positive"
  sparkline={moneyFlow.series.map((p) => ({ label: p.month, value: p.ingresos }))}
/>

<KpiDeltaCard
  label="Egresos"
  value={summary.egresos_mes}
  delta={expenseDelta}
  tone="negative"
  sparkline={moneyFlow.series.map((p) => ({ label: p.month, value: p.egresos }))}
/>
```

### 4.3 Alertas con desglose por severidad

#### Que cambio

`alertas_pendientes` deja de ser solo un numero. Se combina con `sidebar.vencimientos_proximos`:

- Criticas: hoy o vencidas.
- Pronto: 1-3 dias.
- Semana: 4-7 dias.
- Notificaciones pendientes: `summary.alertas_pendientes`.

#### Por que

Una alerta financiera necesita severidad. "5 alertas" no dice si debo actuar hoy.

#### Codigo concreto

```tsx
function getSeverity(dueDate: string) {
  const today = new Date()
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const due = new Date(`${dueDate}T00:00:00Z`)
  const days = Math.floor((due.getTime() - start.getTime()) / 86_400_000)

  if (days <= 0) return 'critical'
  if (days <= 3) return 'soon'
  return 'week'
}

const severity = sidebar.vencimientos_proximos.reduce(
  (acc, item) => {
    acc[getSeverity(item.due_date)] += 1
    return acc
  },
  { critical: 0, soon: 0, week: 0 }
)
```

Referencia visual: Brex alerts, Stripe risk surfaces.

## 5. Widgets nuevos

### 5.1 Top 5 categorias de gasto con barras proporcionales

#### Que cambio

Extraer del actual `egresos_categoria` un widget independiente que pueda aparecer en el primer bloque secundario.

#### Por que

El top 5 ayuda a tomar accion: recortar una categoria, revisar un gasto raro, comparar concentracion.

#### Codigo concreto

```tsx
const topCategories = (sidebar?.egresos_categoria ?? [])
  .slice()
  .sort((a, b) => b.monto - a.monto)
  .slice(0, 5)

<div className="space-y-3">
  {topCategories.map((category, index) => (
    <div key={category.category_id ?? category.name} className="group">
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-[11px] tabular-nums text-[var(--c-text-faint)]">
            {String(index + 1).padStart(2, '0')}
          </span>
          <span className="truncate text-[12px] font-medium text-[var(--c-text)]">
            {category.name}
          </span>
        </div>
        <span className="text-[11px] font-semibold tabular-nums text-[var(--c-text-muted)]">
          S/ {formatNumber(category.monto, { maximumFractionDigits: 0 })}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--c-surface-2)]">
        <div
          className="h-full rounded-full transition-[width,opacity] duration-700 ease-[var(--ease-out)] group-hover:opacity-80"
          style={{ width: `${Math.max(4, category.pct)}%`, backgroundColor: category.color }}
        />
      </div>
    </div>
  ))}
</div>
```

Referencia visual: Brex spend management.

### 5.2 Proximos vencimientos en timeline priorizado

#### Que cambio

`VencimientosWidget.tsx` pasa de lista a timeline:

- Linea vertical.
- Punto por severidad.
- Badge "Hoy", "Manana", "3 dias", "Semana".
- Monto alineado a la derecha.
- Link conserva `targetHref`.

#### Por que

Un vencimiento es temporal. Un timeline reduce carga cognitiva frente a cards sueltas.

#### Codigo concreto

```tsx
<div className="relative mt-4 space-y-3 before:absolute before:bottom-2 before:left-[9px] before:top-2 before:w-px before:bg-[var(--c-border)]">
  {items.map((item) => {
    const badge = urgencyBadge(item.due_date)

    return (
      <Link
        key={`${item.tipo}-${item.id}`}
        href={targetHref(item)}
        className="group relative grid grid-cols-[20px_minmax(0,1fr)_auto] gap-3 rounded-xl px-2 py-2 transition-[background-color,transform] duration-150 ease-[var(--ease-out)] hover:bg-[var(--c-surface-2)] active:scale-[0.99]"
      >
        <span className="relative z-10 mt-1 h-[18px] w-[18px] rounded-full border-2 border-[var(--c-surface)] bg-[var(--c-warning)] shadow-[0_0_0_1px_var(--c-border)]" />
        <span className="min-w-0">
          <span className="block truncate text-[12px] font-medium text-[var(--c-text)]">{item.name}</span>
          <span className="mt-0.5 block text-[11px] text-[var(--c-text-muted)]">
            {new Date(`${item.due_date}T12:00:00`).toLocaleDateString('es-PE', {
              day: '2-digit',
              month: 'short',
            }).replace('.', '')}
          </span>
        </span>
        <span className="text-right">
          <span className={badge.className}>{badge.label}</span>
          <span className="mt-1 block text-[11px] font-semibold tabular-nums text-[var(--c-text)]">
            S/ {formatNumber(item.monto, { maximumFractionDigits: 0 })}
          </span>
        </span>
      </Link>
    )
  })}
</div>
```

Referencia visual: Linear issue timeline + Brex payment due dates.

### 5.3 Score de salud financiera visual

#### Que agrega

Nuevo widget derivado de datos existentes:

- Tasa de ahorro: desde `summary.ingresos_mes` y `summary.egresos_mes`.
- Liquidez: `summary.balance_consolidado.pen`.
- Uso de credito: `modules.creditos_uso_pct`.
- Alertas: `summary.alertas_pendientes` y vencimientos criticos.
- Flujo pendiente: `sidebar.flujo_pendiente.neto`.

No es un nuevo dato persistido. Es una lectura visual local.

#### Por que

Los dashboards premium no solo reportan; interpretan. El score le da al usuario una senal accionable sin cambiar su modelo de datos.

#### Formula propuesta

```ts
const savingsRate = summary.ingresos_mes > 0
  ? ((summary.ingresos_mes - summary.egresos_mes) / summary.ingresos_mes) * 100
  : 0

const savingsScore = Math.max(0, Math.min(35, savingsRate * 1.4))
const creditScore = Math.max(0, 25 - Math.max(0, modules.creditos_uso_pct - 30) * 0.45)
const alertScore = Math.max(0, 20 - summary.alertas_pendientes * 3)
const pendingScore = sidebar.flujo_pendiente.neto >= 0 ? 20 : 10

const healthScore = Math.round(savingsScore + creditScore + alertScore + pendingScore)
```

#### Codigo Recharts concreto

```tsx
import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from 'recharts'

const scoreData = [{ name: 'score', value: healthScore }]

<div className="grid grid-cols-[132px_minmax(0,1fr)] items-center gap-4">
  <div className="relative h-[132px]">
    <ResponsiveContainer>
      <RadialBarChart
        data={scoreData}
        innerRadius="72%"
        outerRadius="94%"
        startAngle={90}
        endAngle={-270}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
        <RadialBar
          dataKey="value"
          cornerRadius={12}
          fill={healthScore >= 75 ? 'var(--c-primary)' : healthScore >= 55 ? 'var(--c-warning)' : 'var(--c-danger)'}
          background={{ fill: 'var(--c-surface-2)' }}
        />
      </RadialBarChart>
    </ResponsiveContainer>
    <div className="absolute inset-0 grid place-items-center">
      <span className="text-[30px] font-semibold tabular-nums text-[var(--c-text)]">{healthScore}</span>
    </div>
  </div>

  <div className="space-y-2">
    <HealthFactor label="Ahorro" value={savingsScore} max={35} />
    <HealthFactor label="Credito" value={creditScore} max={25} />
    <HealthFactor label="Alertas" value={alertScore} max={20} />
    <HealthFactor label="Pendiente" value={pendingScore} max={20} />
  </div>
</div>
```

Referencia visual: Revolut/Monzo style financial wellness, con sobriedad Mercury.

## 6. Motion y microinteracciones

### Que cambio

Agregar motion intencional, no decorativo:

- KPIs entran con stagger de 40ms.
- Cards tienen hover con border, shadow y `translateY(-1px)` en desktop.
- Botones y rows tienen `active:scale-[0.98]`.
- Tooltips aparecen rapido, 125-160ms.
- Graficos animan stroke/fill una vez.

### Por que

En finanzas, motion debe construir confianza: confirmar interaccion, guiar lectura y evitar cambios bruscos.

### Codigo CSS concreto

```css
.dashboard-enter {
  animation: dashboard-enter 520ms var(--ease-out) both;
}

.dashboard-enter-delay-1 { animation-delay: 40ms; }
.dashboard-enter-delay-2 { animation-delay: 80ms; }
.dashboard-enter-delay-3 { animation-delay: 120ms; }

@keyframes dashboard-enter {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (hover: hover) {
  .premium-dashboard-card:hover {
    transform: translateY(-1px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .dashboard-enter,
  .dashboard-enter-delay-1,
  .dashboard-enter-delay-2,
  .dashboard-enter-delay-3 {
    animation: none;
  }
}
```

### Referencia visual

Emil Kowalski principle: animate only where it helps state, feedback or spatial continuity. No animation lenta en acciones frecuentes.

## 7. Dark mode

### Que cambio

Todos los graficos deben usar tokens CSS:

- `var(--c-surface)` para tooltip background.
- `var(--c-text)` y `var(--c-text-muted)` para labels.
- `var(--c-border)` para grid y borders.
- `var(--c-primary)`, `var(--c-danger)`, `var(--c-warning)`, `var(--c-accent-landing)` para series.

Evitar:

- `backgroundColor: 'white'`
- `stroke="rgba(13,79,74,0.12)"`
- textos SVG con `fontFamily="Inter, sans-serif"`

### Por que

El dashboard actual tiene tokens de dark mode, pero varios graficos y tooltips aun tienen blancos o rgba hardcodeados. Eso rompe contraste.

### Codigo concreto

```tsx
const chartTheme = {
  grid: 'color-mix(in srgb, var(--c-border) 74%, transparent)',
  axis: 'var(--c-text-muted)',
  tooltipBg: 'var(--c-surface)',
  tooltipBorder: 'var(--c-border)',
  positive: 'var(--c-primary)',
  negative: 'var(--c-danger)',
  warning: 'var(--c-warning)',
  info: 'var(--c-accent-landing)',
}

<Tooltip
  contentStyle={{
    background: chartTheme.tooltipBg,
    border: `1px solid ${chartTheme.tooltipBorder}`,
    borderRadius: 14,
    color: 'var(--c-text)',
  }}
/>
```

### Referencia visual

Linear dark mode: contraste bajo control y borders apenas visibles. Stripe dark surfaces: tooltip readable sin blanco roto.

## 8. Mapa de componentes propuesto

| Componente | Accion propuesta | Datos usados |
| --- | --- | --- |
| `DashboardWorkspace.tsx` | Reordenar grid asimetrico de 12 columnas | Los mismos `seed` y SWR fallbacks |
| `DashboardHeader.tsx` | Reemplazar por `HeroBalanceCard` o convertirlo internamente | `summary`, `moneyFlow` |
| `MoneyFlowChart.tsx` | Convertir a `AreaChart` con delta tooltip | `moneyFlow.series` |
| `KpiCards.tsx` | Convertir a banda de KPIs con sparklines | `summary`, `moneyFlow.series` |
| `SaldosDiaChart.tsx` | Agregar promedio, tooltip enriquecido y tokens dark | `saldos-dia` |
| `EgresosCategoriasWidget.tsx` | Donut + barras laterales | `sidebar.egresos_categoria` |
| `VencimientosWidget.tsx` | Timeline priorizado | `sidebar.vencimientos_proximos` |
| `FlujoPendienteWidget.tsx` | Mantener, elevar visualmente y compactar | `sidebar.flujo_pendiente` |
| `ModulesMiniCards.tsx` | Bajar prioridad visual, hacerlo resumen operativo | `modules` |
| Nuevo `FinancialHealthScore.tsx` | Score derivado local | `summary`, `modules`, `sidebar` |
| Nuevo `TopCategoriesWidget.tsx` | Ranking independiente | `sidebar.egresos_categoria` |
| Nuevo `SavingsRateTrendChart.tsx` | Tasa de ahorro mensual | `moneyFlow.series` |
| Nuevo `DailyBalanceDeltaChart.tsx` | Variacion diaria de saldo | `saldos-dia.points` |

## 9. Propuesta visual por elemento solicitado

| Elemento | Que cambio | Por que | Referencia visual |
| --- | --- | --- | --- |
| Layout general | 12 columnas, hero 8/4, segunda fila analitica, widgets secundarios abajo | Jerarquia clara y primer viewport con respuesta inmediata | Mercury + Stripe |
| Flujo de dinero | Area chart con gradiente y tooltip delta | Muestra acumulacion y cambio mensual | Stripe charts |
| Saldos por dia | Area suave + promedio + distancia al promedio | Convierte saldo diario en lectura de estabilidad | Mercury balance history |
| Egresos por categoria | Donut con centro + barras laterales | Combina proporcion y ranking | Brex spend |
| Grafico nuevo 1 | Tasa de ahorro mensual | Metrica de disciplina financiera | Revolut wellness |
| Grafico nuevo 2 | Variacion diaria de liquidez | Detecta shocks de caja | Stripe compact bars |
| Balance KPI | Hero card con sparkline | El dato principal se vuelve ancla | Mercury home |
| Ingresos/Egresos KPI | Delta visual y minisparkline | Ritmo, no solo monto | Brex/Stripe KPI |
| Alertas KPI | Severidad critical/soon/week | Accion inmediata | Brex alerts |
| Top 5 categorias | Barras proporcionales | Decision rapida de gasto | Brex spend |
| Vencimientos | Timeline priorizado | El tiempo se lee mejor como timeline | Linear timeline |
| Score salud financiera | Radial score + factores | Interpretacion accionable | Revolut/Monzo |
| Motion | Stagger, hover, active scale, tooltips rapidos | Sensacion tactil sin lentitud | Emil design engineering |
| Dark mode | Todos los charts con tokens | Contraste consistente | Linear dark |

## 10. Orden de implementacion recomendado

1. Crear `PremiumCard` y helpers de tooltip/chart tokens.
2. Rehacer `DashboardWorkspace` con el grid nuevo sin cambiar fetchers.
3. Convertir `DashboardHeader` en `HeroBalanceCard`.
4. Actualizar `MoneyFlowChart`, `SaldosDiaChart` y `EgresosCategoriasWidget`.
5. Agregar `FinancialHealthScore`, `TopCategoriesWidget`, `SavingsRateTrendChart`, `DailyBalanceDeltaChart`.
6. Convertir `VencimientosWidget` en timeline.
7. Revisar dark mode y responsive con screenshots desktop/mobile.

## 11. Criterios de aceptacion visual

- El primer viewport desktop muestra balance, tendencia y alertas sin scroll.
- En mobile, balance y alertas aparecen antes de graficos secundarios.
- Ningun tooltip usa fondo blanco hardcodeado.
- Los graficos tienen contraste suficiente en light y dark.
- Las cards tienen hover perceptible pero no distractor.
- No se agregan endpoints ni se cambian contratos API.
- Todos los nuevos widgets son derivados de datos ya disponibles.
- El dashboard se siente mas editorial y financiero, no como una grilla generica de cards.

