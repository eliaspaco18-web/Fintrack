# Propuesta de rediseño total del sidebar de FinTrack

Fecha: 2026-05-17  
Alcance analizado: `components/layout/Sidebar.tsx`, `components/layout/NavItem.tsx`, `components/layout/Brand.tsx`, `components/layout/AppShell.tsx`, `lib/constants/nav.ts`, `lib/hooks/useLayout.tsx` y secciones relevantes de `app/globals.css`.

Referencias de criterio: Linear sidebar, Mercury dashboard navigation, Vercel dashboard sidebar, Stripe-grade SaaS financiero.

## 1. Diagnóstico actual

### Arquitectura visual actual

El sidebar actual ya está en una etapa intermedia de rediseño: no es un menú básico, sino un panel flotado dentro de un margen lateral. En desktop se renderiza como un `<aside>` sticky con `h-screen`, padding externo `p-2.5`, ancho `248px` expandido y `80px` colapsado. Dentro tiene un panel con `rounded-2xl`, borde tokenizado, fondo `--c-sidebar-bg` y `--shadow-sm`.

En `AppShell`, el layout usa una composición clásica de SaaS: sidebar estático en `md+`, drawer móvil en mobile, topbar en la columna derecha y `<main>` con scroll independiente. Esto es correcto para una app financiera porque mantiene navegación, contexto y acciones persistentes sin desplazar el contenido principal.

El patrón actual se ve así:

- Contenedor externo con fondo transparente, pero `.fin-sidebar` fuerza `background-color: var(--c-sidebar-bg) !important`, así que el margen alrededor del panel puede sentirse menos flotado de lo que pretende.
- Panel interior blanco en light mode y near-black cálido en dark mode.
- Header con logo + botón de colapso.
- Navegación separada por labels "Principal" y "Sistema".
- Footer con avatar, nombre, email y logout.
- Mobile drawer con el mismo contenido, overlay y slide desde la izquierda.

### Jerarquía

La jerarquía es funcional, pero todavía no llega al estándar Linear/Mercury por tres razones:

1. El header, navegación y footer compiten visualmente. El logo tiene un mark de 36px, el icono de cada item vive dentro de una caja de 28px y el footer tiene avatar de 32px; todos tienen pesos visuales similares.
2. Los grupos "Principal" y "Sistema" están tratados como encabezados en mayúsculas de 10px con tracking alto. Esto crea una estética de plantilla administrativa más que de producto financiero premium.
3. El item activo usa color teal, fondo suave e indicador izquierdo de 2px. Es claro, pero aún se lee como estado de sistema, no como un affordance de navegación de alta gama.

### Tipografía

El sistema global usa `Plus Jakarta Sans` para display y `Geist` para body. Es una buena base para SaaS financiero: limpia, seria y con buena legibilidad. El problema está en la mezcla local:

- `BrandWordmark` fuerza `fontFamily: "Plus Jakarta Sans"` inline y `fontSize: 17px`, mientras `SidebarLogo` también pasa clases `text-[15px] font-semibold`. Esa clase no controla el tamaño real porque el style inline gana.
- Los labels de nav usan `text-[13px] font-medium tracking-[-0.01em]`. El tamaño es correcto, pero el peso medio y el color muted en estado normal hacen que una lista de 10 items se sienta homogénea.
- Los group labels usan uppercase + tracking `0.14em`, que funciona para sistemas densos, pero aquí consume energía visual para texto de poco valor.
- El email del footer en `11px` es legible, pero queda muy cerca del borde inferior y sin una superficie propia.

### Espaciado

El sidebar actual es compacto:

- Header: `px-3 py-3`.
- Nav: `py-3`, `px-2.5`.
- Items: `px-2.5 py-2`, icon box `28px`, gap `10px`.
- Separador: `my-3`.
- Footer: `px-3 py-3`.

Esto produce una densidad razonable para una app financiera, pero falta ritmo vertical. El bloque de 10 items principales queda como una lista continua. Linear resuelve esto no con más decoración, sino con aire, agrupación inteligente y estados menos ruidosos. Mercury lo hace con superficies sobrias y un footer que parece una mini cuenta/organización. Vercel lo hace con items muy discretos y active state minimal.

### Iconos

Los iconos son SVG inline custom, lo cual diferencia el producto de Lucide genérico y evita dependencia extra. El stroke se usa en `1.5` para nav, con tamaño `14px` en expandido y `16px` en colapsado.

Problemas:

- En expandido, el icono de 14px dentro de una caja de 28px se siente pequeño y ligeramente hundido.
- La caja de cada icono (`bg-surface-2`) hace que todos los items tengan dos elementos activos: el row y el icon chip. En una lista financiera densa, esto puede sentirse ocupado.
- Algunos iconos tienen geometría más compleja que otros (`settings` y `alerts` pesan más que `transactions`), por lo que conviene normalizar tamaño óptico y stroke.

### "FINANCE WORKSP..." debajo del nombre

El subtítulo actual es `Finance Workspace`. En el ancho expandido probablemente se ve completo, pero visualmente se percibe como "FINANCE WORKSP..." si el truncado, el ancho del contenedor o el render del sidebar lo limitan.

Evaluación:

- No aporta contexto operativo: el usuario ya está dentro de una app financiera llamada FinTrack.
- Compite con los labels de grupo, que también son microtexto uppercase.
- Hace que el header se parezca más a una plantilla SaaS que a una herramienta financiera madura.
- En un producto como Linear o Vercel, el segundo renglón del brand area suele usarse para workspace real, organización, plan o switcher. "Finance Workspace" no es accionable ni específico.

Recomendación: eliminarlo como tagline fijo. Si se necesita un segundo renglón, convertirlo en información útil: nombre del workspace/cuenta, por ejemplo "Personal portfolio", "Elias workspace" o "Soles + USD". Si no existe ese dato, no mostrar subtítulo.

### Logo

El logo usa `BrandMark` circular de 36px expandido y 34px colapsado. La posición es izquierda en expandido y centrada en colapsado, junto al botón de colapso. El mark oficial está en `public/brand/fintrack-mark.png` con 1024x1024, suficiente para render nítido.

Problemas:

- El mark de 36px es grande para una fila de header de `py-3`, sobre todo junto al botón de colapso.
- En collapsed, el header cambia a columna: logo arriba, toggle abajo. Esto aumenta altura del header y hace que el modo colapsado se sienta como una barra de herramientas vertical, no como un rail premium.
- El hover `scale-[1.04]` en el logo es decorativo y frecuente; para una app financiera conviene que el brand sea estable.

Recomendación: mark 32px expandido y 30px colapsado, sin scale hover o con cambio de ring/opacity muy sutil. En collapsed, el logo debe ser solo el isotipo centrado en una fila de altura fija; el botón de colapso debe moverse a un control discreto en el borde derecho del panel o integrarse como rail handle.

### Item activo

Hoy el item activo:

- Row: `bg-[var(--c-primary-soft)] text-[var(--c-primary)]`.
- Indicador: `boxShadow: inset 2px 0 0 var(--c-primary)`.
- Icon chip activo: otro `bg-[var(--c-primary-soft)]`.

Es correcto que no use fill verde sólido. Sin embargo, el tratamiento tiene tres problemas:

1. Duplica el fondo suave en row e icono.
2. El indicador de 2px se siente rígido y algo legacy.
3. No hay diferencia de profundidad, borde o highlight que haga que el estado activo se sienta "seleccionado" sin volverse ruidoso.

Recomendación: usar una cápsula sobria con borde interno, gradiente casi imperceptible y un "rail indicator" que sea una pieza separada de 3px x 18px con radio completo. El estado activo debería sentirse como una superficie seleccionada, no como un highlight de texto.

### Animaciones actuales de apertura/cierre

El sistema tiene buenos tokens base:

- `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)`.
- `--transition-fast: 120ms`.
- `--transition-base: 180ms`.
- `--transition-slow: 300ms`.

Uso actual:

- Sidebar: `transition-[width] duration-300 ease-out`.
- Logo text: `transition-all duration-300 ease-out`.
- Items: `transition-colors duration-150`.
- Tooltip collapsed: `transition-all duration-150`, con `opacity`, `translate-x`, `scale`.
- Mobile drawer: `transition-transform duration-300 ease-out`.
- Backdrop: `transition-opacity duration-300`.

Problemas:

- `transition-all` aparece en el logo y tooltip. Conviene especificar propiedades.
- Animar width en el sidebar puede causar layout reflow. Es aceptable para un cambio ocasional, pero si queremos máxima suavidad se puede mantener ancho del shell y animar contenido interno con `clip-path`, `opacity`, `transform` o CSS grid columns.
- Los labels desaparecen con `w-0 opacity-0`; esto puede producir un snap perceptible cuando el layout recalcula.
- El active state solo cambia color/fondo; falta transición de indicador y superficie.

## 2. Propuesta de rediseño total

### Dirección visual

Propuesta: "Private finance console".

Un sidebar sobrio, denso y preciso, con una superficie ligeramente diferente al dashboard. No debe parecer una tarjeta pegada al lado izquierdo ni un menú administrativo. Debe sentirse como la columna de navegación de un producto financiero serio: silencioso, con microcontraste, estado activo premium y controles exactos.

Principios:

- Menos adornos visibles, más precisión.
- Active state rico pero bajo en saturación.
- Dark mode con sidebar más profundo que el dashboard, no igual.
- El rail colapsado debe sentirse diseñado, no como el expandido al que le escondieron texto.
- Motion breve, con transform/opacity donde sea posible y tokens existentes.

### Logo y marca

Recomendación:

- Header expandido: altura fija 64px, `px-3`, logo mark 32px, wordmark 16px/600.
- Header colapsado: altura fija 64px, solo mark 30px centrado.
- Eliminar `Finance Workspace` como tagline fijo.
- Si se necesita subtítulo, que sea opcional y operativo: `workspaceName`, `planName`, `baseCurrencyLabel` o nombre real del usuario/espacio.
- El wordmark debe usar el token `--font-display`, no inline hardcoded.
- Evitar scale hover en marca; usar `opacity` o ring sutil para mantener sensación financiera.

Tratamiento propuesto:

```tsx
function SidebarLogo({
  collapsed,
  workspaceName,
}: {
  collapsed: boolean
  workspaceName?: string | null
}) {
  const subtitle = workspaceName?.trim() || null

  return (
    <Link
      href="/dashboard"
      className="group flex min-w-0 items-center gap-2.5 rounded-[var(--sidebar-control-radius)] outline-none transition-[background-color,box-shadow] duration-[var(--sidebar-motion-fast)] ease-[var(--ease-out)] focus-visible:shadow-[var(--sidebar-focus-ring)]"
      aria-label="Ir al dashboard"
    >
      <BrandMark
        size={collapsed ? 30 : 32}
        variant="default"
        className="shrink-0 transition-[box-shadow,opacity] duration-[var(--sidebar-motion-fast)] group-hover:opacity-95"
      />

      {!collapsed && (
        <div className="min-w-0 overflow-hidden">
          <p className="truncate font-display text-[16px] font-semibold leading-none tracking-[-0.018em] text-[var(--sidebar-brand-text)]">
            FinTrack
          </p>
          {subtitle && (
            <p className="mt-1 truncate text-[10.5px] font-medium leading-none text-[var(--sidebar-brand-muted)]">
              {subtitle}
            </p>
          )}
        </div>
      )}
    </Link>
  )
}
```

Si no hay workspace real, el header debe ser de una sola línea: mark + `FinTrack`.

### Navegación

#### Grupos Principal y Sistema

Mantener la separación conceptual, pero rediseñarla.

No recomiendo eliminar los grupos porque `NAV_MAIN` tiene 10 items y `NAV_SECONDARY` tiene 2. Sin una separación, la lista se vuelve larga y poco escaneable. Pero sí recomiendo reducir el énfasis visual de "Principal" y "Sistema".

Nuevo criterio:

- "Principal" puede omitirse visualmente si es el primer bloque. El contenido principal ya se entiende por posición.
- "Sistema" debe mantenerse como un label pequeño o como una línea con texto discreto porque separa ajustes/admin del flujo financiero.
- Alternativa premium: reemplazar "Principal" por un bloque "Overview" o "Money" solo si el producto se orienta más a workspace financiero. Pero por ahora no cambiaria labels sin investigación.

Tratamiento recomendado:

- Primer grupo sin label visible en desktop expandido, o label `Core`/`Principal` en sentence case de `11px`.
- Segundo grupo con label `Sistema` de `11px`, font-weight 500, sin uppercase pesado.
- Separador degradado o hairline de baja opacidad, no línea plana completa.

```tsx
function SidebarSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 pb-1.5 pt-2 text-[11px] font-medium leading-none text-[var(--sidebar-section-text)]">
      {children}
    </p>
  )
}
```

#### Items de nav

Tamaño propuesto:

- Row height: 38px expandido, 40px colapsado.
- Padding expandido: `6px 8px`.
- Radius: 10px.
- Label: `13px`, weight 520/medium. Como CSS no tiene 520 garantizado, usar `font-medium` con color más claro en activo.
- Gap: 9px.
- Icon box: eliminar fondo permanente. Usar box solo en active o hover sutil.
- Icon size: 16px expandido, 17px colapsado.
- Stroke width: 1.65 para todos los nav icons.

Esto reduce ruido y aumenta legibilidad.

#### Iconos

Mantener iconos inline custom. No migrar a otra librería. Ya están más diferenciados que Lucide.

Ajustes:

- `NavIcon size={16} strokeWidth={1.65}` en expandido.
- `NavIcon size={17} strokeWidth={1.65}` en colapsado.
- Contenedor de icono de `24px`, no `28px`, para que el row sea más compacto.
- Active: icono en `--sidebar-active-icon`, no necesariamente el mismo verde del texto.
- Hover: icono sube a `--sidebar-icon-hover`.

#### Item activo premium

Evitar fill verde sólido. Propuesta:

- Fondo: gradiente suave con mezcla de superficie y primary al 8-10%.
- Borde interno: `inset 0 0 0 1px var(--sidebar-active-border)`.
- Indicador lateral: pseudo-elemento absoluto de `3px x 18px`, ubicado `left: 3px`, con radio completo y sombra tintada.
- Texto: `--sidebar-active-text`, un forest profundo en light y mint desaturado en dark.
- Icono: mismo color activo, pero con opacidad 0.95.
- Sombra: highlight interno superior muy sutil, no drop shadow pesado.

Ejemplo de clase CSS:

```css
.sidebar-nav-link {
  position: relative;
  display: flex;
  min-height: var(--sidebar-item-height);
  align-items: center;
  gap: var(--sidebar-item-gap);
  border-radius: var(--sidebar-item-radius);
  padding: 0 var(--sidebar-item-padding-x);
  color: var(--sidebar-item-text);
  font-size: var(--sidebar-item-font-size);
  font-weight: 500;
  letter-spacing: 0;
  transition:
    background-color var(--sidebar-motion-base),
    color var(--sidebar-motion-base),
    box-shadow var(--sidebar-motion-base),
    transform var(--sidebar-motion-fast);
}

.sidebar-nav-link::before {
  content: "";
  position: absolute;
  left: 3px;
  top: 50%;
  width: 3px;
  height: 18px;
  border-radius: var(--radius-pill);
  background: var(--sidebar-active-rail);
  opacity: 0;
  transform: translateY(-50%) scaleY(0.72);
  transition:
    opacity var(--sidebar-motion-base),
    transform var(--sidebar-motion-base);
}

.sidebar-nav-link[data-active="true"] {
  color: var(--sidebar-active-text);
  background:
    linear-gradient(180deg, var(--sidebar-active-bg-top), var(--sidebar-active-bg-bottom));
  box-shadow:
    inset 0 0 0 1px var(--sidebar-active-border),
    inset 0 1px 0 var(--sidebar-active-highlight);
}

.sidebar-nav-link[data-active="true"]::before {
  opacity: 1;
  transform: translateY(-50%) scaleY(1);
}

.sidebar-nav-link:hover {
  color: var(--sidebar-item-hover-text);
  background: var(--sidebar-item-hover-bg);
}

.sidebar-nav-link:active {
  transform: scale(0.985);
}
```

#### Hover states

Hover financiero: rápido, casi táctil, sin movimiento lateral exagerado.

- Row hover: `background-color` a `--sidebar-item-hover-bg`.
- Texto hover: `--sidebar-item-hover-text`.
- Icon hover: `--sidebar-icon-hover`.
- Active item hover: mantener estado activo, solo elevar border/highlight un poco.
- Pressed: `scale(0.985)` 120ms.

No recomiendo `translateX(2px)` en todos los items; en una lista usada decenas de veces al día se siente juguetón. Mejor feedback de superficie.

#### Badges

Los badges actuales existen por `navBadges`. Mantenerlos, pero sofisticarlos:

- Para alertas financieras, usar dot o contador discreto, no rojo lleno salvo urgencia real.
- Default badge: fondo `--sidebar-badge-bg`, texto `--sidebar-badge-text`, borde interno.
- Urgente: `--sidebar-badge-danger-bg`.
- Collapsed: dot/contador en esquina superior derecha, de 7-16px según número.

```tsx
function SidebarBadge({ value, active }: { value: number; active: boolean }) {
  if (value <= 0) return null

  return (
    <span
      className="sidebar-badge"
      data-active={active ? 'true' : 'false'}
      aria-label={`${value} notificaciones`}
    >
      {value > 99 ? '99+' : value}
    </span>
  )
}
```

```css
.sidebar-badge {
  min-width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-pill);
  padding: 0 6px;
  background: var(--sidebar-badge-bg);
  color: var(--sidebar-badge-text);
  box-shadow: inset 0 0 0 1px var(--sidebar-badge-border);
  font-size: 10px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.sidebar-badge[data-active="true"] {
  background: var(--sidebar-badge-active-bg);
  color: var(--sidebar-active-text);
}
```

### Footer del sidebar

El footer actual es correcto pero básico: avatar + name + email + logout icon. Propongo convertirlo en una "account dock" premium:

- Superficie propia con fondo `--sidebar-footer-bg`, border interno y radio 12px.
- Avatar 30px, rounded 9px o squircle, no círculo.
- Nombre 12.5px/600.
- Email 11px/400 con color muted.
- Logout como icon button de 28px, visible al hover/focus o siempre con opacidad baja.
- En collapsed: solo avatar centrado con tooltip/account menu futuro; logout no debe desaparecer funcionalmente si no hay otra salida accesible. Puede moverse a tooltip/menu o mantenerse como pequeño botón debajo.

Tratamiento:

```tsx
function SidebarProfile({ user, collapsed }: SidebarProfileProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const avatarSrc = resolveUserAvatar(user.avatar, user.email || user.name)
  const displayName = getDisplayName(user)

  if (collapsed) {
    return (
      <div className="sidebar-account-collapsed">
        <button className="sidebar-avatar-button" aria-label={`Cuenta de ${displayName}`}>
          <Image src={avatarSrc} alt="Avatar de usuario" width={30} height={30} unoptimized />
        </button>
        <button className="sidebar-logout-collapsed" onClick={handleSignOut} aria-label="Cerrar sesión">
          <IconLogOut size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="sidebar-account-card">
      <Image
        src={avatarSrc}
        alt="Avatar de usuario"
        width={32}
        height={32}
        unoptimized
        className="sidebar-account-avatar"
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-semibold leading-tight text-[var(--sidebar-account-name)]">
          {displayName}
        </p>
        <p className="mt-0.5 truncate text-[11px] leading-tight text-[var(--sidebar-account-email)]">
          {user.email}
        </p>
      </div>

      <button className="sidebar-icon-button" onClick={handleSignOut} aria-label="Cerrar sesión">
        <IconLogOut size={14} />
      </button>
    </div>
  )
}
```

```css
.sidebar-account-card {
  display: flex;
  min-height: 48px;
  align-items: center;
  gap: 10px;
  border-radius: var(--sidebar-footer-radius);
  background: var(--sidebar-footer-bg);
  box-shadow:
    inset 0 0 0 1px var(--sidebar-footer-border),
    inset 0 1px 0 var(--sidebar-footer-highlight);
  padding: 8px;
}

.sidebar-account-avatar {
  width: 32px;
  height: 32px;
  flex: none;
  border-radius: 9px;
  object-fit: cover;
  box-shadow: inset 0 0 0 1px var(--sidebar-avatar-border);
}

.sidebar-icon-button {
  display: inline-flex;
  width: 28px;
  height: 28px;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: var(--sidebar-control-radius);
  color: var(--sidebar-control-text);
  transition:
    background-color var(--sidebar-motion-fast),
    color var(--sidebar-motion-fast),
    transform var(--sidebar-motion-fast);
}

.sidebar-icon-button:hover {
  background: var(--sidebar-control-hover-bg);
  color: var(--sidebar-control-hover-text);
}

.sidebar-icon-button:active {
  transform: scale(0.96);
}
```

### Animaciones

Usar los tokens existentes como fuente:

- `--transition-fast` para hover/press: 120ms.
- `--transition-base` para color/fondo/indicator: 180ms.
- `--transition-slow` para drawer/sidebar: 300ms.
- `--ease-out` para entradas y cambios iniciados por usuario.
- `--ease-in-out` solo para movimientos en pantalla más grandes, si hiciera falta.

#### Apertura/cierre del sidebar

Mejor implementación sin dependencia nueva:

- Mantener transición del ancho del `<aside>` porque el cambio es ocasional y afecta layout real.
- Cambiar `transition-[width] duration-300 ease-out` por `transition-[width] duration-[var(--sidebar-motion-drawer)] ease-[var(--ease-out)]`.
- Dentro, animar texto con `opacity + transform + max-width`, no `transition-all`.
- Header colapsado con altura constante.

```tsx
<aside
  className="fin-sidebar hidden md:flex h-screen sticky top-0 flex-col p-[var(--sidebar-shell-gap)] transition-[width] duration-[var(--sidebar-motion-drawer)] ease-[var(--ease-out)]"
  style={{ width: collapsed ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width-expanded)' }}
>
```

#### Transición del item activo

- Usar `data-active`.
- Pseudo-elemento `::before` para rail activo.
- Transicionar `opacity`, `transform`, `background-color`, `color`, `box-shadow`.
- No animar `left`, `width`, `height`.

#### Hover de items

- Hover solo en color/fondo.
- Press con scale breve.
- Focus visible con shadow token.

#### Mobile drawer

El drawer actual con `translate-x` es correcto. Ajustes:

- Usar `duration-[var(--sidebar-motion-drawer)]`.
- Overlay 220ms; panel 300ms.
- Panel puede entrar con `translate-x` y un leve `opacity` si se quiere, sin scale.
- No usar `backdrop-filter` más alto que 3-6px.

### Collapsed mode

El modo colapsado actual funciona, pero debe sentirse como un rail intencional:

- Width: mantener 80px si el panel interior conserva padding. No bajar a 56px porque los tooltips y botones tendrían menos aire.
- Logo: solo isotipo 30px, centrado.
- Toggle: no debajo del logo; ubicar en un handle lateral o botón fijo en header alineado al centro.
- Items: `40px x 40px`, icono 17px, radius 10px.
- Tooltip: debe abrir hacia la derecha, con nombre y opcionalmente descripción, pero la descripción actual puede ser demasiado larga. Para uso diario, mostrar solo label y quizá descripción en `aria-label`, no visual.
- Active: rail + superficie activa en la celda de icono.
- Badges: dot/contador mini.

Tooltip premium:

```css
.sidebar-tooltip {
  pointer-events: none;
  position: absolute;
  left: calc(100% + 10px);
  top: 50%;
  z-index: var(--z-tooltip);
  transform: translate3d(-2px, -50%, 0) scale(0.98);
  transform-origin: left center;
  border-radius: 10px;
  background: var(--sidebar-tooltip-bg);
  box-shadow: var(--sidebar-tooltip-shadow);
  color: var(--sidebar-tooltip-text);
  opacity: 0;
  padding: 7px 9px;
  font-size: 12px;
  font-weight: 550;
  line-height: 1;
  white-space: nowrap;
  transition:
    opacity var(--sidebar-motion-fast),
    transform var(--sidebar-motion-fast);
}

.group:hover .sidebar-tooltip,
.group:focus-visible .sidebar-tooltip {
  opacity: 1;
  transform: translate3d(0, -50%, 0) scale(1);
}
```

### Dark mode

El dark mode actual usa:

- `--ft-bg: #161615`.
- `--ft-sidebar-bg: #1a1a18`.
- `--ft-surface: #1e1e1c`.
- `--ft-primary: #2dd4a8`.

Problema: el sidebar dark está muy cerca del dashboard, lo que reduce jerarquía. Para una app financiera, el sidebar puede ser un tono más profundo y ligeramente más frío que el canvas, como Linear/Vercel, pero sin romper la calidez general.

Paleta propuesta para sidebar dark:

- Sidebar shell: `#111312`.
- Sidebar panel: `#171917`.
- Sidebar surface muted: `#1d211f`.
- Hover: `#232a27`.
- Border: `rgba(234, 244, 238, 0.075)`.
- Active text: `#9eead2`.
- Active bg top: `rgba(45, 212, 168, 0.105)`.
- Active bg bottom: `rgba(45, 212, 168, 0.055)`.
- Active border: `rgba(142, 239, 210, 0.18)`.
- Muted text: `#8d9691`.
- Faint text: `#626b66`.

En light mode:

- Sidebar shell: `#f5f4ef`.
- Sidebar panel: `#fbfaf7`.
- Hover: `#f0eee8`.
- Active bg top: `rgba(13, 107, 94, 0.088)`.
- Active bg bottom: `rgba(13, 107, 94, 0.045)`.
- Active text: `#07584e`.
- Active border: `rgba(13, 107, 94, 0.18)`.

## 3. Sistema de tokens nuevos para el sidebar

Agregar tokens específicos evita sobrecargar `--c-primary-soft` para demasiados roles. Recomendación: definirlos en `:root` y sobrescribir en `:root[data-theme='dark']`.

```css
:root {
  --sidebar-shell-gap: 10px;
  --sidebar-panel-radius: 18px;
  --sidebar-control-radius: 9px;
  --sidebar-item-radius: 10px;
  --sidebar-footer-radius: 12px;

  --sidebar-width-expanded: 248px;
  --sidebar-width-collapsed: 80px;
  --sidebar-header-height: 64px;
  --sidebar-item-height: 38px;
  --sidebar-item-height-collapsed: 40px;
  --sidebar-item-padding-x: 8px;
  --sidebar-item-gap: 9px;
  --sidebar-item-font-size: 13px;

  --sidebar-motion-fast: var(--transition-fast);
  --sidebar-motion-base: var(--transition-base);
  --sidebar-motion-drawer: var(--transition-slow);

  --sidebar-shell-bg: #f5f4ef;
  --sidebar-panel-bg: #fbfaf7;
  --sidebar-panel-border: rgba(25, 25, 23, 0.075);
  --sidebar-panel-shadow: 0 1px 2px rgba(25, 25, 23, 0.04), 0 16px 40px rgba(25, 25, 23, 0.045);

  --sidebar-brand-text: #161714;
  --sidebar-brand-muted: #827d74;
  --sidebar-section-text: #8c877d;

  --sidebar-item-text: #69645c;
  --sidebar-item-hover-text: #1f211d;
  --sidebar-item-hover-bg: #f0eee8;
  --sidebar-icon: #837e75;
  --sidebar-icon-hover: #383b35;

  --sidebar-active-text: #07584e;
  --sidebar-active-icon: #0d6b5e;
  --sidebar-active-bg-top: rgba(13, 107, 94, 0.088);
  --sidebar-active-bg-bottom: rgba(13, 107, 94, 0.045);
  --sidebar-active-border: rgba(13, 107, 94, 0.18);
  --sidebar-active-highlight: rgba(255, 255, 255, 0.72);
  --sidebar-active-rail: linear-gradient(180deg, #0d6b5e 0%, #43a08d 100%);

  --sidebar-badge-bg: rgba(184, 74, 74, 0.09);
  --sidebar-badge-text: #9f3d3d;
  --sidebar-badge-border: rgba(184, 74, 74, 0.14);
  --sidebar-badge-active-bg: rgba(13, 107, 94, 0.11);

  --sidebar-footer-bg: rgba(255, 255, 255, 0.62);
  --sidebar-footer-border: rgba(25, 25, 23, 0.075);
  --sidebar-footer-highlight: rgba(255, 255, 255, 0.78);
  --sidebar-account-name: #191917;
  --sidebar-account-email: #767168;
  --sidebar-avatar-border: rgba(25, 25, 23, 0.1);

  --sidebar-control-text: #777268;
  --sidebar-control-hover-text: #0d6b5e;
  --sidebar-control-hover-bg: rgba(13, 107, 94, 0.075);
  --sidebar-focus-ring: 0 0 0 3px rgba(13, 107, 94, 0.16);

  --sidebar-tooltip-bg: #191917;
  --sidebar-tooltip-text: #ffffff;
  --sidebar-tooltip-shadow: 0 10px 28px rgba(25, 25, 23, 0.16);

  --z-tooltip: 30;
}

:root[data-theme='dark'] {
  --sidebar-shell-bg: #111312;
  --sidebar-panel-bg: #171917;
  --sidebar-panel-border: rgba(234, 244, 238, 0.075);
  --sidebar-panel-shadow: 0 1px 0 rgba(255, 255, 255, 0.025), 0 18px 44px rgba(0, 0, 0, 0.28);

  --sidebar-brand-text: #f0f2ef;
  --sidebar-brand-muted: #7d8781;
  --sidebar-section-text: #626b66;

  --sidebar-item-text: #8d9691;
  --sidebar-item-hover-text: #eef4f0;
  --sidebar-item-hover-bg: #232a27;
  --sidebar-icon: #737d77;
  --sidebar-icon-hover: #d8e2dc;

  --sidebar-active-text: #9eead2;
  --sidebar-active-icon: #8ee6ce;
  --sidebar-active-bg-top: rgba(45, 212, 168, 0.105);
  --sidebar-active-bg-bottom: rgba(45, 212, 168, 0.055);
  --sidebar-active-border: rgba(142, 239, 210, 0.18);
  --sidebar-active-highlight: rgba(255, 255, 255, 0.055);
  --sidebar-active-rail: linear-gradient(180deg, #9eead2 0%, #2dd4a8 100%);

  --sidebar-badge-bg: rgba(248, 113, 113, 0.12);
  --sidebar-badge-text: #ffb4b4;
  --sidebar-badge-border: rgba(248, 113, 113, 0.18);
  --sidebar-badge-active-bg: rgba(45, 212, 168, 0.12);

  --sidebar-footer-bg: rgba(255, 255, 255, 0.035);
  --sidebar-footer-border: rgba(255, 255, 255, 0.075);
  --sidebar-footer-highlight: rgba(255, 255, 255, 0.045);
  --sidebar-account-name: #f2f4f1;
  --sidebar-account-email: #8d9691;
  --sidebar-avatar-border: rgba(255, 255, 255, 0.12);

  --sidebar-control-text: #8d9691;
  --sidebar-control-hover-text: #9eead2;
  --sidebar-control-hover-bg: rgba(45, 212, 168, 0.1);
  --sidebar-focus-ring: 0 0 0 3px rgba(45, 212, 168, 0.18);

  --sidebar-tooltip-bg: #eef4f0;
  --sidebar-tooltip-text: #111312;
  --sidebar-tooltip-shadow: 0 14px 34px rgba(0, 0, 0, 0.34);
}
```

## 4. Código concreto de cada elemento propuesto

### StaticSidebar

```tsx
export function StaticSidebar({ mode, user, badges = {} }: StaticSidebarProps) {
  const { toggleUserCollapse } = useLayout()
  const collapsed = mode === 'collapsed'

  return (
    <aside
      className="fin-sidebar hidden md:flex h-screen sticky top-0 flex-col bg-[var(--sidebar-shell-bg)] p-[var(--sidebar-shell-gap)] transition-[width] duration-[var(--sidebar-motion-drawer)] ease-[var(--ease-out)]"
      style={{
        width: collapsed
          ? 'var(--sidebar-width-collapsed)'
          : 'var(--sidebar-width-expanded)',
      }}
    >
      <div className="relative flex h-full flex-col overflow-visible rounded-[var(--sidebar-panel-radius)] border border-[var(--sidebar-panel-border)] bg-[var(--sidebar-panel-bg)] shadow-[var(--sidebar-panel-shadow)]">
        <SidebarHeader collapsed={collapsed} onToggle={toggleUserCollapse} />
        <SidebarNavigation mode={mode} badges={badges} />
        <SidebarFooter user={user} collapsed={collapsed} />
      </div>
    </aside>
  )
}
```

### SidebarHeader

```tsx
function SidebarHeader({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  return (
    <div
      className="relative flex h-[var(--sidebar-header-height)] items-center border-b border-[var(--sidebar-panel-border)] px-3"
      data-collapsed={collapsed ? 'true' : 'false'}
    >
      <div className={collapsed ? 'mx-auto' : 'min-w-0 flex-1'}>
        <SidebarLogo collapsed={collapsed} />
      </div>

      <button
        onClick={onToggle}
        aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
        className="sidebar-collapse-button"
      >
        {collapsed ? <IconChevronRight size={13} /> : <IconChevronLeft size={13} />}
      </button>
    </div>
  )
}
```

```css
.sidebar-collapse-button {
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  flex: none;
  border-radius: var(--sidebar-control-radius);
  color: var(--sidebar-control-text);
  transition:
    background-color var(--sidebar-motion-fast),
    color var(--sidebar-motion-fast),
    transform var(--sidebar-motion-fast),
    box-shadow var(--sidebar-motion-fast);
}

.sidebar-collapse-button:hover {
  background: var(--sidebar-control-hover-bg);
  color: var(--sidebar-control-hover-text);
}

.sidebar-collapse-button:focus-visible {
  outline: none;
  box-shadow: var(--sidebar-focus-ring);
}

.sidebar-collapse-button:active {
  transform: scale(0.96);
}
```

### SidebarNavigation

```tsx
function SidebarNavigation({
  mode,
  badges,
}: {
  mode: SidebarMode | 'drawer'
  badges: Partial<Record<string, number>>
}) {
  const collapsed = mode === 'collapsed'

  return (
    <nav className="flex-1 overflow-y-auto overflow-x-visible px-2 py-3" aria-label="Navegación principal">
      {!collapsed && <SidebarSectionLabel>Principal</SidebarSectionLabel>}
      <ul className="space-y-1">
        {NAV_MAIN.map(item => (
          <NavItem key={item.key} item={item} mode={mode} badge={badges[item.key]} />
        ))}
      </ul>

      <div className="mx-2 my-3 h-px bg-gradient-to-r from-transparent via-[var(--sidebar-panel-border)] to-transparent" />

      {!collapsed && <SidebarSectionLabel>Sistema</SidebarSectionLabel>}
      <ul className="space-y-1">
        {NAV_SECONDARY.map(item => (
          <NavItem key={item.key} item={item} mode={mode} badge={badges[item.key]} />
        ))}
      </ul>
    </nav>
  )
}
```

### NavItem expandido

```tsx
export function NavItem({ item, mode, badge = 0, onClick }: NavItemProps) {
  const pathname = usePathname()
  const activeItem = getActiveNavItem(pathname)
  const isActive = activeItem?.key === item.key
  const collapsed = mode === 'collapsed'

  const handleClick = useCallback(() => { onClick?.() }, [onClick])

  if (collapsed) {
    return (
      <CollapsedNavItem
        item={item}
        badge={badge}
        isActive={isActive}
        onClick={handleClick}
      />
    )
  }

  return (
    <li>
      <Link
        href={item.href}
        onClick={handleClick}
        className="sidebar-nav-link"
        data-active={isActive ? 'true' : 'false'}
        aria-current={isActive ? 'page' : undefined}
      >
        <span className="sidebar-nav-icon">
          <NavIcon name={item.icon} size={16} strokeWidth={1.65} />
        </span>
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        <SidebarBadge value={badge} active={isActive} />
      </Link>
    </li>
  )
}
```

```css
.sidebar-nav-icon {
  display: inline-flex;
  width: 24px;
  height: 24px;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: var(--sidebar-icon);
  transition:
    background-color var(--sidebar-motion-base),
    color var(--sidebar-motion-base);
}

.sidebar-nav-link:hover .sidebar-nav-icon {
  color: var(--sidebar-icon-hover);
}

.sidebar-nav-link[data-active="true"] .sidebar-nav-icon {
  color: var(--sidebar-active-icon);
}
```

### NavItem colapsado

```tsx
function CollapsedNavItem({
  item,
  badge,
  isActive,
  onClick,
}: {
  item: NavItemType
  badge: number
  isActive: boolean
  onClick: () => void
}) {
  return (
    <li>
      <Link
        href={item.href}
        onClick={onClick}
        aria-label={item.label}
        aria-current={isActive ? 'page' : undefined}
        className="sidebar-nav-link sidebar-nav-link-collapsed group"
        data-active={isActive ? 'true' : 'false'}
      >
        <NavIcon name={item.icon} size={17} strokeWidth={1.65} />
        {badge > 0 && <span className="sidebar-collapsed-badge">{badge > 9 ? '9+' : badge}</span>}
        <span className="sidebar-tooltip">{item.label}</span>
      </Link>
    </li>
  )
}
```

```css
.sidebar-nav-link-collapsed {
  width: var(--sidebar-item-height-collapsed);
  min-height: var(--sidebar-item-height-collapsed);
  justify-content: center;
  margin-inline: auto;
  padding: 0;
}

.sidebar-collapsed-badge {
  position: absolute;
  right: 4px;
  top: 4px;
  min-width: 14px;
  height: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-pill);
  background: var(--sidebar-badge-bg);
  color: var(--sidebar-badge-text);
  box-shadow: inset 0 0 0 1px var(--sidebar-badge-border);
  font-size: 8px;
  font-weight: 700;
  line-height: 1;
}
```

### Mobile drawer

```tsx
<div
  className={`
    md:hidden fixed inset-0 z-40
    bg-[var(--c-overlay)] backdrop-blur-[4px]
    transition-opacity duration-[220ms] ease-[var(--ease-out)]
    ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
  `}
  onClick={onClose}
  aria-hidden
/>

<aside
  className={`
    fin-mobile-drawer md:hidden fixed inset-y-0 left-0 z-50
    w-[286px] p-[var(--sidebar-shell-gap)] flex flex-col
    bg-transparent
    transition-transform duration-[var(--sidebar-motion-drawer)] ease-[var(--ease-out)]
    ${open ? 'translate-x-0' : '-translate-x-full'}
  `}
  aria-label="Menú de navegación"
>
```

### Ajuste opcional a `lib/constants/nav.ts`

No es necesario cambiar la data para el rediseño visual. Pero si queremos tooltips más premium, conviene separar descripción larga de tooltip corto:

```ts
export interface NavItem {
  key: string
  label: string
  href: string
  icon: NavIconKey
  exact?: boolean
  description: string
  tooltip?: string
  section: 'main' | 'secondary'
}
```

Ejemplo:

```ts
{
  key: 'transactions',
  label: 'Movimientos',
  href: '/transactions',
  icon: 'transactions',
  description: 'Registro de ingresos, egresos y transferencias',
  tooltip: 'Movimientos',
  section: 'main',
}
```

## 5. Orden de implementación

1. Crear tokens sidebar en `app/globals.css`.
   - Agregar `--sidebar-*` en `:root`.
   - Agregar overrides dark en `:root[data-theme='dark']`.
   - No reemplazar tokens globales aún.

2. Crear clases CSS base.
   - `.sidebar-nav-link`.
   - `.sidebar-nav-icon`.
   - `.sidebar-badge`.
   - `.sidebar-tooltip`.
   - `.sidebar-account-card`.
   - `.sidebar-icon-button`.
   - `.sidebar-collapse-button`.

3. Refactorizar `SidebarLogo`.
   - Eliminar `Finance Workspace` fijo.
   - Usar logo 32/30px.
   - Usar `--font-display` y eliminar inline `fontFamily` si se ajusta `BrandWordmark`.

4. Refactorizar `NavItem`.
   - Usar `data-active`.
   - Separar collapsed en subcomponente.
   - Cambiar active state de inline `boxShadow` a CSS.
   - Ajustar iconos a 16/17px y stroke 1.65.

5. Refactorizar shell visual de `StaticSidebar`.
   - Usar tokens para width, shell gap, panel radius, panel background.
   - Mantener comportamiento de `useLayout`.
   - No tocar rutas ni lógica de auth.

6. Rediseñar footer.
   - Convertir perfil en account dock.
   - Mantener logout accesible.
   - Resolver collapsed mode con avatar + logout/tooltip.

7. Ajustar mobile drawer.
   - Reutilizar los mismos componentes.
   - Mantener slide transform.
   - Alinear width a 286px si se adopta nueva densidad.

8. QA visual y funcional.
   - Desktop expandido.
   - Desktop colapsado.
   - Tablet colapsado automático.
   - Mobile drawer.
   - Dark mode.
   - Rutas activas con prefijo.
   - Badges 1, 9, 10, 99+.
   - Focus visible por teclado.
   - Logout accesible en expanded, collapsed y mobile.

9. Revisión de microinteracciones.
   - Confirmar que no hay `transition-all` en elementos críticos.
   - Confirmar que hover/active no mueve layout.
   - Confirmar que tooltips no quedan cortados por `overflow-hidden` del panel. Para esto, el panel interior debe permitir `overflow-visible` o el tooltip debe renderizarse en portal.

## Resumen de decisión

El sidebar actual ya corrigió el problema principal de "fill verde sólido", pero aún se percibe como una versión v3 de un menú administrativo: correcto, compacto y tokenizado, aunque no completamente premium.

El rediseño recomendado lo lleva hacia un rail financiero tipo Linear/Mercury/Vercel:

- Marca más sobria.
- Sin tagline genérico.
- Grupos menos gritados.
- Iconos más limpios.
- Active state de superficie + rail, no simple tint.
- Footer como account dock.
- Collapsed mode pensado como rail.
- Dark mode más profundo y diferenciado.
- Motion breve, tokenizada y sin `transition-all` en piezas principales.

La implementación puede hacerse sin nuevas dependencias y sin tocar la lógica de navegación, auth o layout provider.
