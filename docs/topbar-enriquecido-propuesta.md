# Propuesta de Topbar enriquecido para FinTrack

## Objetivo

Convertir el Topbar en una pieza útil de navegación, estado operativo y acciones globales, sin repetir el título y subtítulo que muchos módulos ya renderizan justo debajo con `ModuleHeader`.

La dirección recomendada es sobria, densa y financiera: más cerca de Mercury, Brex, Stripe y Linear que de una barra decorativa. El Topbar no debe crecer. Debe ser una franja de trabajo de `h-14` con contexto a la izquierda y máximo 5 controles a la derecha.

## Hallazgos del código actual

### Topbar actual

Archivo: `components/layout/Topbar.tsx`

- `HeaderCopy` resuelve el módulo activo con `getActiveNavItem(pathname)` desde `lib/constants/nav.ts`.
- Renderiza `title` con `activeItem.label` y `subtitle` con `activeItem.description`.
- En rutas de detalle agrega un chip derivado del último segmento de la URL.
- El contenedor usa `px-4 py-3 md:px-6`, no una altura fija explícita.
- El `Topbar` recibe `user` y `onSignOut`, pero actualmente no los usa.
- No hay lado derecho. Todo el espacio restante queda vacío.
- Usa aliases `--c-*`, aunque el sistema canónico ya existe como `--ft-*`.

Código relevante actual:

```tsx
const title = activeItem?.label ?? 'FinTrack'
const subtitle = activeItem?.description
  ?? (detailLabel ? `Vista · ${detailLabel}` : 'Resumen ejecutivo financiero')

return (
  <header className="
    fin-topbar sticky top-0 z-30
    border-b border-[var(--c-border)]
    bg-[var(--c-topbar-bg)]
    backdrop-blur-sm
  ">
    <div className="flex items-center gap-3 px-4 py-3 md:px-6">
      <HeaderCopy />
    </div>
  </header>
)
```

### Espacio libre actual

En desktop, el Topbar ocupa todo el ancho de la columna principal, pero solo usa:

- Menú móvil: oculto en `md`.
- Bloque de título/subtítulo: normalmente entre 180 y 420 px.
- Resto del ancho: vacío, porque el wrapper no tiene `justify-between` ni un grupo derecho.

Con sidebar expandido (`248px`), una pantalla de 1440 px deja una columna principal aproximada de 1192 px. El bloque izquierdo del Topbar usa alrededor de 250-360 px en módulos normales. Quedan aproximadamente 760-900 px sin función. En laptop mediana, todavía quedan 450-650 px libres.

Este espacio es valioso para FinTrack porque ya existen datos globales de layout que pueden vivir allí:

- `navBadges.alerts` se calcula en `app/(dashboard)/layout.tsx`.
- `user.name`, `user.email` y `user.avatar` ya llegan a `Topbar`.
- `useTheme()` ya existe y se usa en `QuickActionsFAB`.
- `useCurrency()` ya existe para acciones globales, aunque no lo priorizaría en Topbar.

## Dónde se duplica título/subtítulo

La duplicación viene de dos fuentes:

- Topbar: `activeItem.label` + `activeItem.description`.
- Módulos: `ModuleHeader`, `RegisterModule`, `LedgerModule` o hero propio con título/descripción.

Matriz:

| Ruta | Topbar actual | Header debajo | Ubicación exacta | Diagnóstico |
| --- | --- | --- | --- | --- |
| `/dashboard` | `Dashboard` + "Vista general de saldos..." | `DashboardHeader` muestra "Balance consolidado" | `components/dashboard/DashboardHeader.tsx:37` | No duplica título. El Topbar sí puede ser más útil mostrando estado global. |
| `/portfolio` | `Portafolio` + "Cuentas bancarias..." | `ModuleHeader title="Portafolio"` + descripción de cuentas | `components/management/PortfolioManager.tsx:663` | Duplicación directa de título y semántica. |
| `/transactions` | `Movimientos` + "Registro de ingresos..." | Hero interno con kicker `Transacciones` + descripción de registros | `components/transactions/TransactionsWorkspace.tsx:390` | Duplicación semántica y naming inconsistente. |
| `/credits` | `Créditos` + "Control de tarjetas..." | `RegisterModule title="Creditos"` + descripción de tarjetas/prestamos | `components/credits/CreditsListPanel.tsx:268` | Duplicación directa; además falta tilde en el header local. |
| `/budgets` | `Presupuestos` + "Límites de gasto..." | `RegisterModule title="Presupuestos"` + descripción de límites | `components/management/BudgetsManager.tsx:517` | Duplicación directa. |
| `/assets` | `Activos` + "Patrimonio..." | `RegisterModule title="Activos"` + descripción de bienes/equipos | `components/assets/AssetsListPanel.tsx:244` | Duplicación directa. |
| `/receivables` | `Por cobrar` + "Seguimiento..." | `LedgerModule title="Por cobrar"` + descripción de deudores | `components/receivables/ReceivablesManager.tsx:253` | Duplicación directa. |
| `/payables` | `Por pagar` + "Seguimiento..." | `LedgerModule title="Por pagar"` + descripción de acreedores | `components/payables/PayablesWorkspace.tsx:243` | Duplicación directa. |
| `/recurring` | `Recurrentes` + "Plantillas..." | `RegisterModule title="Recurrentes"` + descripción de plantillas | `components/recurring/RecurringWorkspace.tsx:294` | Duplicación directa. |
| `/alerts` | `Alertas` + "Riesgos..." | `ModuleHeader title="Risk inbox"` + descripción de vencimientos/desvíos | `components/alerts/AlertsWorkspace.tsx:249` | No es literal, pero compite por el mismo contexto. Conviene unificar idioma y jerarquía. |
| `/admin` | `Administración` + "Catálogos..." | `CatalogAdminLayout title="Administración"` + descripción de catálogos | `components/management/AdminWorkspace.tsx:116` | Duplicación directa. |
| `/settings` | `Configuración` + "Perfil, seguridad..." | Hero grande de configuración con lógica visual/identidad | `app/(dashboard)/settings/page.tsx:147` | Duplicación conceptual, no literal. El hero local es demasiado editorial para una vista de settings. |

## Decisión de producto

### Regla nueva

El Topbar debe ser dueño del contexto navegacional. Los módulos deben ser dueños del contenido operativo.

Esto implica:

- Topbar izquierdo: breadcrumb compacto o título del módulo.
- Topbar derecho: acciones globales, alertas y perfil.
- `ModuleHeader`: deja de repetir el nombre del módulo cuando el Topbar ya lo muestra.
- En cada módulo, la primera sección debe empezar con métricas, filtros o acciones específicas, no con otro título grande.

### Qué eliminar del Topbar actual

- El subtítulo persistente de `activeItem.description`. Es la raíz de la redundancia.
- El chip derivado de `lastSeg` como texto suelto cuando el breadcrumb puede expresar mejor la ruta.
- El uso de `py-3` como altura implícita. Debe ser `h-14`.

### Qué conservar

- `getActiveNavItem(pathname)` como fuente de verdad.
- El botón de menú móvil.
- `fin-topbar` con blur acotado.
- La relación con `navBadges` y `user` desde `AppShell`.

## Topbar propuesto

### Composición

Altura: `h-14`.

Lado izquierdo:

- Mobile: menú + título truncado.
- Desktop: breadcrumb compacto: `FinTrack / Módulo / Detalle`.
- No subtítulo. Si se necesita descripción, vive en contenido.

Lado derecho recomendado:

1. Alertas críticas con badge y link a `/alerts`.
2. Acción rápida primaria: `Nueva` con menú para transacción, portafolio, presupuesto y recurrente.
3. Estado de sincronización/conexión: "Actualizado 09:42" o "Sin conexión".
4. Toggle light/dark.
5. Avatar con dropdown: nombre, plan, configuración, logout.

En mobile:

- Mostrar solo `Alertas` y `Avatar`.
- Colapsar `Nueva`, sync y theme dentro del dropdown/avatar o en el FAB existente.
- Nunca permitir overflow horizontal: izquierda con `min-w-0`, derecha con `shrink-0`, títulos con `truncate`.

## Código propuesto

Este código es una propuesta concreta, no aplicada. Usa `--ft-*` exclusivamente.

```tsx
'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { getActiveNavItem } from '@/lib/constants/nav'
import { useTheme } from '@/lib/hooks/useTheme'
import {
  IconBell,
  IconChevronRight,
  IconLogOut,
  IconMenu,
  IconMoon,
  IconPlus,
  IconSun,
  IconUser,
  NavIcon,
} from './LayoutIcons'

interface TopbarProps {
  user: { email: string; name?: string | null; avatar?: string | null }
  navBadges?: Partial<Record<string, number>>
  lastSyncedAt?: string | null
  onMenuClick: () => void
  onSignOut: () => void
}

function resolveCrumbs(pathname: string) {
  const activeItem = getActiveNavItem(pathname)
  const parts = pathname.split('/').filter(Boolean)
  const lastSeg = parts.at(-1)
  const detailLabel = lastSeg && lastSeg !== activeItem?.href.replace('/', '')
    ? lastSeg === 'new'
      ? 'Nueva'
      : decodeURIComponent(lastSeg).replace(/[-_]/g, ' ')
    : null

  return {
    activeItem,
    title: activeItem?.label ?? 'FinTrack',
    detailLabel,
  }
}

function TopbarIconButton({
  children,
  label,
  onClick,
  className = '',
}: {
  children: React.ReactNode
  label: string
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`
        ui-pressable relative inline-flex h-9 w-9 items-center justify-center
        rounded-[var(--radius-sm)] border border-[var(--ft-border)]
        bg-[var(--ft-surface)] text-[var(--ft-text-muted)]
        transition-[background-color,border-color,color,transform] duration-[180ms]
        ease-[var(--ease-out)]
        hover:border-[var(--ft-border-strong)] hover:bg-[var(--ft-surface-hover)]
        hover:text-[var(--ft-text)]
        active:scale-[0.97]
        focus-visible:outline-none focus-visible:ring-2
        focus-visible:ring-[var(--ft-primary-border)]
        ${className}
      `.trim()}
    >
      {children}
    </button>
  )
}

export function Topbar({
  user,
  navBadges = {},
  lastSyncedAt,
  onMenuClick,
  onSignOut,
}: TopbarProps) {
  const pathname = usePathname()
  const { mounted, theme, toggleTheme } = useTheme()
  const [quickOpen, setQuickOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const { activeItem, title, detailLabel } = useMemo(
    () => resolveCrumbs(pathname),
    [pathname],
  )

  const alertCount = navBadges.alerts ?? 0
  const isLight = mounted && theme === 'light'
  const displayName = user.name || user.email || 'Usuario'
  const initials = displayName
    .split(' ')
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <header
      className="
        fin-topbar sticky top-0 z-30 h-14 shrink-0
        border-b border-[var(--ft-border)]
        bg-[var(--ft-topbar-bg)]
        backdrop-blur-sm
      "
    >
      <div className="flex h-full min-w-0 items-center justify-between gap-3 px-3 sm:px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Abrir menú"
            className="
              ui-pressable inline-flex h-9 w-9 shrink-0 items-center justify-center
              rounded-[var(--radius-sm)] border border-[var(--ft-border)]
              bg-[var(--ft-surface)] text-[var(--ft-text-muted)]
              transition-[background-color,border-color,color,transform] duration-[180ms]
              ease-[var(--ease-out)] hover:border-[var(--ft-border-strong)]
              hover:bg-[var(--ft-surface-hover)] hover:text-[var(--ft-text)]
              active:scale-[0.97] md:hidden
            "
          >
            <IconMenu size={16} />
          </button>

          {activeItem ? (
            <span className="hidden shrink-0 text-[12px] font-medium text-[var(--ft-text-subtle)] md:inline">
              FinTrack
            </span>
          ) : null}

          {activeItem ? (
            <IconChevronRight
              size={13}
              className="hidden shrink-0 text-[var(--ft-text-subtle)] md:block"
            />
          ) : null}

          <div className="flex min-w-0 items-center gap-2">
            {activeItem ? (
              <NavIcon
                name={activeItem.icon}
                size={15}
                strokeWidth={1.75}
                className="hidden shrink-0 text-[var(--ft-primary)] sm:block"
              />
            ) : null}

            <h1 className="truncate text-[14px] font-semibold leading-none tracking-[-0.01em] text-[var(--ft-text)]">
              {title}
            </h1>

            {detailLabel ? (
              <>
                <IconChevronRight
                  size={13}
                  className="hidden shrink-0 text-[var(--ft-text-subtle)] sm:block"
                />
                <span className="hidden max-w-[180px] truncate text-[12px] font-medium capitalize text-[var(--ft-text-muted)] sm:inline">
                  {detailLabel}
                </span>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Link
            href="/alerts"
            aria-label={alertCount > 0 ? `${alertCount} alertas críticas` : 'Alertas'}
            title="Alertas"
            className="
              ui-pressable relative inline-flex h-9 w-9 items-center justify-center
              rounded-[var(--radius-sm)] border border-[var(--ft-border)]
              bg-[var(--ft-surface)] text-[var(--ft-text-muted)]
              transition-[background-color,border-color,color,transform] duration-[180ms]
              ease-[var(--ease-out)]
              hover:border-[var(--ft-border-strong)] hover:bg-[var(--ft-surface-hover)]
              hover:text-[var(--ft-text)] active:scale-[0.97]
              focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-[var(--ft-primary-border)]
            "
          >
            <IconBell size={16} />
            {alertCount > 0 ? (
              <span
                className="
                  absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center
                  rounded-[var(--radius-pill)] bg-[var(--ft-danger)]
                  px-1 text-[10px] font-semibold leading-none
                  text-[var(--ft-text-on-primary)]
                "
              >
                {alertCount > 9 ? '9+' : alertCount}
              </span>
            ) : null}
          </Link>

          <div className="relative hidden sm:block">
            <button
              type="button"
              onClick={() => setQuickOpen(open => !open)}
              className="
                ui-pressable inline-flex h-9 items-center gap-2
                rounded-[var(--radius-sm)] bg-[var(--ft-primary)]
                pl-3 pr-2 text-[12px] font-semibold
                text-[var(--ft-text-on-primary)]
                transition-[background-color,transform] duration-[180ms]
                ease-[var(--ease-out)] hover:bg-[var(--ft-primary-hover)]
                active:scale-[0.98]
              "
            >
              Nueva
              <span className="flex h-5 w-5 items-center justify-center rounded-[var(--radius-xs)] bg-[color-mix(in_srgb,var(--ft-text-on-primary)_16%,transparent)]">
                <IconPlus size={13} />
              </span>
            </button>

            {quickOpen ? (
              <div
                className="
                  absolute right-0 top-11 w-56 rounded-[var(--radius-md)]
                  border border-[var(--ft-border)] bg-[var(--ft-surface)]
                  p-1 shadow-[var(--shadow-md)]
                "
              >
                <Link className="topbar-menu-item" href="/transactions?new=transaction">Nueva transacción</Link>
                <Link className="topbar-menu-item" href="/portfolio?new=account">Nuevo portafolio</Link>
                <Link className="topbar-menu-item" href="/budgets?new=budget">Nuevo presupuesto</Link>
                <Link className="topbar-menu-item" href="/transactions/new">Movimiento avanzado</Link>
              </div>
            ) : null}
          </div>

          <div
            className="
              hidden h-9 items-center gap-2 rounded-[var(--radius-sm)]
              border border-[var(--ft-border)] bg-[var(--ft-surface)]
              px-2.5 text-[11px] font-medium text-[var(--ft-text-muted)]
              lg:flex
            "
            title={lastSyncedAt ? `Última sincronización: ${lastSyncedAt}` : 'Conectado'}
          >
            <span className="h-1.5 w-1.5 rounded-[var(--radius-pill)] bg-[var(--ft-success)]" />
            <span>{lastSyncedAt ? `Actualizado ${lastSyncedAt}` : 'Conectado'}</span>
          </div>

          <TopbarIconButton
            label={isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
            onClick={toggleTheme}
            className="hidden sm:inline-flex"
          >
            {isLight ? <IconMoon size={16} /> : <IconSun size={16} />}
          </TopbarIconButton>

          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen(open => !open)}
              aria-label="Abrir perfil"
              className="
                ui-pressable flex h-9 items-center gap-2 rounded-[var(--radius-sm)]
                border border-[var(--ft-border)] bg-[var(--ft-surface)]
                px-1.5 pr-2 text-[var(--ft-text)]
                transition-[background-color,border-color,transform] duration-[180ms]
                ease-[var(--ease-out)] hover:border-[var(--ft-border-strong)]
                hover:bg-[var(--ft-surface-hover)] active:scale-[0.98]
              "
            >
              <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-[var(--radius-xs)] bg-[var(--ft-primary-soft)] text-[10px] font-semibold text-[var(--ft-primary)]">
                {user.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  initials || <IconUser size={13} />
                )}
              </span>
              <span className="hidden max-w-[120px] truncate text-[12px] font-medium md:inline">
                {displayName}
              </span>
            </button>

            {profileOpen ? (
              <div
                className="
                  absolute right-0 top-11 w-64 rounded-[var(--radius-md)]
                  border border-[var(--ft-border)] bg-[var(--ft-surface)]
                  p-1 shadow-[var(--shadow-md)]
                "
              >
                <div className="px-3 py-2">
                  <p className="truncate text-[13px] font-semibold text-[var(--ft-text)]">{displayName}</p>
                  <p className="truncate text-[11px] text-[var(--ft-text-muted)]">{user.email}</p>
                  <p className="mt-1 text-[11px] font-medium text-[var(--ft-primary)]">Plan Personal</p>
                </div>
                <Link className="topbar-menu-item" href="/settings?tab=profile">Configuración</Link>
                <Link className="topbar-menu-item" href="/settings?tab=security">Seguridad</Link>
                <button type="button" onClick={onSignOut} className="topbar-menu-item w-full">
                  <IconLogOut size={14} />
                  Cerrar sesión
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  )
}
```

CSS utilitario recomendado, siempre con `--ft-*`:

```css
.fin-topbar {
  background-color: var(--ft-topbar-bg) !important;
  border-color: var(--ft-border) !important;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.topbar-menu-item {
  display: flex;
  min-height: 34px;
  align-items: center;
  gap: 8px;
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  color: var(--ft-text-muted);
  font-size: 12px;
  font-weight: 600;
  text-align: left;
  transition:
    background-color var(--transition-base),
    color var(--transition-base),
    transform var(--transition-fast);
}

.topbar-menu-item:hover {
  background-color: var(--ft-surface-hover);
  color: var(--ft-text);
}

.topbar-menu-item:active {
  transform: scale(0.98);
}
```

Nota de implementación: el ejemplo usa `color-mix` con `--ft-text-on-primary` para el icono interno del botón `Nueva`. Si se quiere una regla más estricta de tokens puros sin `color-mix`, conviene agregar un token nuevo como `--ft-primary-contrast-soft`.

## Ajuste necesario en `AppShell`

`Topbar` ya recibe `user`, pero no `navBadges`. Para que el indicador de alertas sea real, el shell debe pasar el objeto existente:

```tsx
<Topbar
  user={user}
  navBadges={navBadges}
  onMenuClick={openMobileDrawer}
  onSignOut={handleSignOut}
/>
```

Para `lastSyncedAt`, hay dos opciones:

- Fase 1: mostrar solo `Conectado` usando `navigator.onLine` en cliente.
- Fase 2: pasar `exchangeRateSnapshot.updatedAt` o una marca de última carga del layout cuando el backend lo exponga.

## Cómo resolver la duplicación con `ModuleHeader`

### Opción recomendada

Crear una variante de layout donde el Topbar es el único dueño del título de navegación y `ModuleHeader` se vuelve opcional.

Contrato propuesto:

```tsx
type ModuleHeaderMode = 'full' | 'content' | 'hidden'

interface ModuleHeaderProps {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  mode?: ModuleHeaderMode
}

export function ModuleHeader({
  eyebrow,
  title,
  description,
  actions,
  mode = 'full',
}: ModuleHeaderProps) {
  if (mode === 'hidden') {
    return actions ? (
      <div className="flex justify-end">{actions}</div>
    ) : null
  }

  if (mode === 'content') {
    return (
      <header className="flex items-center justify-between gap-3 border-b border-[var(--ft-border)] pb-3">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ft-text-subtle)]">
              {eyebrow}
            </p>
          ) : null}
          {description ? (
            <p className="mt-1 max-w-2xl text-[13px] leading-5 text-[var(--ft-text-muted)]">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </header>
    )
  }

  return (
    <header className="flex flex-col gap-3 border-b border-[var(--ft-border)] pb-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ft-text-subtle)]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.03em] text-[var(--ft-text)] md:text-[26px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--ft-text-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  )
}
```

Uso recomendado:

```tsx
<RegisterModule
  headerMode="content"
  eyebrow="Control presupuestal"
  title="Presupuestos"
  description="Límites por categoría y periodo con lectura clara de ejecución."
  actions={<Button>Nuevo presupuesto</Button>}
>
  ...
</RegisterModule>
```

En `headerMode="content"`, no se renderiza otro `h1`. Solo queda:

- Eyebrow, si aporta taxonomía.
- Descripción breve, si de verdad cambia por datos del módulo.
- Acciones específicas del módulo, si no caben o no son globales.

### Reglas por módulo

| Módulo | Resolver así |
| --- | --- |
| Dashboard | Mantener `DashboardHeader`, porque no repite `Dashboard`; es un resumen financiero. Topbar muestra contexto + alertas. |
| Portafolio | `ModuleHeader mode="content"` o mover `Nuevo portafolio` al menú `Nueva`; eliminar `h1 Portafolio` local. |
| Movimientos | Reemplazar hero superior por una `ControlsBar`/summary compacta. Topbar muestra `Movimientos`; acciones `Nueva transacción` y `Exportar` pueden quedar como quick action + botón secundario local. |
| Créditos | `RegisterModule headerMode="content"`; corregir texto visible a `Créditos` si se mantiene algún label. |
| Presupuestos | `RegisterModule headerMode="content"`; acción principal puede estar en Topbar `Nueva`. |
| Activos | `RegisterModule headerMode="content"`; mantener stats como primera lectura real. |
| Por cobrar | `LedgerModule headerMode="content"`; acciones `Nuevo deudor` y `Nueva cuenta` se quedan locales por ser específicas. |
| Por pagar | `LedgerModule headerMode="content"`; acciones locales por especificidad. |
| Recurrentes | `RegisterModule headerMode="content"`; `Nueva transacción` puede moverse a Topbar. |
| Alertas | Unificar el nombre: usar `Alertas` en Topbar y `Bandeja de riesgo` como eyebrow o título de sección, no `Risk inbox` como h1 paralelo. |
| Administración | `CatalogAdminLayout headerMode="content"`; el foco debe pasar rápido a tabs de catálogos. |
| Configuración | Reducir el hero editorial. Topbar muestra `Configuración`; el contenido puede abrir directamente en tabs + panel activo. |

## Priorización de elementos del lado derecho

Orden recomendado para FinTrack:

1. Alertas críticas. Es el elemento con mayor impacto financiero: vencimientos, cobros, pagos, cuotas vencidas. Ya existe `navBadges.alerts`.
2. Acción rápida `Nueva`. El flujo principal de una app financiera es capturar movimiento sin perder contexto. Debe abrir un menú, no llenar el Topbar de botones.
3. Estado de conexión o última sincronización. Aporta confianza en datos financieros. Debe ser silencioso, no protagonista.
4. Toggle theme. Útil, pero secundario. En mobile puede vivir en perfil.
5. Perfil/avatar. Necesario para cuenta, plan, configuración y logout.

No recomiendo poner todos los accesos del `QuickActionsFAB` en el Topbar. El FAB actual mezcla navegación, moneda, tema y perfil. El Topbar debe absorber lo global y crítico; el FAB puede quedar para captura rápida o desaparecer luego si `Nueva` cubre el caso principal.

## Comportamiento responsive

```tsx
// Desktop
FinTrack / Movimientos                    [Alertas 3] [Nueva +] [Conectado] [Tema] [Avatar]

// Tablet
Movimientos                               [Alertas 3] [Nueva +] [Tema] [Avatar]

// Mobile
[Menu] Movimientos                        [Alertas 3] [Avatar]
```

Reglas:

- `header`: `h-14 shrink-0`.
- Contenedor interno: `h-full min-w-0 justify-between`.
- Izquierda: `min-w-0`, `truncate`.
- Derecha: `shrink-0`, `gap-1.5`.
- Ocultar sync en `<lg`.
- Ocultar theme y acción rápida textual en `<sm`.
- El menú de perfil contiene theme, settings y logout en mobile.

## Tokens

La implementación del Topbar debe migrar de aliases `--c-*` a tokens canónicos:

| Uso | Token |
| --- | --- |
| Fondo Topbar | `--ft-topbar-bg` |
| Superficie botón/dropdown | `--ft-surface` |
| Hover | `--ft-surface-hover` |
| Texto principal | `--ft-text` |
| Texto secundario | `--ft-text-muted` |
| Texto sutil | `--ft-text-subtle` |
| Borde | `--ft-border` |
| Borde fuerte | `--ft-border-strong` |
| Acción primaria | `--ft-primary` |
| Hover acción primaria | `--ft-primary-hover` |
| Suave primario | `--ft-primary-soft` |
| Alertas críticas | `--ft-danger` |
| Estado correcto | `--ft-success` |
| Motion | `--transition-fast`, `--transition-base`, `--ease-out` |
| Radios | `--radius-xs`, `--radius-sm`, `--radius-md`, `--radius-pill` |

## Plan de implementación sugerido

1. Actualizar `TopbarProps` para recibir `navBadges` y opcionalmente `lastSyncedAt`.
2. Pasar `navBadges` desde `AppShell`.
3. Sustituir `HeaderCopy` por breadcrumb compacto sin subtítulo.
4. Añadir grupo derecho con 5 elementos máximo.
5. Migrar clases del Topbar de `--c-*` a `--ft-*`.
6. Agregar `headerMode` a `ModuleHeader`, `RegisterModule`, `LedgerModule` y `CatalogAdminLayout`.
7. Aplicar `headerMode="content"` en módulos con duplicación directa.
8. Reducir el hero de `settings` y el resumen superior de `transactions`.
9. Probar mobile en 360 px, tablet y desktop verificando que no haya overflow.

## Resultado esperado

El primer viewport deja de empezar con dos cabeceras que dicen lo mismo. El usuario obtiene:

- Ubicación clara siempre visible.
- Alertas críticas accesibles desde cualquier módulo.
- Creación rápida sin depender del FAB.
- Confianza básica sobre conexión/sincronización.
- Perfil y configuración a mano.

El contenido gana espacio vertical y el Topbar deja de ser una franja vacía para convertirse en una barra de operación financiera.
