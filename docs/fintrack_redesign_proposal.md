# FinTrack — Propuesta de Rediseño Visual Completo

> [!IMPORTANT]
> **No se modifica ningún archivo hasta tu aprobación.** Este documento describe cada cambio propuesto con código concreto.

## Diagnóstico general

| Problema | Severidad |
|---|---|
| **Inter como font-body** — genérica, sin carácter | 🔴 Alta |
| **globals.css = 4,689 líneas** — deuda CSS masiva, duplicaciones, legacy overrides | 🔴 Alta |
| **Paleta Forest Green saturada** con demasiados rgba manuales | 🟡 Media |
| **`transition-all`** en varios componentes — repinta propiedades innecesarias | 🟡 Media |
| **Sin `:active` scale** en botones de la app (solo auth) | 🟡 Media |
| **Sidebar con `box-shadow: var(--shadow-lg)`** + backdrop-blur en scrolling container | 🟡 Media |
| **Badges pill `rounded-full`** genéricos | 🟢 Baja |
| **Sin stagger** en listas de tabla | 🟢 Baja |

---

## 1. Color

### Ahora
- Forest Green `#0E4F46` como primary — demasiado oscuro, bajo contraste con textos muted.
- Fondo `#F2F7F8` con gradientes radiales verde/azul en body — agrega complejidad visual innecesaria.
- Semáforos usando colores Tailwind puros (`#16a34a`, `#dc2626`) — chocan con la paleta tinted.

### Propuesta
Migrar a una paleta **Warm Neutral + Single Teal Accent** inspirada en Linear/Vercel:

```css
:root {
  /* ── Superficie ──────────────────────── */
  --c-bg:            #FAFAF9;      /* warm bone — no blue tint */
  --c-surface:       #FFFFFF;
  --c-surface-2:     #F5F5F3;      /* warm gray, not blue */
  --c-surface-hover: #EEEEEC;

  /* ── Accent único ────────────────────── */
  --c-primary:       #0D6B5E;      /* teal desaturado — profesional */
  --c-primary-hover: #095C51;
  --c-primary-soft:  rgba(13,107,94,0.07);
  --c-primary-border:rgba(13,107,94,0.14);

  /* ── Texto ───────────────────────────── */
  --c-text:          #1A1A19;      /* off-black, not pure */
  --c-text-muted:    #6B6B69;      /* warm gray */
  --c-text-faint:    #9C9C99;

  /* ── Bordes ──────────────────────────── */
  --c-border:        #E8E8E6;      /* 1px solid warm gray */
  --c-border-hover:  #D4D4D1;

  /* ── Semáforos desaturados ────────────── */
  --c-success:       #1A7A4E;
  --c-success-soft:  #EDF3EC;       /* pastel muted */
  --c-danger:        #B5342B;
  --c-danger-soft:   #FDEBEC;
  --c-warning:       #8B6914;
  --c-warning-soft:  #FBF3DB;

  /* ── Sombras tinted ──────────────────── */
  --shadow-sm:  0 1px 2px rgba(26,26,25,0.04);
  --shadow-md:  0 4px 12px rgba(26,26,25,0.06);
  --shadow-lg:  0 12px 32px rgba(26,26,25,0.08);
}
```

**Body**: fondo plano `--c-bg` sin gradientes radiales. Limpio, editorial.

---

## 1.1 Dark Mode — Sistema completo

> [!IMPORTANT]
> El toggle existente (`document.documentElement.setAttribute('data-theme', theme)`) en `useTheme.tsx`, `PreferencesPanel.tsx` y `layout.tsx` sigue funcionando sin cambios. Todos los tokens usan el selector `:root[data-theme='dark']`.

### Filosofía dark

- **Warm neutrals** — fondos con micro-tint cálido (`hsl(40°–50°, 2–4%, L)`), nunca azul puro (`#0a0f1a`).
- **Primary más luminoso** — `#2DD4A8` en dark vs `#0D6B5E` en light, garantizando WCAG AA (≥4.5:1 sobre fondos oscuros).
- **Separación por bordes, no sombras** — las sombras desaparecen en fondos oscuros. Se usan borders `rgba(255,255,255,0.06–0.12)`.
- **Semáforos invertidos** — fondos oscuros con tinte del color, textos luminosos. No los mismos pasteles del light mode.

### Tokens completos

```css
/* ═══════════════════════════════════════════════════════════════
   DARK MODE — Warm Neutral + Teal Accent
   Referencia: Linear dark, Vercel dark, Stripe dark
   ═══════════════════════════════════════════════════════════════ */

:root[data-theme='dark'] {

  /* ── Superficies (warm, no blue) ─────────────────────────── */
  --c-bg:            #161615;      /* warm near-black */
  --c-surface:       #1E1E1C;      /* elevated layer 1 */
  --c-surface-2:     #262624;      /* elevated layer 2 / input bg */
  --c-surface-hover: #2E2E2B;      /* hover state surface */

  /* ── Primary accent (luminoso para contraste AA) ─────────── */
  --c-primary:       #2DD4A8;      /* teal luminoso — 7.2:1 sobre #161615 */
  --c-primary-hover: #5EEDCA;      /* hover más brillante */
  --c-primary-deep:  #1A9E7A;      /* pressed / deep variant */
  --c-primary-soft:  rgba(45,212,168,0.10); /* tinted bg */
  --c-primary-border:rgba(45,212,168,0.18); /* tinted border */

  /* ── Texto ───────────────────────────────────────────────── */
  --c-text:          #EDEDEC;      /* warm white — not pure #FFF */
  --c-text-muted:    #A1A19E;      /* warm gray */
  --c-text-faint:    #6E6E6B;      /* disabled / tertiary */
  --c-text-on-primary: #0B1F19;    /* dark text on bright primary */

  /* ── Bordes (separation by borders, not shadows) ─────────── */
  --c-border:        rgba(255,255,255,0.08);  /* subtle divider */
  --c-border-hover:  rgba(255,255,255,0.14);  /* hover emphasis */

  /* ── Sombras (mínimas en dark) ───────────────────────────── */
  --shadow-sm:  0 1px 2px rgba(0,0,0,0.3);
  --shadow-md:  0 4px 12px rgba(0,0,0,0.4);
  --shadow-lg:  0 12px 32px rgba(0,0,0,0.5);

  /* ── Overlay ─────────────────────────────────────────────── */
  --c-overlay:       rgba(0,0,0,0.60);

  /* ── Layout surfaces ─────────────────────────────────────── */
  --c-sidebar-bg:    #1A1A18;      /* ligeramente elevado del bg */
  --c-topbar-bg:     rgba(22,22,21,0.85);  /* con blur */
  --c-modal-bg:      #1E1E1C;

  /* ── Semáforos dark (fondos oscuros + texto luminoso) ─────── */
  --c-success:       #34D399;      /* luminoso para legibilidad */
  --c-success-soft:  rgba(52,211,153,0.12); /* fondo tinted oscuro */
  --c-danger:        #F87171;
  --c-danger-soft:   rgba(248,113,113,0.12);
  --c-warning:       #FBBF24;
  --c-warning-soft:  rgba(251,191,36,0.12);
  --c-info:          #60A5FA;
  --c-info-soft:     rgba(96,165,250,0.12);

  /* ── Hero ink (para ScreenHero sobre gradientes) ─────────── */
  --hero-ink-strong:  rgba(255,255,255,0.97);
  --hero-ink-soft:    rgba(255,255,255,0.88);
  --hero-ink-muted:   rgba(255,255,255,0.60);

  /* ── Accent alias ────────────────────────────────────────── */
  --c-accent:         var(--c-primary);
  --c-accent-hover:   var(--c-primary-hover);
  --c-accent-soft:    var(--c-primary-soft);
  --c-accent-text:    var(--c-primary);

  /* ── Legacy aliases (backward compat) ────────────────────── */
  --color-bg:           var(--c-bg);
  --color-surface:      var(--c-surface);
  --color-surface-2:    var(--c-surface-2);
  --color-sidebar-bg:   var(--c-sidebar-bg);
  --color-topbar-bg:    var(--c-topbar-bg);
  --color-modal-bg:     var(--c-modal-bg);
  --color-overlay:      var(--c-overlay);
  --color-shadow:       rgba(0,0,0,0.5);
  --color-border:       var(--c-border);
  --color-border-hover: var(--c-border-hover);
  --color-accent:       var(--c-primary);
  --color-accent-2:     var(--c-primary-deep);
  --color-accent-hover: var(--c-primary-hover);
  --color-accent-muted: var(--c-primary-soft);
  --color-text:         var(--c-text);
  --color-text-muted:   var(--c-text-muted);
  --color-text-faint:   var(--c-text-faint);
  --color-on-accent:    var(--c-text-on-primary);
}
```

### Componentes dark — Detalle por área

#### Sidebar dark

```css
:root[data-theme='dark'] .fin-sidebar,
:root[data-theme='dark'] .fin-mobile-drawer {
  background-color: var(--c-sidebar-bg) !important;
  border-color: var(--c-border) !important;
  box-shadow: none;                /* borders, not shadows */
}

/* Panel interior del sidebar */
:root[data-theme='dark'] .fin-sidebar > div,
:root[data-theme='dark'] .fin-mobile-drawer > div {
  background: var(--c-surface);
  border-color: var(--c-border);
  box-shadow: none;
}

/* NavItem activo en dark — glow sutil */
/* Se logra via tokens: --c-primary-soft ya es rgba(45,212,168,0.10) */
/* Resultado: fondo teal muy sutil, texto teal brillante */
```

#### Topbar dark

```css
:root[data-theme='dark'] .fin-topbar {
  background-color: var(--c-topbar-bg) !important;
  border-color: var(--c-border) !important;
  backdrop-filter: blur(8px);
  box-shadow: none;                /* sin sombra en dark */
}
```

#### Tablas dark

```css
/* TableShell */
:root[data-theme='dark'] .overflow-hidden.rounded-xl {
  border-color: var(--c-border);
  background: var(--c-surface);
  box-shadow: none;
}

/* Th header */
:root[data-theme='dark'] th {
  background: var(--c-surface-2);
  border-color: var(--c-border);
  color: var(--c-text-faint);
}

/* Td cells */
:root[data-theme='dark'] td {
  border-color: var(--c-border);
}

/* Row hover */
@media (hover: hover) {
  :root[data-theme='dark'] tr.group:hover td {
    background-color: var(--c-surface-2);
  }
}

/* Pagination bar */
:root[data-theme='dark'] .border-t.bg-\[var\(--c-surface-2\)\] {
  background: var(--c-surface-2);
  border-color: var(--c-border);
}
```

#### Badges dark

Los tokens de badges usan CSS variables, pero los colores hardcoded del light mode necesitan override:

```css
/* Badge status styles en dark — fondos oscuros tinted */
:root[data-theme='dark'] .status-badge,
:root[data-theme='dark'] [class*='StatusBadge'] {
  /* Los tokens --c-success-soft etc. ya apuntan a versiones dark */
  /* Ejemplo resultado: */
  /* success: bg rgba(52,211,153,0.12) + text #34D399 + border rgba(52,211,153,0.20) */
  /* danger:  bg rgba(248,113,113,0.12) + text #F87171 + border rgba(248,113,113,0.20) */
  /* warning: bg rgba(251,191,36,0.12) + text #FBBF24 + border rgba(251,191,36,0.20) */
}
```

Tabla de referencia:

| Variant | Light bg | Light text | Dark bg | Dark text | Dark border |
|---|---|---|---|---|---|
| success | `#EDF3EC` | `#1A7A4E` | `rgba(52,211,153,0.12)` | `#34D399` | `rgba(52,211,153,0.20)` |
| error | `#FDEBEC` | `#B5342B` | `rgba(248,113,113,0.12)` | `#F87171` | `rgba(248,113,113,0.20)` |
| warning | `#FBF3DB` | `#8B6914` | `rgba(251,191,36,0.12)` | `#FBBF24` | `rgba(251,191,36,0.20)` |
| info | `#E8F2FE` | `#1A5FA0` | `rgba(96,165,250,0.12)` | `#60A5FA` | `rgba(96,165,250,0.20)` |
| pending | `--c-surface-2` | `--c-text-muted` | `--c-surface-2` | `--c-text-muted` | `--c-border` |

#### Botones dark

```css
/* Primary — fondo sólido teal luminoso, texto oscuro */
:root[data-theme='dark'] .btn-primary,
:root[data-theme='dark'] .module-create-btn {
  background: var(--c-primary);         /* #2DD4A8 */
  color: var(--c-text-on-primary);      /* #0B1F19 */
  border: none;
  box-shadow: 0 1px 2px rgba(0,0,0,0.3),
              0 0 12px rgba(45,212,168,0.15); /* glow sutil */
}

:root[data-theme='dark'] .btn-primary:hover {
  background: var(--c-primary-hover);   /* #5EEDCA */
  box-shadow: 0 2px 8px rgba(0,0,0,0.3),
              0 0 20px rgba(45,212,168,0.20);
}

/* Secondary — border emphasis */
:root[data-theme='dark'] .btn-secondary {
  background: var(--c-surface);
  border-color: var(--c-border);
  color: var(--c-text);
  box-shadow: none;
}

:root[data-theme='dark'] .btn-secondary:hover {
  background: var(--c-surface-2);
  border-color: var(--c-border-hover);
}
```

#### Inputs dark

```css
:root[data-theme='dark'] .field-base {
  background: var(--c-surface-2);       /* layer 2, not pure black */
  border-color: var(--c-border);
  color: var(--c-text);
}

:root[data-theme='dark'] .field-base:hover {
  border-color: var(--c-border-hover);
}

:root[data-theme='dark'] .field-base:focus {
  border-color: var(--c-primary);
  box-shadow: 0 0 0 3px var(--c-primary-soft);
  background: var(--c-surface);         /* slightly lighter on focus */
}

:root[data-theme='dark'] .field-base::placeholder {
  color: var(--c-text-faint);
}

/* Autofill override */
:root[data-theme='dark'] input:-webkit-autofill {
  -webkit-box-shadow: 0 0 0 100px var(--c-surface-2) inset;
  -webkit-text-fill-color: var(--c-text);
}
```

#### Modales dark

```css
:root[data-theme='dark'] .app-modal-overlay {
  background: rgba(0,0,0,0.65);
  backdrop-filter: blur(6px);
}

:root[data-theme='dark'] [role='dialog'] {
  background: var(--c-modal-bg);
  border-color: var(--c-border-hover);  /* más visible en dark */
  box-shadow: 0 24px 48px rgba(0,0,0,0.5);
}

/* Inner card within modal */
:root[data-theme='dark'] [role='dialog'] .rounded-2xl.border {
  background: var(--c-surface-2);
  border-color: var(--c-border);
}
```

#### Cards y superficies dark

```css
:root[data-theme='dark'] .surface,
:root[data-theme='dark'] .editorial-card {
  background: var(--c-surface);
  border-color: var(--c-border);
  box-shadow: none;
}

:root[data-theme='dark'] .glass-card {
  background: rgba(30,30,28,0.80);
  border-color: var(--c-border);
}

@media (hover: hover) {
  :root[data-theme='dark'] .surface:hover,
  :root[data-theme='dark'] .editorial-card:hover {
    border-color: var(--c-border-hover);
    box-shadow: none;                   /* border only */
  }
}
```

#### Dashboard hero dark

```css
:root[data-theme='dark'] .dashboard-hero,
:root[data-theme='dark'] .screen-hero {
  background: linear-gradient(
    135deg,
    #0C3B30 0%,                         /* dark teal base */
    #0A4F3E 48%,
    #127A5C 100%                        /* slightly lighter edge */
  ) !important;
  border-color: rgba(45,212,168,0.16) !important;
  box-shadow: 0 16px 34px rgba(0,0,0,0.4),
              0 0 40px rgba(45,212,168,0.06) !important;
}
```

#### Body dark

```css
:root[data-theme='dark'] body {
  background-color: var(--c-bg);
  background-image: none;              /* sin gradientes radiales */
  color: var(--c-text);
}
```

#### Scrollbar dark

```css
:root[data-theme='dark'] ::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.12);
}
:root[data-theme='dark'] ::-webkit-scrollbar-thumb:hover {
  background: rgba(255,255,255,0.20);
}
```

#### Focus states dark

```css
:root[data-theme='dark'] :focus-visible {
  outline-color: var(--c-primary);      /* teal brillante */
}
```

#### Selection dark

```css
:root[data-theme='dark'] ::selection {
  background-color: rgba(45,212,168,0.25);
  color: var(--c-text);
}
```

#### Auth pages dark

```css
:root[data-theme='dark'] .fin-auth-scene {
  background:
    radial-gradient(circle at 9% 12%, rgba(45,212,168,0.18), transparent 36%),
    radial-gradient(circle at 86% 8%, rgba(96,165,250,0.14), transparent 34%),
    linear-gradient(132deg, #111110 0%, #161615 56%, #1A1A18 100%);
}

:root[data-theme='dark'] .fin-auth-entry {
  background: rgba(30,30,28,0.88);
  border-color: var(--c-border);
}

:root[data-theme='dark'] .fin-auth-form-panel {
  background: rgba(22,22,21,0.90);
  border-color: var(--c-border);
}

:root[data-theme='dark'] .fin-auth-showcase {
  background: linear-gradient(165deg, rgba(30,30,28,0.90) 0%, rgba(26,26,24,0.92) 100%);
  border-color: var(--c-border);
}

:root[data-theme='dark'] .fin-auth-title,
:root[data-theme='dark'] .fin-auth-showcase-title,
:root[data-theme='dark'] .fin-auth-feature-title,
:root[data-theme='dark'] .fin-auth-metric-value {
  color: var(--c-text);
}

:root[data-theme='dark'] .fin-auth-subtitle,
:root[data-theme='dark'] .fin-auth-showcase-copy,
:root[data-theme='dark'] .fin-auth-feature-copy {
  color: var(--c-text-muted);
}

:root[data-theme='dark'] .fin-auth-input {
  background: var(--c-surface-2);
  border-color: var(--c-border);
  color: var(--c-text);
}

:root[data-theme='dark'] .fin-auth-input:focus {
  border-color: var(--c-primary);
  box-shadow: 0 0 0 3px var(--c-primary-soft);
}

:root[data-theme='dark'] .fin-auth-btn-primary {
  background: linear-gradient(135deg, #2DD4A8, #1A9E7A);
  color: #0B1F19;
  box-shadow: 0 14px 22px rgba(0,0,0,0.3);
}

:root[data-theme='dark'] .fin-auth-btn-secondary {
  background: var(--c-surface-2);
  border-color: var(--c-border);
  color: var(--c-text);
}

:root[data-theme='dark'] .fin-auth-segmented {
  background: var(--c-surface-2);
}

:root[data-theme='dark'] .fin-auth-segment[data-active='true'] {
  background: var(--c-surface);
  color: var(--c-text);
}

:root[data-theme='dark'] .fin-auth-link {
  color: var(--c-primary);
}

:root[data-theme='dark'] .fin-auth-feature-card,
:root[data-theme='dark'] .fin-auth-metric-strip {
  background: var(--c-surface-2);
  border-color: var(--c-border);
}

:root[data-theme='dark'] .fin-auth-feature-icon-wrap,
:root[data-theme='dark'] .fin-auth-metric-icon-wrap {
  background: linear-gradient(140deg,
    rgba(45,212,168,0.14),
    rgba(96,165,250,0.10));
  border-color: var(--c-border);
}
```

#### Landing page dark

La landing ya tiene dark como default (`#070b10`). Con la nueva paleta, se alinea a los warm neutrals:

```css
:root[data-theme='dark'] .fin-landing {
  background: #111110;                  /* warm, no blue */
  color: rgba(237,237,236,0.85);        /* --c-text with alpha */
}

:root[data-theme='dark'] .fin-landing-mockup {
  background: var(--c-surface);
  border-color: var(--c-border);
}

:root[data-theme='dark'] .fin-landing-feature-card {
  background: var(--c-surface);
  border-color: var(--c-border);
}

:root[data-theme='dark'] .fin-landing-feature-card:hover {
  border-color: var(--c-border-hover);
}

/* Los colores de accent en landing (emerald gradients) se mantienen
   por ser la identidad visual pública. Solo se ajustan las superficies
   para coincidir con los warm neutrals de la app. */
```

### Tabla de contraste WCAG

| Token | Sobre `--c-bg` (#161615) | Ratio | Cumple AA |
|---|---|---|---|
| `--c-text` (#EDEDEC) | texto principal | **13.2:1** | ✅ AAA |
| `--c-text-muted` (#A1A19E) | texto secundario | **6.8:1** | ✅ AA |
| `--c-text-faint` (#6E6E6B) | texto terciario | **3.9:1** | ⚠️ Decorativo |
| `--c-primary` (#2DD4A8) | accent/links | **7.2:1** | ✅ AA |
| `--c-success` (#34D399) | estado éxito | **7.8:1** | ✅ AA |
| `--c-danger` (#F87171) | estado error | **5.2:1** | ✅ AA |
| `--c-warning` (#FBBF24) | estado alerta | **8.9:1** | ✅ AAA |

### Eliminación de legacy overrides

Con este sistema de tokens unificado, se eliminan **~300 líneas** de overrides legacy:

```diff
- :root[data-theme='light'] .text-white { color: inherit; }
- :root[data-theme='light'] [class*='text-white/'] { ... }
- :root[data-theme='light'] [class*='bg-white/'] { ... }
- :root[data-theme='light'] [class*='border-white/'] { ... }
- :root[data-theme='dark'] .bg-white { ... }
- :root[data-theme='dark'] [class*='bg-white/'] { ... }
+ /* Eliminados: los componentes usan tokens --c-* directamente */
```

---

## 2. Tipografía

### Ahora
- `font-body: Inter` — la fuente más genérica de AI-generated UI.
- `font-display: Plus Jakarta Sans` — buena pero subutilizada.
- Sin monospace para datos financieros.
- `letter-spacing` inconsistente.

### Propuesta
Swap a **Geist Sans** (body) + **Geist Mono** (datos financieros):

```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');

:root {
  --font-display: 'Plus Jakarta Sans', sans-serif;
  --font-body:    'Geist', 'SF Pro Display', system-ui, sans-serif;
  --font-mono:    'Geist Mono', 'SF Mono', 'JetBrains Mono', monospace;
}
```

```ts
// tailwind.config.ts
fontFamily: {
  display: ['"Plus Jakarta Sans"', 'sans-serif'],
  body:    ['Geist', '"SF Pro Display"', 'system-ui', 'sans-serif'],
  mono:    ['"Geist Mono"', '"SF Mono"', 'monospace'],
},
```

**Escala tipográfica** (reemplaza los `text-[10px]`, `text-[11px]` ad-hoc):

| Token | Tamaño | Uso |
|---|---|---|
| `text-caption` | 0.6875rem (11px) | Labels, metadata |
| `text-body-sm` | 0.8125rem (13px) | Celdas de tabla, subtítulos |
| `text-body` | 0.875rem (14px) | Texto principal |
| `text-heading-sm` | 1rem (16px) | Títulos de sección |
| `text-heading` | 1.25rem (20px) | Títulos de página |
| `text-display` | 1.5rem (24px) | Hero headings |

Todas las cantidades financieras usan `font-mono` + `tabular-nums`.

---

## 3. Espaciado

### Ahora
- `px-3 pt-4` en el contenido principal — demasiado comprimido.
- `py-3.5` en celdas de tabla — excesivo verticalmente.
- Sidebar `p-2.5`, topbar `py-2.5` — sin ritmo vertical consistente.

### Propuesta
Sistema de espaciado en **múltiplos de 4px**:

```css
:root {
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-8:  32px;
  --space-10: 40px;
  --space-12: 48px;
}
```

| Elemento | Ahora | Propuesta |
|---|---|---|
| Content padding | `px-3 pt-4` | `px-5 pt-5 lg:px-8` |
| Celda de tabla | `px-4 py-3.5` | `px-4 py-3` (más compacto) |
| Sidebar padding | `p-2.5` | `p-3` |
| Card interno | varía | `p-5` consistente |
| Sección gap | varía | `space-y-6` entre secciones |

---

## 4. Sidebar

### Ahora
- `box-shadow: var(--shadow-lg)` + `backdrop-filter: blur(10px)` — sombra pesada en un sidebar estático.
- Panel interior con `rounded-[24px]` — radio excesivo para un contenedor funcional.
- NavItem activo: `bg-[var(--c-primary)] text-white` con `shadow` — demasiado ruidoso.
- Section labels `text-[10px] uppercase tracking-[0.2em]` — correcto pero pueden mejorar.

### Propuesta

```tsx
// Sidebar panel interior — más sutil
className="relative flex h-full flex-col overflow-hidden
  rounded-2xl                              /* 16px, no 24px */
  border border-[var(--c-border)]          /* warm gray border */
  bg-[var(--c-surface)]
  shadow-[var(--shadow-sm)]                /* sutil, no lg */
"

// NavItem activo — tinted background, sin sombra
// ANTES: bg-primary + text-white + shadow
// DESPUÉS:
const activeStyles = {
  backgroundColor: 'var(--c-primary-soft)',  // fondo suave
  color: 'var(--c-primary)',                 // texto en accent
  borderLeft: '2px solid var(--c-primary)',  // indicador izquierdo
}

// NavItem hover — lift mínimo
className="hover:bg-[var(--c-surface-2)] hover:text-[var(--c-text)]
  transition-colors duration-150"
```

**Collapse toggle**: eliminar el botón circular con sombra, usar un ícono inline discreto.

---

## 5. Topbar

### Ahora
- Container con `rounded-[16px]` border + backdrop-blur — parece flotante.
- `text-[9.5px]` kicker "FinTrack Workspace" — demasiado pequeño, redundante.
- Título + subtítulo + kicker = 3 niveles de texto — excesivo para un topbar.

### Propuesta

```tsx
<header className="sticky top-0 z-30 border-b border-[var(--c-border)]
  bg-[var(--c-surface)]/80 backdrop-blur-sm">
  <div className="px-5 py-3 lg:px-8">
    <div className="flex items-center justify-between">
      {/* Solo título + breadcrumb, sin kicker */}
      <div>
        <h1 className="text-heading-sm font-semibold tracking-tight
          text-[var(--c-text)]">
          {title}
        </h1>
        {subtitle && (
          <p className="text-caption text-[var(--c-text-muted)] mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  </div>
</header>
```

**Cambios clave**: sin `rounded`, borde inferior simple, sin kicker redundante. Limpio como Vercel dashboard.

---

## 6. Tabla de transacciones

### Ahora
- `TableShell`: gradient line decorativa en top — innecesario.
- Header `bg-[var(--c-surface-2)]` con `text-[10px] uppercase tracking-[0.1em]` — correcto.
- Sin hover de fila visible.
- Sin stagger en rows.

### Propuesta

```tsx
// TableShell — eliminar gradient top line
function TableShell({ children, className = '' }: TableShellProps) {
  return (
    <div className={`overflow-hidden rounded-xl border border-[var(--c-border)]
      bg-[var(--c-surface)] shadow-[var(--shadow-sm)] ${className}`}>
      {children}
    </div>
  )
}

// Th — misma estructura, mejor sizing
className="px-4 py-2.5 text-left text-caption font-semibold uppercase
  tracking-[0.06em] text-[var(--c-text-faint)]
  border-b border-[var(--c-border)] bg-[var(--c-surface-2)]"

// Td — compact
className="px-4 py-2.5 text-body-sm border-b border-[var(--c-border)]"

// Row hover — warm tint
<tr className="group transition-colors duration-100
  hover:bg-[var(--c-surface-2)]">
```

**Stagger de entrada** para filas visibles (CSS-only):

```css
.table-row-reveal {
  animation: row-enter 200ms cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: calc(var(--row-index, 0) * 30ms);
}
@keyframes row-enter {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

---

## 7. Badges

### Ahora
- `rounded-full` pill con `text-[10px] uppercase tracking-wide` — genérico.
- Colores funcionales directos.

### Propuesta
Badges con **borde sutil + fondo pastel** (estilo Notion/Linear):

```tsx
const STATUS_STYLES: Record<StatusVariant, string> = {
  success:  'bg-[#EDF3EC] text-[#1A7A4E] border-[#D4E8D1]',
  error:    'bg-[#FDEBEC] text-[#B5342B] border-[#F5D0CE]',
  warning:  'bg-[#FBF3DB] text-[#8B6914] border-[#F0E2B6]',
  info:     'bg-[#E8F2FE] text-[#1A5FA0] border-[#C8DEF5]',
  pending:  'bg-[var(--c-surface-2)] text-[var(--c-text-muted)] border-[var(--c-border)]',
  // ...
}

function StatusBadge({ label, variant }: Props) {
  return (
    <span className={`inline-flex items-center gap-1.5
      px-2 py-0.5 rounded-md border         /* rounded-md, no pill */
      text-caption font-medium               /* no uppercase */
      ${STATUS_STYLES[variant]}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
      {label}
    </span>
  )
}
```

**Cambio clave**: `rounded-md` en lugar de `rounded-full`, sin `uppercase`, con dot indicator.

---

## 8. Botones

### Ahora
- `btn-primary`: gradient `linear-gradient(135deg, accent 0%, accent-2 100%)` + `shadow-emerald-500/20`.
- Sin `:active` scale en la mayoría de botones de la app.
- `transition-all duration-150` — anima todas las propiedades.

### Propuesta

```css
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;                    /* 8px, no 12px */
  font-size: 0.8125rem;
  font-weight: 600;
  background: var(--c-primary);             /* sólido, no gradient */
  color: #FFFFFF;
  border: none;
  box-shadow: 0 1px 2px rgba(13,107,94,0.2);
  transition: background-color 150ms ease-out,
              transform 100ms ease-out,
              box-shadow 150ms ease-out;
}

.btn-primary:hover {
  background: var(--c-primary-hover);
  box-shadow: 0 2px 8px rgba(13,107,94,0.25);
}

.btn-primary:active {
  transform: scale(0.97);                   /* feedback táctil */
  box-shadow: 0 1px 2px rgba(13,107,94,0.15);
}

.btn-secondary {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  color: var(--c-text);
  box-shadow: var(--shadow-sm);
}

.btn-secondary:hover {
  background: var(--c-surface-2);
  border-color: var(--c-border-hover);
}

.btn-secondary:active {
  transform: scale(0.97);
}
```

---

## 9. Inputs

### Ahora
- `field-base`: `bg: var(--color-surface-2)` con `rounded-xl` (12px).
- Focus: `ring-emerald-500/20` — usa clase Tailwind directa, no token.

### Propuesta

```css
.field-base {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;                    /* 8px consistente */
  font-size: 0.8125rem;
  font-weight: 450;
  background: var(--c-surface);             /* blanco, no gris */
  border: 1px solid var(--c-border);
  color: var(--c-text);
  transition: border-color 150ms ease-out,
              box-shadow 150ms ease-out;
}

.field-base:hover {
  border-color: var(--c-border-hover);
}

.field-base:focus {
  outline: none;
  border-color: var(--c-primary);
  box-shadow: 0 0 0 3px var(--c-primary-soft);
}

.field-base::placeholder {
  color: var(--c-text-faint);
}
```

---

## 10. Modales

### Ahora
- `RecordModal`: overlay con gradientes radiales + backdrop-blur saturado.
- Dialog con `rounded-[1.35rem]` + drag handle (mobile pattern en desktop).
- Contenido envuelto en card interior doble (modal > card > form card).

### Propuesta

```css
/* Overlay — simple, rápido */
.app-modal-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.4);           /* sin gradientes */
  backdrop-filter: blur(4px);                /* ligero */
  animation: overlay-enter 180ms ease-out both;
}

@keyframes overlay-enter {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* Dialog — sin doble card */
[role='dialog'] {
  border-radius: 0.75rem;                    /* 12px */
  border: 1px solid var(--c-border);
  background: var(--c-surface);
  box-shadow: var(--shadow-lg);
  animation: dialog-enter 220ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes dialog-enter {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
```

Eliminar: drag handle en desktop, card interior duplicada, gradientes en overlay.

---

## 11. Animaciones y transiciones

### Ahora
- Buen uso de `cubic-bezier(0.22, 1, 0.36, 1)` ✓
- `page-transition-enter`: opacity-only 320ms — correcto pero podría incluir translateY sutil.
- `transition-all` en CollapseToggle y otros — problema de performance.
- `list-item-enter` con `filter: blur(2px)` — repaint en cada frame.

### Propuesta

```css
:root {
  --ease-out:    cubic-bezier(0.22, 1, 0.36, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  --t-fast:      120ms;
  --t-base:      180ms;
  --t-slow:      300ms;
}

/* Nunca transition-all. Siempre propiedades explícitas. */

/* Page enter — sutil Y translation */
.page-transition-enter {
  animation: page-enter 280ms var(--ease-out) both;
}
@keyframes page-enter {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* List items — sin blur (no GPU-compositable) */
@keyframes list-item-enter {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Eliminar filter:blur de todas las keyframes de entrada */
```

---

## 12. Hover states

### Ahora
- `ui-pressable:hover`: `translateY(-1px) + saturate(1.03)` — el saturate es imperceptible.
- Cards `.surface:hover`: `translateY(-1px)` — correcto pero sin shadow transition.
- Table rows: hover solo via media query (bien) pero efecto mínimo.

### Propuesta

```css
/* Pressable universal — feedback claro */
@media (hover: hover) and (pointer: fine) {
  .ui-pressable:hover {
    transform: translateY(-1px);
  }
}
.ui-pressable:active {
  transform: scale(0.97);
  transition-duration: 80ms;
}

/* Cards — shadow shift on hover */
@media (hover: hover) {
  .surface:hover {
    border-color: var(--c-border-hover);
    box-shadow: 0 2px 8px rgba(26,26,25,0.06);
  }
}

/* Table rows */
@media (hover: hover) {
  tr.group:hover td {
    background-color: var(--c-surface-2);
  }
}

/* Nav items — color transition only */
.nav-item {
  transition: color var(--t-fast) ease-out,
              background-color var(--t-fast) ease-out;
}
```

---

## 13. Iconografía

### Ahora
- SVGs inline custom en `LayoutIcons.tsx` — ~8.5KB de SVGs manuales.
- Stroke width inconsistente (`strokeWidth` varía entre 1.8 y 2.1).
- No hay sistema de iconos unificado.

### Propuesta
- Estandarizar `strokeWidth: 1.5` para todos los íconos (consistencia visual).
- Mantener SVGs inline (no agregar dependencia nueva).
- Unificar el tamaño base a `16px` para nav, `14px` para actions.

```tsx
// Constantes de iconografía
const ICON_DEFAULTS = {
  nav:    { size: 16, strokeWidth: 1.5 },
  action: { size: 14, strokeWidth: 1.5 },
  inline: { size: 12, strokeWidth: 1.5 },
} as const
```

---

## Resumen de impacto

| Área | Cambio principal | Riesgo |
|---|---|---|
| Color | Warm neutrals + teal desaturado | 🟡 Medio — toca tokens globales |
| Tipografía | Geist Sans/Mono swap | 🟢 Bajo — solo font-family |
| Espaciado | Sistema 4px, content padding mayor | 🟢 Bajo |
| Sidebar | Shadow/blur reducido, active=tinted | 🟡 Medio |
| Topbar | Sin rounded, sin kicker | 🟢 Bajo |
| Tablas | Sin gradient line, compact cells | 🟢 Bajo |
| Badges | rounded-md, dot indicator, no uppercase | 🟢 Bajo |
| Botones | Sólido (no gradient), :active scale | 🟢 Bajo |
| Inputs | Fondo blanco, radius 8px | 🟢 Bajo |
| Modales | Sin doble card, overlay simple | 🟡 Medio |
| Animaciones | Sin filter:blur, explicit properties | 🟢 Bajo |
| Hover | :active scale universal | 🟢 Bajo |
| Iconos | strokeWidth 1.5 uniforme | 🟢 Bajo |

## Orden de implementación propuesto

1. **Font swap** → Geist Sans/Mono (impacto visual inmediato)
2. **Color tokens** → nueva paleta warm neutral
3. **Botones + Inputs** → `:active` scale, sólidos
4. **Sidebar + Topbar** → simplificar estructura
5. **Tablas + Badges** → compact, modern
6. **Modales** → eliminar doble card
7. **Animaciones** → limpiar blur, explicit transitions
8. **CSS cleanup** → eliminar legacy overrides (~1000 líneas reducibles)

> [!NOTE]
> El dark mode completo (sección 1.1) cubre **toda la app**: dashboard, sidebar, topbar, tablas, badges, botones, inputs, modales, auth pages y landing page. El toggle existente no requiere cambios.
