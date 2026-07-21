# /impeccable audit — FinTrack `app/` & `components/`

> Auditado: `app/globals.css` (4 629 líneas) · `components/layout/` · `components/ui/`  
> Sin tocar: lógica de componentes, props, server actions, data-fetching  
> Convenciones: Tailwind v3 + clases custom `fin-*` + tokens CSS `--c-*`

---

## ✅ Lo que ya está bien — no romper

| Qué | Por qué funciona |
|---|---|
| Sistema de 4 colores (`forest`, `lime`, `stone`, `ink`) + tokens `--c-*` | Paleta cohesiva y derivada; aliases semánticos limpios |
| Escala de sombras `--shadow-sm/md/lg/xl` tintadas en green | Sombras con hue propio evitan el negro neutro genérico |
| `font-variant-numeric: tabular-nums` en cantidades financieras | Crítico para alineación de cifras en tablas |
| Sidebar "pill" con `rounded-[24px]` + `bg-white` sobre wrapper transparente | Efecto de isla flotante: diferencia real de un sidebar plano |
| `@media (prefers-reduced-motion: reduce)` en todos los conjuntos de animación | Respeto correcto a la preferencia del usuario |
| `.ui-pressable` + `will-change: transform` en CTA buttons | Aceleración GPU sin contaminar elementos no-interactivos |
| `backdrop-filter` sólo en `fin-sidebar`, `fin-topbar` y modales | Glass bien acotado; no usado como decoración genérica |
| `@layer components` para `.field-base`, `.btn-primary`, `.surface` | Encapsulación correcta; evita conflictos de especificidad |
| `:focus-visible` (no `:focus`) para contornos de teclado | Estándar moderno; no penaliza usuarios de mouse |
| Animaciones de entrada con `cubic-bezier(0.22, 1, 0.36, 1)` | Curva ease-out-expo; natural y no excesiva |

---

## 🔴 BLOQUEADORES

### B-1 · Tipografía — `font-size: 15px` en `html` rompe la escala rem

**Dominio:** Tipografía  

El root `html { font-size: 15px }` hace que `1rem = 15px` en lugar de `16px`. Esto desacopla todos los valores `rem` del estándar del sistema operativo y hace que las Tailwind utilities (`text-sm`, `text-base`, etc.) produzcan tamaños inesperados que no coinciden con lo que el diseñador intuye.

```css
/* globals.css · línea 315 — ACTUAL */
html {
  font-size: 15px; /* ← rompe 1rem = 16px */
}

/* FIX */
html {
  font-size: 100%; /* deja que el OS defina la raíz; ~16px por defecto */
}
```

Si quieres tipografía ligeramente más pequeña que el navegador, hazlo en `body`:

```css
body {
  font-size: 0.9375rem; /* 15px / 16px = 93.75% — equivalente, pero respeta accesibilidad */
}
```

---

### B-2 · Color — Token `--c-accent` (#3F6FD8 Slate Blue) nunca se usa en la UI del dashboard

**Dominio:** Color  

El sistema declara un segundo acento (`--c-accent: #3F6FD8`) pero todos los componentes del dashboard usan `--c-primary` (`#0E4F46` forest). El slate-blue sólo aparece en la landing page. Esto crea un sistema de 4 colores que en la práctica funciona como 3, y confunde a cualquiera que edite estilos: ¿usan `--c-accent` o `--c-primary`?

**Fix:** clarificar el rol o eliminar la ambigüedad.

```css
/* :root — unificar nombres */

/* OPCIÓN A: renombrar para aclarar contexto */
--c-accent-landing: #3F6FD8;   /* sólo landing page */
--c-accent-ui:      #0E4F46;   /* mismo que --c-primary → alias */

/* OPCIÓN B (más limpia): eliminar --c-accent del :root,
   y usar --c-primary como único acento en la app */
```

En Tailwind, el token `accent.DEFAULT` ya apunta a `#0D4F4A`. Asegurarse de que en componentes de dashboard **nunca** se use `text-[var(--c-accent)]` cuando se quiere forest.

---

### B-3 · Motion — `filter: blur()` en keyframes de animaciones de auth

**Dominio:** Motion  

En `auth-mode-swap` y `liquid-dialog-enter` se anima la propiedad `filter`:

```css
@keyframes auth-mode-swap {
  from { filter: blur(1.2px); }  /* ← layout trigger en CPU */
  to   { filter: blur(0); }
}

@keyframes liquid-dialog-enter {
  from { filter: blur(3px); }    /* ← idem */
  to   { filter: blur(0); }
}
```

`filter` no es una propiedad GPU-compositable: fuerza repaint en cada frame. En Safari/iOS es especialmente costoso y causa jank visible al abrir modales.

```css
/* FIX: eliminar blur del keyframe; aplicarlo sólo como estado inicial via clase */

@keyframes auth-mode-swap {
  from { opacity: 0; transform: translateY(10px) scale(0.992); }
  to   { opacity: 1; transform: translateY(0)    scale(1); }
}

@keyframes liquid-dialog-enter {
  from { opacity: 0; transform: translateY(18px) scale(0.985); }
  to   { opacity: 1; transform: translateY(0)    scale(1); }
}

/* Si necesitas blur en el fondo (overlay), úsalo en el overlay,
   no en el elemento que anima */
```

---

## 🟡 MEJORAS

### M-1 · Color — `border-left: 3px solid` en `.fin-auth-feature-card[data-tone='*']`

**Dominio:** Color / Layout  
**Regla impeccable violada:** "Side-stripe borders. Never intentional."

```css
/* globals.css líneas 1387–1401 */
.fin-auth-feature-card[data-tone='teal']    { border-left: 3px solid rgba(15, 118, 110, 0.74); }
.fin-auth-feature-card[data-tone='blue']    { border-left: 3px solid rgba(14, 116, 217, 0.74); }
.fin-auth-feature-card[data-tone='emerald'] { border-left: 3px solid rgba(5, 150, 105, 0.74); }
.fin-auth-feature-card[data-tone='slate']   { border-left: 3px solid rgba(100, 116, 139, 0.56); }
```

**Fix:** reemplazar la franja lateral con un tint de fondo completo o con el ícono coloreado como señal semántica.

```css
/* Reemplazar las 4 reglas border-left por background tints completos */
.fin-auth-feature-card[data-tone='teal'] {
  border-color: rgba(15, 118, 110, 0.22);
  background: rgba(15, 118, 110, 0.04);
}
.fin-auth-feature-card[data-tone='blue'] {
  border-color: rgba(14, 116, 217, 0.22);
  background: rgba(14, 116, 217, 0.04);
}
.fin-auth-feature-card[data-tone='emerald'] {
  border-color: rgba(5, 150, 105, 0.22);
  background: rgba(5, 150, 105, 0.04);
}
.fin-auth-feature-card[data-tone='slate'] {
  border-color: rgba(100, 116, 139, 0.18);
  background: rgba(100, 116, 139, 0.03);
}
```

---

### M-2 · Tipografía — Microtexto a 0.56–0.66rem (≈ 8–10px) en múltiples componentes

**Dominio:** Tipografía  

Varias clases usan tamaños de fuente menores al límite legible (≥ 11px / ~0.72rem):

```css
.fin-auth-metric-label { font-size: clamp(0.56rem, …) }   /* ≈ 8.4px mínimo */
.fin-landing-donut-label { font-size: 0.6rem; }            /* ≈ 9px */
.fin-landing-legend-item { font-size: 0.62rem; }           /* ≈ 9.3px */
.fin-landing-mockup-stat-label { font-size: 0.6rem; }      /* ≈ 9px */
.fin-landing-mockup-chart-legend { font-size: 0.58rem; }   /* ≈ 8.7px */
```

WCAG 1.4.4 requiere texto escalable. Por debajo de 11px el texto se vuelve ilegible en pantallas de baja DPI y para usuarios con visión reducida.

```css
/* Mínimos corregidos — aplicar con buscar-y-reemplazar en globals.css */

/* Antes → Después */
font-size: 0.56rem  →  font-size: 0.68rem   /* 10.9px @ 16px root */
font-size: 0.58rem  →  font-size: 0.7rem    /* 11.2px */
font-size: 0.6rem   →  font-size: 0.72rem   /* 11.5px */
font-size: 0.62rem  →  font-size: 0.72rem   /* 11.5px */

/* Para clamp(), elevar el valor mínimo: */
font-size: clamp(0.56rem, 0.62vw, 0.64rem)
→ font-size: clamp(0.72rem, 0.7vw, 0.78rem)
```

---

### M-3 · Espaciado — `pb-24` fijo en el scroll container del dashboard

**Dominio:** Espaciado  

En `AppShell.tsx`:
```tsx
<div className="page-transition-enter w-full px-3 pb-24 pt-4 sm:px-4 lg:px-5 xl:px-6">
```

`pb-24` (96px) es un valor fijo que reserva espacio para el FAB. Funciona, pero acopla el layout de página a la existencia del FAB. Si el FAB desaparece o cambia de tamaño, hay que actualizar esto manualmente.

```tsx
{/* FIX: usar variable CSS gestionada por el FAB, o safe-area + padding mínimo */}
<div
  className="page-transition-enter w-full px-3 pt-4 sm:px-4 lg:px-5 xl:px-6"
  style={{ paddingBottom: 'max(6rem, calc(var(--fab-safe-area, 0px) + 1.5rem))' }}
>
```

O bien simplificar con una clase custom en `globals.css`:

```css
/* En @layer utilities */
.content-safe-bottom {
  padding-bottom: clamp(5rem, 8vh, 7rem); /* ajusta automáticamente en pantallas pequeñas */
}
```

---

### M-4 · Tipografía — Ausencia de escala de line-height en headings del dashboard

**Dominio:** Tipografía  

`@layer base` define `line-height: 1.2` para todos los `h1-h6`, pero en el Topbar:

```tsx
{/* Topbar.tsx línea 33 */}
<h1 className="truncate text-[1.2rem] font-bold leading-tight ...">
```

`leading-tight` es `1.25` en Tailwind — casi idéntico a la base. El subtítulo es `text-[10.5px]` (violación M-2) con sin `leading-*` explícito, hereda `1.4` del body. La jerarquía visual título–subtítulo no tiene suficiente contraste de peso de escala: `1.2rem` → `10.5px` es un ratio de ≈1.82, lo cual es aceptable, pero el grosor del título (`font-bold` / 700) coincide con el peso del kicker (`font-bold uppercase tracking`). Resultado: todo el header siente el mismo peso.

```tsx
{/* FIX — Topbar.tsx HeaderCopy, solo clases */}
<p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[var(--c-text-faint)]">
  {/* kicker: bajar a semibold para diferenciarlo del título */}
</p>
<h1 className="truncate text-[1.15rem] font-extrabold leading-none tracking-[-0.025em] text-[var(--c-text)] md:text-[1.25rem]">
  {/* title: extrabold (800) crea contraste con el kicker semibold (600) */}
</h1>
```

---

### M-5 · Color — `::selection` usa `color: white` hardcodeado (no respeta dark/light)

**Dominio:** Color  

```css
/* globals.css línea 2566 */
::selection {
  background-color: rgba(16, 185, 129, 0.25);
  color: white; /* ← hardcoded, inválido en modo claro */
}
```

En modo claro, el texto seleccionado se vuelve blanco sobre un fondo verde pálido: muy bajo contraste.

```css
/* FIX */
::selection {
  background-color: color-mix(in srgb, var(--c-primary) 22%, transparent);
  color: var(--c-text);
}
```

---

### M-6 · Motion — `bounce-in` usa `cubic-bezier(0.34, 1.56, 0.64, 1)` — easing con rebote

**Dominio:** Motion  
**Regla impeccable violada:** "No bounce, no elastic."

```css
/* tailwind.config.ts línea 39 */
'bounce-in': 'bounce-in 0.3s cubic-bezier(0.34,1.56,0.64,1)',

/* globals.css línea 2613 */
@keyframes bounce-in {
  0%   { transform: scale(0.9); opacity: 0; }
  60%  { transform: scale(1.02); }
  100% { transform: scale(1); opacity: 1; }
}
```

El sobreshot a `scale(1.02)` en el keyframe **sumado** al easing spring produce un doble rebote perceptible. En una app financiera, esto es juguetón donde debería ser preciso.

```css
/* FIX — conservar la sensación de entrada pero sin rebote */
@keyframes bounce-in {
  0%   { transform: scale(0.93); opacity: 0; }
  100% { transform: scale(1);    opacity: 1; }
}
/* En tailwind.config.ts */
'bounce-in': 'bounce-in 0.22s cubic-bezier(0.22, 1, 0.36, 1)',
```

---

### M-7 · Color — `nav-active` en `@layer utilities` usa `text-emerald-400` de Tailwind en lugar del token `--c-primary`

**Dominio:** Color  

```css
/* globals.css línea 2674 */
.nav-active {
  @apply text-emerald-400 bg-emerald-500/10;
}
```

`emerald-400` (`#34d399`) ≠ `--c-primary` (`#0E4F46`). Si el tema cambia, esta clase queda desincronizada.

```css
/* FIX */
.nav-active {
  color: var(--c-primary);
  background: var(--c-primary-soft);
}
```

---

## 🔵 NITS

### N-1 · `border-left: 2px solid #10b981` en el mockup del sidebar de la landing

**Dominio:** Color  
Línea 3591 — misma franja lateral prohibida que M-1, pero en el mockup decorativo. Baja severidad porque es solo un elemento visual ilustrativo.

```css
/* globals.css línea 3591 */
.fin-landing-mockup-sidebar-item--active {
  background: rgba(16, 185, 129, 0.12);
  border-left: 2px solid #10b981; /* ← stripe */
}

/* FIX */
.fin-landing-mockup-sidebar-item--active {
  background: rgba(16, 185, 129, 0.14);
  border: 1px solid rgba(16, 185, 129, 0.28);
  border-radius: 0.4rem;
}
```

---

### N-2 · Definición duplicada de `:root[data-theme='light']` en globals.css

**Dominio:** Estructura CSS  

El selector `:root[data-theme='light']` aparece tres veces (líneas ~162, ~191, ~2479) con solapamiento de variables. Esto funciona porque la cascada resuelve el último valor, pero es frágil ante ediciones futuras.

```css
/* FIX — consolidar en un único bloque (mover a su sección correcta) */
/* Mantener sólo el bloque de líneas 191–213 que es el más completo
   y eliminar los de las líneas 162–184 */
```

---

### N-3 · `transition: all` en múltiples elementos de auth

**Dominio:** Motion  

```css
/* globals.css líneas 797, 947 */
.fin-auth-segment { transition: all var(--transition-base); }
.fin-auth-btn-primary,
.fin-auth-btn-secondary { transition: all var(--transition-base); }
```

`transition: all` anima cualquier propiedad que cambie, incluidas las que no deben animarse (ej.: `width`, `height`, `display`). Esto puede causar animaciones indeseadas y dificulta el debug.

```css
/* FIX */
.fin-auth-segment {
  transition:
    color var(--transition-base),
    background-color var(--transition-base),
    box-shadow var(--transition-base);
}

.fin-auth-btn-primary,
.fin-auth-btn-secondary {
  transition:
    opacity var(--transition-base),
    filter var(--transition-base),
    box-shadow var(--transition-base),
    background-color var(--transition-base);
}
```

---

### N-4 · `text-[10px]`, `text-[11px]`, `text-[12px]` sobreescritos via Tailwind escape en `@layer utilities`

**Dominio:** Tipografía  

```css
/* globals.css líneas 2792–2804 */
.text-\[10px\] { font-size: 0.72rem; line-height: 1rem; }
.text-\[11px\] { font-size: 0.79rem; line-height: 1.08rem; }
.text-\[12px\] { line-height: 1.16rem; }
```

Sobreescribir utilidades de Tailwind con clases de escape viola el contrato de Tailwind y hace que el código sea difícil de razonar. Un desarrollador que escribe `text-[10px]` espera obtener `10px`, no `0.72rem`.

**Fix:** en lugar de hackear las utilities, definir tokens semánticos:

```css
/* En @layer utilities — nombres semánticos, no pixel-literales */
.text-caption  { font-size: 0.72rem; line-height: 1rem; }    /* equiv. 10px corregido */
.text-meta     { font-size: 0.79rem; line-height: 1.1rem; }  /* equiv. 11px corregido */
.text-micro    { font-size: 0.84rem; line-height: 1.2rem; }  /* equiv. 12px+ */
```

Y en los componentes, reemplazar `text-[10px]` → `text-caption`, etc.

---

### N-5 · `!important` excesivo en los overrides de `data-theme='light'`

**Dominio:** Color / Estructura CSS  

Los bloques de compatibilidad light-mode (líneas 188–303) usan `!important` en **todas** las sobreescrituras de `.text-white`, `.bg-white/`, etc. Hay ≈ 18 reglas con `!important`.

Esto es un síntoma de que los componentes originales usaron `text-white` y `bg-white/X` de Tailwind en lugar de los tokens `--c-text` y `--c-surface`. Los `!important` son parches. La deuda real es en los componentes; el CSS solo la tapa.

**Fix a corto plazo:** ninguno en CSS puro (ya existe, funciona). La mejora es gradual: al tocar componentes, migrar `text-white` → `text-[var(--c-text)]` y eliminar la necesidad del parche.

---

## Resumen ejecutivo

| # | ID | Dominio | Severidad | Esfuerzo |
|---|---|---|---|---|
| 1 | B-1 | Tipografía | 🔴 Blocker | XS — 1 línea |
| 2 | B-2 | Color | 🔴 Blocker | S — aclarar naming |
| 3 | B-3 | Motion | 🔴 Blocker | XS — 2 keyframes |
| 4 | M-1 | Color / Layout | 🟡 Mejora | S — 4 reglas CSS |
| 5 | M-2 | Tipografía | 🟡 Mejora | M — ~8 valores en globals |
| 6 | M-3 | Espaciado | 🟡 Mejora | S — 1 clase en AppShell |
| 7 | M-4 | Tipografía | 🟡 Mejora | XS — 2 clases en Topbar |
| 8 | M-5 | Color | 🟡 Mejora | XS — 2 líneas en globals |
| 9 | M-6 | Motion | 🟡 Mejora | XS — keyframe + config |
| 10 | M-7 | Color | 🟡 Mejora | XS — 2 líneas en globals |
| 11 | N-1 | Color | 🔵 Nit | XS |
| 12 | N-2 | Estructura | 🔵 Nit | S — merge de bloques |
| 13 | N-3 | Motion | 🔵 Nit | XS — 3 reglas |
| 14 | N-4 | Tipografía | 🔵 Nit | M — renombrar clases |
| 15 | N-5 | Color | 🔵 Nit | L — deuda gradual |

**Orden de ataque recomendado:** B-3 → B-1 → M-6 → M-5 → M-1 → el resto.
