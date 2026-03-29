// =============================================================================
// lib/tokens.ts
// Tokens de diseño de la aplicación.
// Fuente de verdad para valores que deben ser consistentes en toda la UI.
// Uso en Tailwind: referir a estas constantes al construir clases dinámicas.
// NO usar valores "mágicos" en los componentes — extraerlos aquí.
// =============================================================================

// ─── COLORES SEMÁNTICOS ───────────────────────────────────────────────────────

export const Colors = {
  // Superficies
  bg:         '#070b10',
  surface:    '#0d1219',
  surface2:   '#111820',
  // Bordes
  border:     'rgba(255,255,255,0.06)',
  borderHover:'rgba(255,255,255,0.12)',
  // Texto
  text:       'rgba(255,255,255,0.85)',
  textMuted:  'rgba(255,255,255,0.40)',
  textFaint:  'rgba(255,255,255,0.20)',
  // Acento principal
  accent:     '#10b981',
  accentHover:'#34d399',
  // Módulos
  income:     '#10b981',
  expense:    '#ef4444',
  transfer:   '#3b82f6',
  asset:      '#8b5cf6',
  credit:     '#f59e0b',
  receivable: '#06b6d4',
  payable:    '#f97316',
  // Estados
  success:    '#10b981',
  error:      '#ef4444',
  warning:    '#f59e0b',
  info:       '#3b82f6',
} as const

// ─── TIPO DE TRANSACCIÓN → COLOR ──────────────────────────────────────────────

export type TxType = 'INCOME' | 'EXPENSE' | 'TRANSFER'

export const TxColors: Record<TxType, string> = {
  INCOME:   Colors.income,
  EXPENSE:  Colors.expense,
  TRANSFER: Colors.transfer,
}

// ─── TIPOGRAFÍA ───────────────────────────────────────────────────────────────

export const Typography = {
  // Etiquetas de sección / tabla headers
  sectionLabel: 'text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-text-muted)]',
  // Campos de formulario label
  fieldLabel:   'text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--color-text-muted)]',
  // Monto principal en widgets y detalles
  amount:       'text-2xl font-bold tabular-nums',
  // Monto secundario / conversión
  amountSub:    'text-[11px] tabular-nums text-[var(--color-text-muted)]',
  // Badges / pills
  badge:        'text-[10px] font-bold uppercase tracking-wide',
  // Metadatos / timestamps
  meta:         'text-[11px] text-[var(--color-text-muted)]',
} as const

// ─── BORDER RADIUS ───────────────────────────────────────────────────────────

export const Radius = {
  sm:   'rounded-lg',        // 8px  — inputs, botones pequeños
  md:   'rounded-xl',        // 12px — botones, badges
  lg:   'rounded-2xl',       // 16px — cards, widgets
  full: 'rounded-full',      // pills
} as const

// ─── CLASES DE COMPONENTES BASE ───────────────────────────────────────────────
// Cadenas de Tailwind reutilizables para patrones frecuentes.
// Usarlas en clsx/cn() para composición.

export const ComponentStyles = {
  // Superficies
  card:     'rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface)]',
  surface:  'bg-[var(--color-surface-2)] border border-[color:var(--color-border)]',

  // Input base
  input: `
    w-full px-3.5 py-2.5 rounded-lg text-sm font-medium
    bg-[var(--color-surface-2)] border border-[color:var(--color-border)] text-[var(--color-text)]
    placeholder:text-[var(--color-text-faint)] hover:border-[color:var(--color-border-hover)]
    focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/40
    transition-all duration-150
    disabled:opacity-40 disabled:cursor-not-allowed
  `.trim(),

  // Input con error
  inputError: `
    border-red-500/40 focus:border-red-500/60 focus:ring-red-500/15
  `.trim(),

  // Botones
  btnPrimary: `
    inline-flex items-center justify-center gap-2
    px-4 py-2.5 rounded-xl text-sm font-bold tracking-wide
    bg-emerald-500 hover:bg-emerald-400 text-[var(--color-on-accent)]
    shadow-lg shadow-emerald-500/20
    transition-all duration-150
    disabled:opacity-50 disabled:cursor-not-allowed
    focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400
  `.trim(),

  btnSecondary: `
    inline-flex items-center justify-center gap-2
    px-4 py-2.5 rounded-xl text-sm font-semibold
    bg-[var(--color-surface-2)] hover:bg-[var(--color-surface)]
    border border-[color:var(--color-border)] hover:border-[color:var(--color-border-hover)]
    text-[var(--color-text-muted)] hover:text-[var(--color-text)]
    transition-all duration-150
    disabled:opacity-40 disabled:cursor-not-allowed
    focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-border-hover)]
  `.trim(),

  btnDanger: `
    inline-flex items-center justify-center gap-2
    px-4 py-2.5 rounded-xl text-sm font-semibold
    bg-red-500/10 hover:bg-red-500/15
    border border-red-500/20 hover:border-red-500/30
    text-red-400 hover:text-red-300
    transition-all duration-150
    disabled:opacity-40 disabled:cursor-not-allowed
    focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500/50
  `.trim(),

  btnGhost: `
    inline-flex items-center justify-center gap-2
    px-3 py-2 rounded-lg text-sm
    text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]
    transition-all duration-150
    focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-border-hover)]
  `.trim(),
} as const

// ─── ESPACIADO CONSISTENTE ────────────────────────────────────────────────────

export const Spacing = {
  // Padding interno de cards/secciones
  cardPad:    'p-5',
  cardPadLg:  'p-6',
  // Gap entre widgets
  widgetGap:  'gap-4',
  widgetGapLg:'gap-5',
  // Padding de página
  pagePad:    'px-4 md:px-6 lg:px-8 py-6 md:py-8',
} as const

// ─── REGLAS DE USO: CUÁNDO NO AÑADIR MÁS ELEMENTOS ───────────────────────────
// (comentarios de arquitectura — no código ejecutable)

/**
 * REGLAS ANTI-SOBRECARGA:
 *
 * 1. MAX 4 KPI CARDS en la fila superior del dashboard.
 *    Añadir una quinta obliga a reducir el tamaño de todas — no hacerlo.
 *
 * 2. MAX 3 ACCIONES por fila en tablas (ver, editar, eliminar).
 *    Si necesitas una cuarta, evaluar si va en la página de detalle.
 *
 * 3. MAX 2 BADGES por fila/item en listados.
 *    Status + urgency es el límite. Módulos derivados van en detalle, no en lista.
 *
 * 4. MAX 5 items en listados del widget del dashboard antes del "ver todos".
 *    Los widgets no son páginas — su trabajo es resumir y redirigir.
 *
 * 5. NINGÚN GRADIENTE DECORATIVO.
 *    Los gradientes solo se permiten en barras de progreso y gráficos SVG.
 *    Los fondos de card son flat con opacidad baja (bg-white/[0.025]).
 *
 * 6. TOOLTIPS SOLO EN MODO COLAPSADO.
 *    No añadir tooltips a elementos que ya tienen label visible.
 *
 * 7. ANIMACIONES: max 300ms, solo transform y opacity.
 *    No animar layout properties (width, height, margin) — causan reflow.
 */
