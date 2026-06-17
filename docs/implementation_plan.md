# DASHBOARD REDESIGN PROPOSAL — FinTrack

> **Fase 2** — Propuesta de rediseño basada en la auditoría aprobada.
> Define arquitectura de información, jerarquía visual, selección de gráficos, y comportamiento responsive.

---

## Filosofía de diseño

### Principio rector

> **El dashboard financiero debe responder tres preguntas en orden:**
> 1. **¿Hay algo que requiere mi acción ahora?** (alertas, vencimientos, presupuestos excedidos)
> 2. **¿Cómo está mi dinero hoy?** (patrimonio, balance, liquidez)
> 3. **¿Cómo ha evolucionado?** (tendencias, distribución, salud financiera)

### Referencia estética

- **Linear** para densidad informativa y sidebar persistente (ya implementado).
- **Mercury** para jerarquía financiera: tipografía tabular, tonos sobrios, datos que respiran.
- Sistema canónico: **`--ft-*` tokens exclusivamente**. Los aliases `--c-*` se mantienen por compatibilidad pero no se usan en código nuevo.

### Reglas inamovibles

1. No se modifica lógica de negocio de otros módulos.
2. El dashboard solo consume datos existentes vía endpoints actuales.
3. Moneda base: PEN con equivalencia USD.
4. Se reutiliza `PremiumCard` como contenedor visual.
5. Se reutilizan primitivos de `finance/primitives.tsx` y `dashboard/primitives.tsx`.

---

## User Review Required

> [!IMPORTANT]
> **Eliminación de 3 widgets redundantes**: Se propone eliminar `MetricCards`, `ModulesMiniCards`, y `DailyBalanceDeltaChart` del layout. Sus datos se absorben en otros widgets mejorados. ¿Estás de acuerdo o prefieres conservar alguno?

> [!IMPORTANT]
> **Integración de AlertsWidget**: Se propone activar el widget existente en `widgets/AlertsWidget.tsx` (actualmente muerto) como banner superior del dashboard. Esto requiere que los datos de alertas (cuotas vencidas, por cobrar/pagar urgentes) estén disponibles en la carga del workspace. ¿Quieres que use el endpoint `/api/dashboard/sidebar` existente o prefiero crear uno dedicado?

> [!WARNING]
> **FlujoPendienteWidget se reubica**: Pasa de posición premium (lado derecho del hero) a la zona de módulos. Es un cambio significativo para usuarios que usan activamente por cobrar/por pagar.

---

## Open Questions

> [!IMPORTANT]
> **¿Proyección de flujo futuro?** La auditoría identificó que el dashboard no proyecta flujo forward. ¿Quieres que incluya en esta fase un widget de "Próximos 30 días" que combine recurrentes + por cobrar + por pagar + cuotas de crédito, o lo dejamos como fase posterior?

> [!IMPORTANT]
> **¿Integración de recurrentes?** El módulo `/recurring` existe pero el dashboard no lo consume. ¿Incluyo un indicador de "gastos recurrentes programados este mes" dentro del Command Strip, o lo dejamos para después?

---

## Proposed Changes

### Arquitectura de información: 4 zonas semánticas

```
┌─────────────────────────────────────────────────────────────┐
│  ZONA 0 · ALERT BANNER (condicional)                        │
│  Solo aparece si hay alertas críticas (cuotas vencidas,      │
│  presupuestos excedidos >100%, vencimientos hoy/mañana)      │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  ZONA 1 · COMMAND STRIP                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐│
│  │Patrimonio│ │Ingresos  │ │Egresos   │ │Balance del Mes   ││
│  │Neto      │ │del Mes   │ │del Mes   │ │(con sparkline)   ││
│  │S/ 45,230 │ │S/ 12,800 │ │S/ 8,340  │ │S/ +4,460         ││
│  │Eq.$12,061│ │↑12% vs   │ │↓3% vs    │ │[───▁▂▃▅▇]       ││
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘│
└─────────────────────────────────────────────────────────────┘
┌────────────────────────────────┬────────────────────────────┐
│  ZONA 2 · OPERATIONAL CORE    │  ZONA 2 · RIGHT PANEL     │
│  ┌────────────────────────────┐│  ┌────────────────────────┐│
│  │  MoneyFlowChart            ││  │  FinancialHealthScore  ││
│  │  (acumulado/mensual 6m)    ││  │  (radial + 4 factores) ││
│  │  [toggle + tooltip]        ││  │  Score: 72/100          ││
│  └────────────────────────────┘│  └────────────────────────┘│
│  ┌────────────────────────────┐│  ┌────────────────────────┐│
│  │  SaldosDiaChart            ││  │  VencimientosWidget    ││
│  │  (selector 5D-1A)          ││  │  (timeline con urgencia)││
│  │  + promedio + gradiente    ││  │  Hoy: 2 · 7d: 3 · 30d:1││
│  └────────────────────────────┘│  └────────────────────────┘│
├────────────────────────────────┴────────────────────────────┤
│  ZONA 3 · ANALYSIS LAYER (3 columnas iguales)               │
│  ┌─────────────┐ ┌──────────────┐ ┌────────────────────────┐│
│  │EgresosCat   │ │TopCategorías │ │SavingsRateTrend        ││
│  │(donut +     │ │(ranking top5 │ │(área 6m + ref 20%)     ││
│  │ barras)     │ │ con barras)  │ │                        ││
│  └─────────────┘ └──────────────┘ └────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  ZONA 4 · MODULE SNAPSHOTS (3 columnas iguales)             │
│  ┌─────────────┐ ┌──────────────┐ ┌────────────────────────┐│
│  │Presupuestos │ │Créditos      │ │Saldos Bancarios        ││
│  │del Mes      │ │Uso Rápido    │ │(distribución portafolio)││
│  │+ progreso   │ │+ utilización │ │+ total consolidado      ││
│  └─────────────┘ └──────────────┘ └────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

### Zona 0 — Alert Banner (condicional)

#### [MODIFY] [DashboardWorkspace.tsx](file:///Users/eliasgustavopacopauccara/Documents/Fintrack_v1/fintrack/components/dashboard/DashboardWorkspace.tsx)

**Cambio**: Integrar `AlertsWidget` del directorio `widgets/` como banner condicional al top del dashboard.

**Lógica de visibilidad**:
- Se muestra SOLO si existen alertas con urgencia `OVERDUE` o `DUE_SOON`.
- Si no hay alertas críticas, la zona no se renderiza (0px de alto).
- Datos provienen de los endpoints existentes (`sidebar.vencimientos_proximos`, `summary.alertas_pendientes`).

**Diseño**:
- Banner horizontal full-width con borde `--ft-danger` sutil.
- Fondo: `color-mix(in srgb, var(--ft-danger) 6%, var(--ft-surface))`.
- Lista colapsable: muestra hasta 3 items con "Ver todo" que expande.
- Cada item: tipo + nombre + monto + badge de urgencia + link.
- Animación de entrada: `translateY(-8px) → 0` con `--ease-out`.

---

### Zona 1 — Command Strip

#### [MODIFY] [DashboardWorkspace.tsx](file:///Users/eliasgustavopacopauccara/Documents/Fintrack_v1/fintrack/components/dashboard/DashboardWorkspace.tsx)

**Cambio**: Reemplazar el `DashboardHeader` hero card actual por un strip de 4 KPI cards compactas.

**Razón**: El hero actual intenta mostrar todo (balance, resultado, sparkline, ingresos, egresos, alertas) en un solo componente denso. El strip distribuye la información en cards independientes con jerarquía clara.

#### [MODIFY] [DashboardHeader.tsx](file:///Users/eliasgustavopacopauccara/Documents/Fintrack_v1/fintrack/components/dashboard/DashboardHeader.tsx)

**Cambio**: Refactorizar de hero card monolítico a 4 `CommandStripCard` independientes.

**Cada card contiene**:
| Card | Dato principal | Dato secundario | Indicador visual |
|------|---------------|-----------------|------------------|
| **Patrimonio Neto** | `S/ 45,230.00` | `Eq. USD 12,061` | Dot de tono (verde si positivo, rojo si negativo) |
| **Ingresos del Mes** | `S/ 12,800.00` | `↑12% vs mes anterior` | Mini trend arrow con porcentaje |
| **Egresos del Mes** | `S/ 8,340.00` | `↓3% vs mes anterior` | Mini trend arrow con porcentaje |
| **Balance del Mes** | `S/ +4,460.00` | Sparkline inline de 6 meses | Micro area chart (la sparkline actual del hero, relocada aquí) |

**Diseño de cada card**:
- `PremiumCard` con `p-4`.
- Label: `text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--ft-text-subtle)]`.
- Valor: `text-[1.35rem] font-semibold tabular-nums tracking-[-0.03em]`.
- Secundario: `text-[11px] text-[var(--ft-text-muted)]`.
- Grid: `grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4`.

**Elimina**:
- ❌ `MetricCards.tsx` — datos absorbidos aquí.
- ❌ `ModulesMiniCards.tsx` — datos redundantes con Zona 4.

---

### Zona 2 — Operational Core

#### [MODIFY] [DashboardWorkspace.tsx](file:///Users/eliasgustavopacopauccara/Documents/Fintrack_v1/fintrack/components/dashboard/DashboardWorkspace.tsx)

**Cambio**: Layout 2 columnas (7/5 en 12-col grid) con los 4 widgets operativos.

**Columna izquierda (7col)**:
1. **MoneyFlowChart** — se mantiene sin cambios. Toggle acumulado/mensual funciona bien.
2. **SaldosDiaChart** — se mantiene con selector de período. Se ajusta el bajo contraste del gradiente en light mode (stopOpacity de 0.26 → 0.18 para suavizar).

**Columna derecha (5col)**:
1. **FinancialHealthScore** — se mantiene. Se agrega contexto: "↑3 pts vs mes anterior" al lado del score radial.
2. **VencimientosWidget** — se mantiene. Ya tiene excelente diseño con timeline de urgencia.

**Elimina de esta zona**:
- ❌ `FlujoPendienteWidget` — se absorbe en el `AlertsWidget` de Zona 0 (las contrapartes top 3 están disponibles en sidebar data).

#### [MODIFY] [MoneyFlowChart.tsx](file:///Users/eliasgustavopacopauccara/Documents/Fintrack_v1/fintrack/components/dashboard/MoneyFlowChart.tsx)

- Cambio menor: migrar `--c-*` tokens a `--ft-*` equivalentes.
- Sin cambios funcionales.

#### [MODIFY] [SaldosDiaChart.tsx](file:///Users/eliasgustavopacopauccara/Documents/Fintrack_v1/fintrack/components/dashboard/SaldosDiaChart.tsx)

- Reducir `stopOpacity` del gradiente de 0.26 → 0.18.
- Migrar tokens `--c-*` → `--ft-*`.

#### [MODIFY] [FinancialHealthScore.tsx](file:///Users/eliasgustavopacopauccara/Documents/Fintrack_v1/fintrack/components/dashboard/FinancialHealthScore.tsx)

- Agregar indicador delta vs mes anterior al lado del score.
- Migrar tokens `--c-*` → `--ft-*`.

---

### Zona 3 — Analysis Layer

#### [MODIFY] [DashboardWorkspace.tsx](file:///Users/eliasgustavopacopauccara/Documents/Fintrack_v1/fintrack/components/dashboard/DashboardWorkspace.tsx)

**Cambio**: 3 columnas iguales (`grid-cols-1 md:grid-cols-3 gap-3`).

1. **EgresosCategoriasWidget** — se mantiene con donut + barras. Se agrega fallback para 1 categoría: mostrar barra horizontal en vez de donut cuando `categories.length < 3`.
2. **TopCategoriesWidget** — se mantiene. Ranking top 5 con barras de concentración.
3. **SavingsRateTrendChart** — se mantiene. Área de tendencia con referencia a 20%.

**Elimina**:
- ❌ `DailyBalanceDeltaChart` — las barras de variación diaria son redundantes con `SaldosDiaChart` (mismo endpoint, mismos datos, representación diferente). El dato de "movimiento más intenso" se puede integrar como tooltip o nota al pie en `SaldosDiaChart`.

#### [MODIFY] [EgresosCategoriasWidget.tsx](file:///Users/eliasgustavopacopauccara/Documents/Fintrack_v1/fintrack/components/dashboard/EgresosCategoriasWidget.tsx)

- Fallback para `categories.length < 3`: renderizar barras horizontales en vez de donut.
- Migrar tokens restantes a `--ft-*`.

---

### Zona 4 — Module Snapshots

#### [MODIFY] [DashboardWorkspace.tsx](file:///Users/eliasgustavopacopauccara/Documents/Fintrack_v1/fintrack/components/dashboard/DashboardWorkspace.tsx)

**Cambio**: 3 columnas iguales (`grid-cols-1 md:grid-cols-3 gap-3`) para snapshots de módulos.

1. **PresupuestosMesWidget** — se mantiene. Definido vs ejecutado + progreso.
2. **CreditosUsoRapidoWidget** — se mantiene. Cupo total/usado + utilización.
3. **SaldosBancariosWidget** — se mantiene. Distribución por portafolio.

**Mejoras transversales en Zona 4**:
- Cada widget tiene botón "Ir a [módulo]" ya implementado.
- Agregar empty states con CTA:
  - Presupuestos vacío → "Crear primer presupuesto" → `/budgets`
  - Créditos vacío → "Registrar línea de crédito" → `/credits`
  - Saldos vacío → "Agregar portafolio" → `/portfolio`

---

### Cambios transversales

#### [MODIFY] [chartTheme.ts](file:///Users/eliasgustavopacopauccara/Documents/Fintrack_v1/fintrack/components/dashboard/chartTheme.ts)

- Migrar todas las referencias de `--c-*` a `--ft-*` equivalentes.
- No cambia funcionalidad porque `--c-primary: var(--ft-primary)`, pero estandariza.

#### [MODIFY] [primitives.tsx](file:///Users/eliasgustavopacopauccara/Documents/Fintrack_v1/fintrack/components/dashboard/primitives.tsx) (dashboard)

- Reemplazar colores hardcodeados en `KpiCard`:
  - `'#C14554'` → `'var(--ft-danger)'`
  - `'#B88435'` → `'var(--ft-warning)'`
  - `'#3F68A7'` → `'var(--ft-info)'`

#### Empty states mejorados (todos los widgets)

Patrón unificado para empty states:

```tsx
<EmptyWidget
  message="No hay presupuestos activos para este período."
  hint="Los presupuestos te ayudan a controlar gasto por categoría."
  action={{ label: 'Crear presupuesto', href: '/budgets' }}
/>
```

---

### Resumen de cambios en archivos

| Acción | Archivo | Descripción |
|--------|---------|-------------|
| **MODIFY** | `DashboardWorkspace.tsx` | Restructurar grid a 4 zonas, eliminar widgets redundantes, integrar AlertsWidget |
| **MODIFY** | `DashboardHeader.tsx` | Refactorizar de hero card a Command Strip de 4 KPI cards |
| **MODIFY** | `MoneyFlowChart.tsx` | Migrar tokens `--c-*` → `--ft-*` |
| **MODIFY** | `SaldosDiaChart.tsx` | Reducir opacidad gradiente, migrar tokens |
| **MODIFY** | `FinancialHealthScore.tsx` | Agregar delta vs mes anterior, migrar tokens |
| **MODIFY** | `EgresosCategoriasWidget.tsx` | Fallback para pocas categorías, migrar tokens |
| **MODIFY** | `SavingsRateTrendChart.tsx` | Migrar tokens |
| **MODIFY** | `TopCategoriesWidget.tsx` | Migrar tokens |
| **MODIFY** | `VencimientosWidget.tsx` | Migrar tokens |
| **MODIFY** | `PresupuestosMesWidget.tsx` | Empty state con CTA, migrar tokens |
| **MODIFY** | `CreditosUsoRapidoWidget.tsx` | Empty state con CTA, migrar tokens |
| **MODIFY** | `SaldosBancariosWidget.tsx` | Empty state con CTA, migrar tokens |
| **MODIFY** | `chartTheme.ts` | Estandarizar a `--ft-*` tokens |
| **MODIFY** | `primitives.tsx` (dashboard) | Eliminar colores hardcodeados |
| **DELETE** | `MetricCards.tsx` | Datos absorbidos en Command Strip |
| **DELETE** | `ModulesMiniCards.tsx` | Datos redundantes con Module Snapshots |
| **DELETE** | `DailyBalanceDeltaChart.tsx` | Redundante con SaldosDiaChart |

---

### Responsive behavior

| Viewport | Zona 1 | Zona 2 | Zona 3 | Zona 4 |
|----------|--------|--------|--------|--------|
| **≥1280px (xl)** | 4 columnas | 7/5 grid | 3 columnas | 3 columnas |
| **≥768px (md)** | 2×2 grid | Stack vertical (12col cada uno) | 2+1 o stack | Stack vertical |
| **<768px (sm)** | Stack vertical | Stack vertical | Stack vertical | Stack vertical |

**Mobile-first considerations**:
- Zona 0 (alertas): siempre full-width, collapsible en mobile.
- Zona 1 (KPIs): `grid-cols-2` en tablet, `grid-cols-1` en mobile.
- Gráficos: mantienen su `ResponsiveContainer` existente, alturas fijas de 220-286px.
- Vencimientos: scroll interno limitado a 4 items en mobile con "Ver más".

---

## Verification Plan

### Automated Tests

```bash
# Build check — asegurar que compila sin errores después de los cambios
npm run build

# Type check
npx tsc --noEmit

# Lint
npm run lint
```

### Manual Verification

1. **Verificar datos**: Abrir dashboard con datos reales y confirmar que los 4 KPIs del Command Strip muestran los mismos valores que el hero card actual.
2. **Verificar vacíos**: Crear un usuario nuevo sin datos y confirmar que todos los empty states muestran CTAs correctos.
3. **Verificar responsive**: Probar en 3 breakpoints (1440px, 768px, 375px).
4. **Verificar dark mode**: Todos los tokens `--ft-*` tienen variantes dark, confirmar que no hay colores hardcodeados visibles.
5. **Verificar performance**: Confirmar que la carga del dashboard no agrega endpoints nuevos (mismos 4 fetches paralelos).

### Rollout strategy

1. **Fase A**: Restructurar el grid y eliminar redundantes (DashboardWorkspace + DashboardHeader).
2. **Fase B**: Migrar tokens en todos los widgets (chartTheme, primitives, cada widget).
3. **Fase C**: Mejorar empty states y fallbacks (donut, alertas).
4. **Fase D**: Verificar responsive y dark mode.
