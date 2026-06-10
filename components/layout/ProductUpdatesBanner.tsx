'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { getActiveProductUpdates } from '@/lib/product-updates/registry'

export function ProductUpdatesBanner() {
  const updates = useMemo(() => getActiveProductUpdates(new Date()), [])

  if (updates.length === 0) return null

  return (
    <section className="mb-4 space-y-3" aria-label="Novedades del producto">
      {updates.map((update) => (
        <div
          key={update.id}
          className="rounded-2xl border border-[var(--ft-primary-border)] bg-[var(--ft-primary-soft)] px-4 py-3 text-[var(--ft-text)] shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)]"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-full bg-[var(--ft-primary)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--ft-text-on-primary)]">
                  {update.badgeLabel ?? 'Nuevo'}
                </span>
                <p className="text-[13px] font-semibold tracking-[-0.01em]">
                  {update.title}
                </p>
              </div>
              <p className="mt-2 max-w-3xl text-[12px] leading-5 text-[var(--ft-text-muted)]">
                {update.message}
              </p>
            </div>

            {update.href ? (
              <Link
                href={update.href}
                className="inline-flex shrink-0 items-center text-[12px] font-semibold text-[var(--ft-primary)] transition-colors hover:text-[var(--ft-primary-hover)]"
              >
                {update.hrefLabel ?? 'Ver detalle'} {'->'}
              </Link>
            ) : null}
          </div>
        </div>
      ))}
    </section>
  )
}
