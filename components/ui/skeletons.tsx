// =============================================================================
// components/ui/skeletons.tsx
// Skeletons de carga para páginas y secciones específicas.
// Coinciden estructuralmente con los componentes reales — evitan layout shift.
// =============================================================================

'use client'

// ─── PRIMITIVO ────────────────────────────────────────────────────────────────

function Bone({
  w = 'full', h = 3, rounded = 'md', className = '',
}: {
  w?: string | number
  h?: number
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  className?: string
}) {
  const widthClass = typeof w === 'number'
    ? ''
    : w === 'full' ? 'w-full' : `w-[${w}]`

  const radiusClass = {
    sm:   'rounded',
    md:   'rounded-md',
    lg:   'rounded-lg',
    xl:   'rounded-xl',
    full: 'rounded-full',
  }[rounded]

  return (
    <div
      className={`animate-pulse bg-[var(--c-surface-2)] ${radiusClass} ${widthClass} ${className}`}
      style={{
        height: `${h * 4}px`,
        ...(typeof w === 'number' ? { width: `${w}px` } : {}),
      }}
      role="presentation"
      aria-hidden
    />
  )
}

// ─── CARD SKELETON ────────────────────────────────────────────────────────────

export function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-5 ${className}`}
      role="status" aria-label="Cargando…">
      <div className="space-y-3">
        <Bone w={120} h={3}/>
        <Bone w={180} h={7}/>
        <Bone w={96}  h={3}/>
      </div>
    </div>
  )
}

// ─── KPI ROW SKELETON ─────────────────────────────────────────────────────────

export function KpiRowSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <CardSkeleton key={i}/>
      ))}
    </div>
  )
}

// ─── CHART SKELETON ───────────────────────────────────────────────────────────

export function ChartSkeleton({ height = 160 }: { height?: number }) {
  return (
    <div
      className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-5"
      role="status" aria-label="Cargando gráfico…"
    >
      <div className="space-y-4">
        <Bone w={140} h={3}/>
        <div
          className="flex items-end gap-2"
          style={{ height }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex-1 flex gap-0.5 items-end h-full">
              <div
                className="flex-1 rounded-t animate-pulse bg-[var(--c-surface-2)]"
                style={{ height: `${35 + (i % 3) * 20}%` }}
              />
              <div
                className="flex-1 rounded-t animate-pulse bg-[var(--c-surface-hover)]"
                style={{ height: `${25 + (i % 4) * 15}%` }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── TABLE SKELETON ───────────────────────────────────────────────────────────

export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-[var(--c-border)]"
      role="status" aria-label="Cargando tabla…"
    >
      {/* Toolbar */}
      <div className="flex gap-2 border-b border-[var(--c-border)] bg-[var(--c-surface)] p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bone key={i} w={i === 0 ? 60 : i === 1 ? 70 : 80} h={7} rounded="lg"/>
        ))}
        <div className="ml-auto">
          <Bone w={160} h={7} rounded="lg"/>
        </div>
      </div>

      {/* Header */}
      <div className="flex gap-4 border-b border-[var(--c-border)] bg-[var(--c-surface-2)] px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Bone key={i} w={[60, 140, 100, 70, 60][i] ?? 80} h={3}/>
        ))}
      </div>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, ri) => (
        <div key={ri} className="flex gap-4 border-b border-[var(--c-border)] px-4 py-3.5">
          {Array.from({ length: cols }).map((_, ci) => (
            <Bone
              key={ci}
              w={[60, 140 + (ri % 3) * 20, 100, 70, 60][ci] ?? 80}
              h={3}
              className="opacity-[0.6]"
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── FORM SKELETON ────────────────────────────────────────────────────────────

export function FormSkeleton() {
  return (
    <div className="space-y-5 max-w-lg" role="status" aria-label="Cargando formulario…">
      {/* Type selector */}
      <Bone w="full" h={11} rounded="lg"/>
      {/* Amount row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-2">
          <Bone w={60} h={3}/><Bone w="full" h={10} rounded="lg"/>
        </div>
        <div className="space-y-2">
          <Bone w={50} h={3}/><Bone w="full" h={10} rounded="lg"/>
        </div>
      </div>
      {/* Account */}
      <div className="space-y-2">
        <Bone w={80} h={3}/><Bone w="full" h={10} rounded="lg"/>
      </div>
      {/* Description + date */}
      <div className="grid grid-cols-[1fr_140px] gap-3">
        <div className="space-y-2">
          <Bone w={80} h={3}/><Bone w="full" h={10} rounded="lg"/>
        </div>
        <div className="space-y-2">
          <Bone w={50} h={3}/><Bone w="full" h={10} rounded="lg"/>
        </div>
      </div>
      {/* Submit */}
      <Bone w="full" h={12} rounded="xl"/>
    </div>
  )
}

// ─── DETAIL SKELETON ──────────────────────────────────────────────────────────

export function DetailSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6"
      role="status" aria-label="Cargando…">
      <div className="space-y-5">
        <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-6 space-y-4">
          <div className="flex items-start gap-4">
            <Bone w={48} h={12} rounded="lg"/>
            <div className="flex-1 space-y-3">
              <Bone w={80} h={3}/>
              <Bone w={200} h={6}/>
              <Bone w={140} h={3}/>
            </div>
            <Bone w={100} h={8}/>
          </div>
          <div className="pt-2 grid grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Bone w={60} h={2.5}/><Bone w={120} h={4}/>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <CardSkeleton/>
        <CardSkeleton/>
      </div>
    </div>
  )
}
