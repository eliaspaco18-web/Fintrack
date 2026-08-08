'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { getActiveProductUpdates } from '@/lib/product-updates/registry'

export function ProductUpdatesBanner() {
  const updates = useMemo(() => getActiveProductUpdates(new Date()), [])

  if (updates.length === 0) return null

  return (
    <section className="mb-5 space-y-3" aria-label="Novedades del producto">
      {updates.map((update) => (
        <div
          key={update.id}
          className="rounded-surface border border-[var(--ft-border)] border-l-2 border-l-[var(--ft-primary)] bg-[var(--ft-surface)] px-4 py-3 text-[var(--ft-text-strong)] shadow-elevation-sm"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-full border border-[var(--ft-primary-border)] bg-[var(--ft-primary-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ft-primary)]">
                  {update.badgeLabel ?? 'Nuevo'}
                </span>
                <p className="text-[13px] font-semibold tracking-[-0.01em]">
                  {update.title}
                </p>
              </div>
              <p className="mt-1.5 max-w-3xl text-[13px] leading-5 text-[var(--ft-text-muted)]">
                {update.message}
              </p>
            </div>

            {update.href ? (
              <Link
                href={update.href}
                className="inline-flex shrink-0 items-center rounded-control px-2 py-1.5 text-[12px] font-semibold text-[var(--ft-primary)] transition-colors duration-fast motion-reduce:transition-none hover:bg-[var(--ft-primary-soft)] hover:text-[var(--ft-primary-hover)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--ft-focus-ring-color)]"
              >
                {update.hrefLabel ?? 'Ver detalle'} →
              </Link>
            ) : null}
          </div>
        </div>
      ))}
    </section>
  )
}
