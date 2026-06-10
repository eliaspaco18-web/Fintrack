# Informe De Auditoria Visual

Auditado desde codigo fuente. Este informe no incluye cambios sobre la aplicacion. El diagnostico es claro: la app tiene buena base funcional, pero visualmente no es un solo producto. Conviven 5 lenguajes: dashboard calido, modulos CRUD genericos, tablas mas maduras en movimientos, auth/landing dark-tech con gradientes, y restos legacy con overrides globales. Para una SaaS financiera tipo Mercury, Brex, Stripe y Linear, el rediseño debe ser sistemico, no cosmetico.

## Veredicto Ejecutivo

🔴 Critico: no existe un sistema visual unico. Se mezclan `--c-*`, `--color-*`, clases Tailwind hardcodeadas, `bg-white`, `bg-white/[0.04]`, gradientes, estados locales y componentes duplicados.

🔴 Critico: cada modulo resuelve headers, filtros, toggles, empty states, cards, acciones y modales de forma distinta.

🔴 Critico: `globals.css` esta actuando como parche visual masivo, incluso sobrescribiendo `.text-white`, `.bg-white/`, `.border-white/` con `!important`. Eso oculta inconsistencias en vez de eliminarlas.

🟡 Importante: la app se siente mas como una coleccion de pantallas que como una plataforma financiera. Falta una arquitectura visual consistente: `PageHeader`, `SummaryStrip`, `ControlsBar`, `DataTable`, `EntityList`, `DetailDrawer`.

🟡 Importante: demasiados `rounded-2xl`, sombras suaves, pills y tarjetas blancas. El resultado es amable, pero poco premium y poco preciso. Mercury, Stripe y Brex usan menos ornamento y mas jerarquia, densidad, alineacion y precision.

🟢 Menor: hay buenas piezas reutilizables, pero subutilizadas: `RecordModal`, `ViewToggle`, `ActionIconButton`, `TableShell`, `ModuleEmptyState`, `CreateModuleButton`.

## Direccion Visual Objetivo

Referencia principal: Mercury + Linear para navegacion, densidad y calma; Stripe para controles, tablas y formularios; Brex para cards financieras, saldos y estados.

Nuevo lenguaje:

- Fondo: warm off-white `#FAFAF7`.
- Superficie: blanco puro solo para paneles primarios.
- Bordes: `#E4E2DD`, 1px, sin teatralidad.
- Radios: 8px para controles, 10-12px para cards, 14px maximo para modales.
- Sombras: casi ninguna. Usar borde + leve elevacion solo en overlays.
- Tipografia: Geist para UI, Plus Jakarta solo para numeros grandes o headings puntuales.
- Color principal: verde financiero sobrio, no emerald brillante.
- Estados: rojo, ambar, azul y verde en paletas apagadas, nunca Tailwind puro.
- Motion: transiciones de 120-180ms con easing custom, nada de `transition-all`.
- Layout: ancho maximo estable, columnas claras, barras de control repetibles.

---

# Auditoria Por Modulo

## DASHBOARD - `app/(dashboard)/dashboard/`

### Descripcion Visual Actual

El dashboard usa una composicion densa con `space-y-4`, fondo calido, tarjetas blancas `rounded-2xl`, bordes suaves y sombras `shadow-sm`. El contenido se divide en dos columnas en desktop: izquierda amplia para graficos, KPIs y modulos; derecha para widgets secundarios. Los headers son pequeños, muchos labels estan en uppercase de 10-11px, y los valores principales rondan entre `1.25rem` y `1.5rem`. Hay graficos Recharts con verde primario y azul hardcodeado. Los widgets usan `WidgetShell` con `p-4`, borde y background blanco.

### Problemas Detectados

🔴 Critico: demasiadas tarjetas con jerarquia similar. KPI, widgets, mini modulos y graficos compiten visualmente.

🔴 Critico: el dashboard define sus propios primitives en vez de usar componentes globales.

🟡 Importante: el header "Vista general" no tiene presencia ejecutiva. Parece una seccion interna, no el centro financiero del producto.

🟡 Importante: colores de metricas hardcodeados (`#C14554`, `#B88435`, `#3F68A7`) fuera del sistema.

🟢 Menor: el espaciado es consistente, pero demasiado uniforme; falta contraste entre resumen, analisis y alertas.

### Inconsistencias Con Otros Modulos

Dashboard usa `WidgetShell`, `KpiCard`, `SectionHeader`, `ModulesMiniCards`; otros modulos usan summary cards manuales. Los charts tienen un lenguaje visual distinto a tablas/listas. Los botones son distintos a los de portfolio, budgets y admin.

### Propuesta De Rediseño Drastico

Eliminar la sopa de widgets. Convertir el dashboard en una consola financiera:

```tsx
<PageLayout
  header={
    <ModuleHeader
      eyebrow="Centro financiero"
      title="Dashboard"
      description="Liquidez, flujo pendiente y riesgo operativo en tiempo real."
      actions={<Button variant="secondary">Actualizar</Button>}
    />
  }
  stats={
    <StatGrid>
      <StatCard label="Saldo disponible" value={formatMoney(total)} delta="+4.8%" />
      <StatCard label="Ingresos del mes" value={formatMoney(income)} tone="positive" />
      <StatCard label="Egresos del mes" value={formatMoney(expense)} tone="negative" />
      <StatCard label="Alertas criticas" value={criticalAlerts} tone="warning" />
    </StatGrid>
  }
>
  <DashboardGrid
    primary={<CashflowPanel />}
    secondary={<RiskQueue />}
    lower={<ModuleHealthGrid />}
  />
</PageLayout>
```

Referencia visual: Mercury dashboard para saldos claros; Brex para cashflow y obligaciones; Linear para paneles discretos.

---

## PORTAFOLIO - `app/(dashboard)/portfolio/`

### Descripcion Visual Actual

Pantalla con summary card superior `rounded-2xl bg-white p-5`, label pequeño "Resumen de portafolio", saldos por moneda y boton primario. Abajo hay una card grande con header, `ViewToggle`, buscador, selects y lista/card view. Las filas son tarjetas `rounded-xl`, con punto de color, metadata y acciones con `ActionIconButton`. El modal usa `RecordModal`, formulario amplio, color/icon pickers y checkbox.

### Problemas Detectados

🔴 Critico: la pantalla parece un CRUD encapsulado en una card, no una vista financiera de cuentas.

🟡 Importante: el summary esta desconectado de filtros y tabla/lista.

🟡 Importante: los balances no tienen tratamiento financiero premium: falta alineacion tabular, agrupacion por moneda y jerarquia.

🟢 Menor: el `ViewToggle` esta bien encaminado, pero su styling emerald no pertenece al sistema.

### Inconsistencias Con Otros Modulos

Portfolio usa `ViewToggle` y `CardView`; credits/assets recrean toggles propios. Usa `RecordModal`; recurring usa modal custom. Empty state dashed distinto a alerts/settings.

### Propuesta De Rediseño Drastico

Convertir portfolio en una vista de cuentas tipo Mercury:

```tsx
<FinancialModule
  title="Portafolio"
  description="Cuentas, efectivo e instrumentos activos."
  primaryAction={<CreateButton label="Nuevo portafolio" />}
  stats={[
    { label: "Total PEN", value: penTotal },
    { label: "Total USD", value: usdTotal },
    { label: "Cuentas activas", value: activeCount },
  ]}
>
  <ControlsBar
    searchPlaceholder="Buscar cuenta, banco o moneda"
    filters={<PortfolioFilters />}
    viewToggle
  />
  <EntityList
    density="comfortable"
    rows={portfolios}
    renderRow={PortfolioAccountRow}
  />
</FinancialModule>
```

Eliminar cards duplicadas. Reemplazar por `AccountRow`: icono, banco/cuenta, moneda, balance alineado a la derecha, status y acciones.

Referencia visual: Mercury accounts list.

---

## MOVIMIENTOS - `app/(dashboard)/transactions/`

### Descripcion Visual Actual

Es el modulo mas maduro. Tiene summary card superior con titulo, descripcion y acciones. La tabla usa `TableShell`, `Toolbar`, `Th`, `Td`, quick filter pills, filtros avanzados, busqueda, selects, fechas, ordenamiento, paginacion y saved views. Las filas tienen borde izquierdo por tipo, badges redondeados y acciones visibles.

### Problemas Detectados

🔴 Critico: es visualmente mas completo que el resto, lo que deja a los otros modulos sintiendose incompletos.

🟡 Importante: la toolbar esta sobrecargada; quick filters, filtros, saved views y acciones ocupan demasiado.

🟡 Importante: borde izquierdo por tipo puede sentirse tosco frente a un sistema mas minimalista.

🟢 Menor: los badges y botones internos no coinciden con los de alerts/budgets/credits.

### Inconsistencias Con Otros Modulos

Es el unico modulo con tabla real de calidad. Otros usan div-lists. Sus filtros son mas avanzados que portfolio/assets/credits/recurring.

### Propuesta De Rediseño Drastico

Mantener su arquitectura, pero extraerla como estandar:

```tsx
<DataModule
  title="Movimientos"
  description="Registro completo de ingresos, egresos y transferencias."
  actions={<TransactionActions />}
>
  <ControlsBar
    presets={["Todos", "Ingresos", "Egresos", "Transferencias"]}
    filters={<TransactionFilters />}
    savedViews
  />
  <DataTable
    columns={transactionColumns}
    rows={transactions}
    density="compact"
    rowTone={(row) => row.type}
  />
</DataModule>
```

Referencia visual: Stripe balance transactions para tabla densa; Brex expenses para filtros.

---

## CREDITOS - `app/(dashboard)/credits/`

### Descripcion Visual Actual

Summary card superior con titulo "Creditos" y boton. Lista con mini summary cards, filtros, toggle propio list/card, buscador y selects. Filas con icono, status pill, progreso de utilizacion, metadata y acciones. Card view usa borde superior de color y caja interna para cupo disponible. Modal en dos pasos para tipo de credito.

### Problemas Detectados

🔴 Critico: recrea patrones que ya existen en portfolio y tables.

🔴 Critico: edicion esta como placeholder "proximamente", lo que visualmente crea affordances falsas.

🟡 Importante: colores de tipo hardcodeados azul/ambar.

🟡 Importante: toggle local distinto al `ViewToggle`.

🟢 Menor: buena idea de barra de utilizacion, pero necesita componente `ProgressMetric`.

### Inconsistencias Con Otros Modulos

No usa `ViewToggle`; empty state distinto; acciones parcialmente distintas; summary cards propias.

### Propuesta De Rediseño Drastico

Transformar en vista de lineas de credito:

```tsx
<ResourceModule
  title="Creditos"
  description="Tarjetas, prestamos y lineas disponibles."
  stats={<CreditExposureStats />}
>
  <ControlsBar filters={<CreditFilters />} viewToggle />
  <CreditExposureTable rows={credits} />
</ResourceModule>
```

Cada credito debe mostrar: entidad, tipo, saldo usado, limite, utilizacion, proxima fecha, estado. Usar `ProgressMetric` comun.

Referencia visual: Brex cards/credit lines.

---

## PRESUPUESTOS - `app/(dashboard)/budgets/`

### Descripcion Visual Actual

Tiene summary card con totales por moneda y numero de presupuestos excedidos. Lista/card view con `ViewToggle`, filtros, progreso de gasto y acciones. Usa gradientes en progress bars (`bg-gradient-to-r`) verdes o rojos. Cards con border-top de 3px y cajas internas de disponible/excedido.

### Problemas Detectados

🔴 Critico: los gradientes rompen el lenguaje minimal financiero.

🟡 Importante: el estado excedido deberia ser estructural, no decorativo.

🟡 Importante: acciones custom junto a `ActionIconButton`.

🟢 Menor: el modelo visual de presupuesto esta bien, pero necesita mas precision.

### Inconsistencias Con Otros Modulos

Usa `CreateModuleButton`, `ViewToggle`, pero mezcla acciones propias. Progress visual diferente a credits/assets.

### Propuesta De Rediseño Drastico

Reemplazar cards coloridas por tabla/lista de control presupuestal:

```tsx
<BudgetRow>
  <BudgetIdentity name={budget.name} category={budget.category} />
  <AmountCell label="Asignado" value={budget.limit} />
  <AmountCell label="Gastado" value={budget.spent} />
  <ProgressMetric value={budget.usage} tone={budget.over ? "danger" : "neutral"} />
  <StatusBadge tone={budget.over ? "danger" : "success"} />
</BudgetRow>
```

Referencia visual: Linear project progress + Brex spend controls.

---

## ACTIVOS - `app/(dashboard)/assets/`

### Descripcion Visual Actual

Muy parecido a creditos. Summary card, stats para activos/inactivos/valor total, filtros, toggle propio, rows/cards. Cards tienen border-top por tipo de activo, cajas de valor y acciones. Modal con formulario de activo.

### Problemas Detectados

🔴 Critico: pantalla practicamente duplica creditos con nombres distintos.

🟡 Importante: los activos deberian sentirse como inventario financiero, no como generic cards.

🟡 Importante: estados "● Activo / ○ Inactivo" son visualmente primitivos.

🟢 Menor: filters con "Desde/Hasta" manuales rompen ritmo.

### Inconsistencias Con Otros Modulos

Toggle propio, empty state propio, status propio, color por tipo propio.

### Propuesta De Rediseño Drastico

Usar `AssetRegister`:

```tsx
<RegisterModule
  title="Activos"
  description="Inventario valorizado y depreciacion operacional."
  stats={<AssetStats />}
>
  <ControlsBar filters={<AssetFilters />} viewToggle />
  <EntityRegister
    columns={["Activo", "Tipo", "Valor", "Adquisicion", "Estado", "Acciones"]}
    rows={assets}
  />
</RegisterModule>
```

Referencia visual: Mercury clean account rows, pero con enfoque de registro patrimonial.

---

## POR COBRAR - `app/(dashboard)/receivables/`

### Descripcion Visual Actual

Summary card con pendientes/cobrados/total y dos botones: nuevo deudor y nueva cuenta. Lista/card view con filtros, error panel, empty dashed state. Rows/cards muestran progreso cobrado, deudor, montos y acciones. Al seleccionar deudor, la pantalla cambia a un detalle completo con boton volver y nueva lista interna.

### Problemas Detectados

🔴 Critico: el detail view reemplaza toda la pantalla, generando salto mental y visual.

🟡 Importante: dos CTAs compiten en el header.

🟡 Importante: colores hardcodeados emerald/ambar.

🟢 Menor: el modelo de progreso es util, pero deberia ser componente comun.

### Inconsistencias Con Otros Modulos

Muy parecido a payables, pero ambos duplican logica visual. Detail no usa drawer ni layout comun.

### Propuesta De Rediseño Drastico

Convertir deudor/receivable en master-detail:

```tsx
<ReceivablesModule>
  <ControlsBar filters={<ReceivableFilters />} />
  <SplitLedger
    master={<DebtorList />}
    detail={<ReceivableDetailDrawer />}
  />
</ReceivablesModule>
```

La fila principal debe priorizar: deudor, vencimiento mas proximo, pendiente, cobrado y riesgo.

Referencia visual: Stripe customers + invoices.

---

## POR PAGAR - `app/(dashboard)/payables/`

### Descripcion Visual Actual

Espejo de receivables: summary, acreedores, cuentas por pagar, filtros, list/card, detail de acreedor como pantalla completa.

### Problemas Detectados

🔴 Critico: duplica receivables sin una abstraccion de ledger comun.

🟡 Importante: riesgo financiero deberia estar mas presente: vencidas, proximas, proveedor critico.

🟡 Importante: detail full-screen se siente pesado para una operacion frecuente.

🟢 Menor: estados pagado/pendiente necesitan tokens.

### Inconsistencias Con Otros Modulos

Mismo problema que receivables: status chips, detail pages, cards y progress no son sistema compartido.

### Propuesta De Rediseño Drastico

Crear `LedgerModule` reutilizable para cobranzas y pagos:

```tsx
<LedgerModule
  kind="payables"
  title="Por pagar"
  partyLabel="Acreedor"
  amountLabel="Por pagar"
  riskMetric="Vencimiento"
/>
```

Referencia visual: Brex bills y Stripe invoices.

---

## RECURRENTES - `app/(dashboard)/recurring/`

### Descripcion Visual Actual

SummaryBar con 5 metricas. Main section blanca con header "Plantillas guardadas". Filtros manuales: search con SVG inline, native selects para tipo/portfolio. Cards/rows usan clases dark-first `bg-white/[0.02]`, hover `bg-white/[0.04]`. Modal propio con overlay negro, inputs translucidos y no usa `RecordModal`.

### Problemas Detectados

🔴 Critico: es el modulo mas inconsistente dentro del dashboard.

🔴 Critico: usa patrones visuales de dark UI dentro del sistema light.

🔴 Critico: modal custom rompe `RecordModal`.

🟡 Importante: selects nativos rompen el lenguaje premium.

🟡 Importante: acciones manuales no usan `ActionIconButton`.

### Inconsistencias Con Otros Modulos

No usa `AppSelect`, `ViewToggle`, `RecordModal`, `ModuleHeader`, `ControlsBar`, `EmptyState` ni tokens limpios.

### Propuesta De Rediseño Drastico

Reconstruir completamente:

```tsx
<DataModule
  title="Recurrentes"
  description="Plantillas y automatizaciones de movimientos."
  actions={<CreateButton label="Nueva recurrencia" />}
>
  <StatGrid stats={recurringStats} />
  <ControlsBar filters={<RecurringFilters />} />
  <EntityList rows={templates} renderRow={RecurringTemplateRow} />
  <RecordModal title="Recurrencia">{/* form */}</RecordModal>
</DataModule>
```

Referencia visual: Linear automations/settings lists.

---

## ALERTAS - `app/(dashboard)/alerts/`

### Descripcion Visual Actual

Summary bar compacta, luego seccion blanca con filtros, bulk actions y lista de alert cards. Cada alert card usa border-left de 4px por severidad, background distinto para unread/read, badges red/amber/sky, acciones que aparecen al hover.

### Problemas Detectados

🔴 Critico: las alertas usan lenguaje visual de notificaciones genericas, no de riesgo financiero.

🟡 Importante: acciones ocultas por hover afectan mobile y accesibilidad.

🟡 Importante: severidad con border-left fuerte se ve menos premium.

🟢 Menor: relative time y agrupacion son utiles.

### Inconsistencias Con Otros Modulos

Summary bar no usa `StatGrid`; badges propios; cards propias; bulk actions distintas.

### Propuesta De Rediseño Drastico

Convertir en risk inbox:

```tsx
<RiskInbox
  summary={<RiskSummary />}
  filters={<AlertFilters />}
  rows={alerts}
/>
```

Fila ideal: severidad como small token, modulo, titulo, monto afectado si existe, fecha, estado y acciones visibles.

Referencia visual: Linear inbox + Mercury alerts.

---

## ADMINISTRACION - `app/(dashboard)/admin/`

### Descripcion Visual Actual

La ruta real es `admin`, aunque el requerimiento la llama administracion. Usa tabs superiores dentro de una card `rounded-2xl bg-white p-1.5`, grid 2/lg4. Active tab tiene fill primario verde, texto blanco y sombra. Cada manager tiene sus propias cards, filtros, tablas/listas, modales, color pickers e icon pickers.

### Problemas Detectados

🔴 Critico: administracion es un conjunto de subapps con estilos propios.

🟡 Importante: active tab verde lleno es demasiado pesado respecto a sidebar/topbar.

🟡 Importante: los managers duplican filtros, summaries, empty states y modales.

🟢 Menor: el concepto tabulado es correcto, pero debe ser mas sobrio.

### Inconsistencias Con Otros Modulos

Tabs visualmente mas fuertes que navegacion principal. Managers usan hardcoded emerald/rose/sky.

### Propuesta De Rediseño Drastico

Crear `CatalogAdminLayout`:

```tsx
<AdminLayout
  title="Administracion"
  nav={[
    "Bancos",
    "Monedas",
    "Categorias",
    "Tipos de activos",
  ]}
>
  <CatalogTable
    title="Categorias"
    columns={categoryColumns}
    rows={categories}
    actions={<CreateButton label="Nueva categoria" />}
  />
</AdminLayout>
```

Referencia visual: Stripe settings/admin tables.

---

## CONFIGURACION - `app/(dashboard)/settings/`

### Descripcion Visual Actual

Layout con sidebar sticky de 192px y panel principal. Sidebar grouped con secciones CUENTA/PREFERENCIAS/DATOS/AYUDA. En mobile el sidebar se oculta. Profile form usa card con avatar y un gradiente oscuro interno. Botones, inputs y toggles usan mezcla de `--c-*` y `--color-*`. Preferences usa cards visuales para tema, toggles pequeños y selects.

### Problemas Detectados

🔴 Critico: en mobile, al ocultar sidebar, se pierde la navegacion de settings.

🔴 Critico: boton primario con `text-black` sobre verde oscuro puede fallar contraste.

🟡 Importante: avatar card con gradiente oscuro rompe la estetica light/minimal.

🟡 Importante: settings mezcla tokens legacy y actuales.

🟢 Menor: toggles deberian ser mas robustos y accesibles.

### Inconsistencias Con Otros Modulos

Settings se siente como otra app. Usa `--color-*` mientras modulos usan `--c-*`.

### Propuesta De Rediseño Drastico

```tsx
<SettingsLayout
  mobileNav={<SettingsSelectNav />}
  sidebar={<SettingsSidebar />}
>
  <SettingsSection title="Perfil">
    <FieldGrid />
  </SettingsSection>
</SettingsLayout>
```

Eliminar gradiente avatar. Usar panel blanco, avatar neutral, upload button secundario.

Referencia visual: Linear settings.

---

## AUTH - `app/(auth)/`

### Descripcion Visual Actual

Login full-screen con escena premium: gradientes, ambient lights, shapes, carousel visual, panel de entrada, tabs para login/signup/recovery, inputs custom, password meter y motion/tilt. La estetica es blue/teal dark-tech, muy diferente al dashboard.

### Problemas Detectados

🔴 Critico: auth no pertenece visualmente a la misma empresa que el dashboard.

🟡 Importante: demasiado motion y ornamentacion para una SaaS financiera seria.

🟡 Importante: paleta hardcodeada slate/emerald/blue fuera del sistema.

🟢 Menor: el panel de login esta bien estructurado y puede sobrevivir.

### Inconsistencias Con Otros Modulos

Auth usa clases `fin-auth-*`, gradientes, orbs, carousel, shadows grandes. Dashboard usa cards blancas sobrias.

### Propuesta De Rediseño Drastico

Mantener split, pero volverlo editorial financiero:

```tsx
<AuthShell
  brand={<BrandMark />}
  form={<LoginForm />}
  proof={<ProductProofPanel variant="cashflow" />}
/>
```

Eliminar orbs, rings, tilt y exceso de gradientes. Usar una captura real/estilizada del producto, metricas sobrias y fondo warm.

Referencia visual: Mercury login + Stripe auth minimal.

---

## LANDING - `app/page.tsx`, `app/LandingPage.tsx`

### Descripcion Visual Actual

Landing dark-tech con canvas particles, sticky nav, mobile menu, hero con titulo grande y gradiente, dashboard mockup, trust bar, feature cards, seccion plataforma, stats animados, CTA y footer. Usa multiples inline SVG icons y CSS especifico en `globals.css`.

### Problemas Detectados

🔴 Critico: la landing promete un producto visualmente diferente al dashboard real.

🔴 Critico: particulas/orbs/gradientes dan sensacion generica de SaaS IA, no fintech premium.

🟡 Importante: dashboard mockup no parece una captura real suficientemente precisa.

🟡 Importante: inline icons por todos lados, sin sistema.

🟢 Menor: la estructura comercial esta completa.

### Inconsistencias Con Otros Modulos

Landing usa dark mode, hero marketing y particulas. App usa financial ops light. Auth usa otra variante dark-tech.

### Propuesta De Rediseño Drastico

Usar landing clara, editorial, con producto real en primer viewport:

```tsx
<LandingHero
  title="Finanzas operativas para equipos que necesitan precision."
  visual={<ProductScreenshot />}
  cta={<PrimaryCTA />}
  secondary={<SecondaryCTA />}
/>
```

Eliminar particles. Convertir features en modulos reales con capturas o mini UI fiel.

Referencia visual: Mercury, Stripe Billing, Brex.

---

# Componentes - `components/`

## Descripcion Actual

Hay buenos cimientos, pero dispersos. `layout/` tiene shell/sidebar/topbar. `tables/` esta mas maduro. `ui/` tiene modal, toggles, buttons, states, skeletons. Cada dominio tambien trae sus propios panels, lists, modals y forms.

## Problemas Detectados

🔴 Critico: `TableShell` solo gobierna movimientos; el resto inventa listas.

🔴 Critico: `RecordModal` existe pero recurring y confirm dialogs usan overlays propios.

🔴 Critico: `ViewToggle` existe, pero credits/assets no lo usan.

🟡 Importante: `ActionIconButton` existe, pero muchas acciones son botones custom.

🟡 Importante: `CardView` usa shadow/hover mas decorativo que premium.

🟡 Importante: `states.tsx` existe, pero cada modulo crea su empty state.

## Rediseño De Componentes

Crear una capa `components/finance/`:

```txt
PageLayout
ModuleHeader
StatGrid
StatCard
SummaryStrip
ControlsBar
FilterBar
SearchField
ViewToggle
DataTable
EntityList
EntityCard
StatusBadge
AmountCell
ProgressMetric
EmptyState
ErrorState
LoadingState
RecordModal
ConfirmDialog
DetailDrawer
FormSection
FieldGroup
SegmentedTabs
InlineActions
```

Regla: ningun modulo puede crear botones, toggles, badges, modales o empty states locales salvo caso excepcional.

---

# Estilos - `globals.css` y `tailwind.config.ts`

## Descripcion Actual

`tailwind.config.ts` tiene una buena intencion: warm palette, Geist, Plus Jakarta, shadows, animations. Pero `globals.css` tiene demasiadas capas: tokens actuales, tokens legacy, overrides globales, auth CSS, landing CSS, utilities, compatibility hacks.

## Problemas Detectados

🔴 Critico: doble sistema de tokens: `--c-*` vs `--color-*`.

🔴 Critico: overrides globales de `.text-white`, `.bg-white/`, `.border-white/` con `!important`.

🔴 Critico: clases arbitrarias Tailwind como `.text-[10px]` son redefinidas globalmente. Eso rompe la expectativa de Tailwind.

🟡 Importante: auth y landing viven en el mismo CSS global, contaminando el producto.

🟡 Importante: sombras/card radii no tienen una escala estricta.

🟢 Menor: la tipografia base de 15px puede funcionar, pero debe ser explicita dentro de una escala.

## Rediseño CSS

```css
:root {
  --ft-bg: #fafaf7;
  --ft-surface: #ffffff;
  --ft-surface-muted: #f4f3ef;
  --ft-border: #e4e2dd;
  --ft-border-strong: #cac7bf;

  --ft-text: #191917;
  --ft-text-muted: #6f6b63;
  --ft-text-subtle: #98938a;

  --ft-primary: #0d6b5e;
  --ft-primary-hover: #09584e;
  --ft-danger: #b84a4a;
  --ft-warning: #a9782f;
  --ft-success: #3f7f62;
  --ft-info: #426f9f;

  --ft-radius-control: 8px;
  --ft-radius-card: 12px;
  --ft-radius-overlay: 14px;

  --ft-shadow-overlay: 0 18px 50px rgba(25, 25, 23, 0.14);
}
```

Eliminar hacks globales. Migrar `auth.css` y `landing.css` a archivos scoped o modulos CSS.

---

# Sistema Reutilizable Propuesto

## `PageLayout`

```tsx
export function PageLayout({ header, stats, controls, children }: Props) {
  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-4 pb-10">
      {header}
      {stats ? <div>{stats}</div> : null}
      {controls ? <div>{controls}</div> : null}
      {children}
    </div>
  );
}
```

## `ModuleHeader`

```tsx
export function ModuleHeader({ eyebrow, title, description, actions }: Props) {
  return (
    <header className="flex flex-col gap-3 border-b border-[var(--ft-border)] pb-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ft-text-subtle)]">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 text-[22px] font-semibold tracking-normal text-[var(--ft-text)]">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-[var(--ft-text-muted)]">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
```

## `StatCard`

```tsx
export function StatCard({ label, value, detail, tone = "neutral" }: Props) {
  return (
    <section className="rounded-[var(--ft-radius-card)] border border-[var(--ft-border)] bg-[var(--ft-surface)] px-4 py-3">
      <p className="text-[11px] font-medium text-[var(--ft-text-subtle)]">{label}</p>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <strong className="font-mono text-xl font-semibold text-[var(--ft-text)]">
          {value}
        </strong>
        {detail && <span data-tone={tone} className="status-token">{detail}</span>}
      </div>
    </section>
  );
}
```

## `ControlsBar`

```tsx
export function ControlsBar({ search, filters, presets, actions, viewToggle }: Props) {
  return (
    <section className="flex flex-col gap-3 rounded-[var(--ft-radius-card)] border border-[var(--ft-border)] bg-[var(--ft-surface)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        {presets}
        <div className="ml-auto flex items-center gap-2">
          {viewToggle}
          {actions}
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_auto]">
        {search}
        {filters}
      </div>
    </section>
  );
}
```

## `DataTable`

```tsx
export function DataTable({ columns, rows, empty }: Props) {
  return (
    <div className="overflow-hidden rounded-[var(--ft-radius-card)] border border-[var(--ft-border)] bg-[var(--ft-surface)]">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-[var(--ft-surface-muted)] text-[11px] uppercase text-[var(--ft-text-subtle)]">
          <tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row) => <DataRow key={row.id} row={row} />) : empty}
        </tbody>
      </table>
    </div>
  );
}
```

## `StatusBadge`

```tsx
<StatusBadge tone="success">Activo</StatusBadge>
<StatusBadge tone="warning">Pendiente</StatusBadge>
<StatusBadge tone="danger">Vencido</StatusBadge>
<StatusBadge tone="neutral">Inactivo</StatusBadge>
```

Regla visual: ningun badge debe usar `text-emerald-*`, `bg-red-*`, `border-sky-*` directamente.

---

# Orden De Implementacion

1. **Tokens y CSS base**
   Unificar `--c-*` y `--color-*`. Eliminar overrides globales peligrosos. Separar CSS de auth y landing.

2. **Componentes fundacionales**
   Crear `PageLayout`, `ModuleHeader`, `StatGrid`, `StatCard`, `ControlsBar`, `FilterBar`, `StatusBadge`, `AmountCell`, `ProgressMetric`, `EmptyState`, `ConfirmDialog`, `DetailDrawer`.

3. **Unificar botones, acciones y toggles**
   Rehacer `ViewToggle`, `ActionIconButton`, `CreateModuleButton`, `Button`. Prohibir botones locales salvo composicion.

4. **Convertir Movimientos en patron oficial**
   Extraer `DataTable`, `Toolbar`, filtros, saved views y empty state como base para todos.

5. **Migrar Portfolio**
   Es modulo de alto impacto y bajo riesgo. Debe convertirse en la referencia visual interna.

6. **Migrar Creditos, Activos y Presupuestos**
   Comparten estructura. Crear `RegisterModule` + `ProgressMetric`.

7. **Migrar Por Cobrar y Por Pagar**
   Crear `LedgerModule` con variantes receivable/payable y detail drawer.

8. **Reconstruir Recurrentes**
   Prioridad alta porque hoy rompe el sistema visual.

9. **Rehacer Alertas como Risk Inbox**
   Menos cards decorativas, mas lista operativa.

10. **Rediseñar Administracion**
    Convertir managers en `CatalogTable` reutilizable.

11. **Rediseñar Settings**
    Arreglar mobile nav, contraste, tokens y avatar area.

12. **Rediseñar Auth**
    Mantener estructura, bajar espectaculo, alinear con marca.

13. **Rediseñar Landing**
    Ultimo paso: debe reflejar el producto ya rediseñado, no inventar otra identidad.

---

# Conclusion

La app no necesita pulido; necesita una consolidacion visual completa. La ruta correcta es convertir los mejores patrones existentes, especialmente tabla de movimientos, `RecordModal`, `ActionIconButton` y el shell, en un sistema financiero unico. Despues, cada modulo debe dejar de diseñarse como pantalla aislada y pasar a ser una variante de 4 patrones: `DataModule`, `RegisterModule`, `LedgerModule` y `CatalogModule`. Ahi la app empieza a sentirse como producto serio, no como coleccion de CRUDs.
