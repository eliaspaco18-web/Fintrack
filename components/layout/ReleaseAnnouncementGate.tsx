'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ReleaseHighlight, ReleaseHighlightType } from '@/lib/release/current-release'
import { Button } from '@/components/ui/Button'

interface PendingAnnouncement {
  id: string
  version: string
  title: string
  summary: string
  highlights: ReleaseHighlight[]
  deployed_at: string
}

interface ReleaseStatusPayload {
  currentVersion: string
  pendingAnnouncement: PendingAnnouncement | null
}

function ReleaseBadgeIcon({ variant }: { variant: ReleaseHighlightType }) {
  if (variant === 'new') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
        <path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3z" fill="currentColor" />
      </svg>
    )
  }

  if (variant === 'improve') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
        <path d="M4 17h4v3H4v-3zm6-6h4v9h-4v-9zm6-7h4v16h-4V4z" fill="currentColor" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path d="M9.4 16.6L5.8 13l-1.4 1.4 5 5 10-10-1.4-1.4-8.6 8.6z" fill="currentColor" />
    </svg>
  )
}

function releaseTone(variant: ReleaseHighlightType) {
  if (variant === 'new') {
    return {
      chipLabel: 'Nuevo',
      chipClass: 'border-[var(--ft-primary-border)] bg-[var(--ft-primary-soft)] text-[var(--ft-primary)]',
      iconClass: 'bg-[var(--ft-primary-soft)] text-[var(--ft-primary)]',
    }
  }

  if (variant === 'fix') {
    return {
      chipLabel: 'Corregido',
      chipClass: 'border-[color-mix(in_srgb,var(--ft-success)_22%,var(--ft-border))] bg-[var(--ft-success-soft)] text-[var(--ft-success)]',
      iconClass: 'bg-[var(--ft-success-soft)] text-[var(--ft-success)]',
    }
  }

  return {
    chipLabel: 'Mejorado',
    chipClass: 'border-[color-mix(in_srgb,var(--ft-info)_22%,var(--ft-border))] bg-[var(--ft-info-soft)] text-[var(--ft-info)]',
    iconClass: 'bg-[var(--ft-info-soft)] text-[var(--ft-info)]',
  }
}

export function ReleaseAnnouncementGate() {
  const [announcement, setAnnouncement] = useState<PendingAnnouncement | null>(null)
  const [isClosing, setIsClosing] = useState(false)

  const acknowledge = useCallback(async () => {
    if (!announcement || isClosing) return
    setIsClosing(true)
    try {
      await fetch('/api/releases/current', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      })
    } finally {
      setAnnouncement(null)
      setIsClosing(false)
    }
  }, [announcement, isClosing])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const response = await fetch('/api/releases/current', { cache: 'no-store' })
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload?.ok || cancelled) return
        const data = payload.data as ReleaseStatusPayload
        if (!cancelled) setAnnouncement(data.pendingAnnouncement)
      } catch {
        // El aviso es complementario; si falla, no bloquea la app.
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  if (!announcement) return null

  const releaseDate = new Date(announcement.deployed_at).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-[var(--ft-overlay)] px-4 py-6">
      <div className="max-h-[calc(100dvh-48px)] w-full max-w-2xl overflow-y-auto rounded-modal border border-[var(--ft-border)] bg-[var(--ft-modal-bg)] p-5 shadow-elevation-xl sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--ft-primary-border)] bg-[var(--ft-primary-soft)] px-3 py-1 text-[11px] font-semibold text-[var(--ft-primary)]">
            <ReleaseBadgeIcon variant="new" />
            Nueva versión
          </span>
          <span className="inline-flex rounded-full border border-[var(--ft-border)] px-3 py-1 text-[12px] font-semibold text-[var(--ft-text-muted)]">
            {announcement.version}
          </span>
          <span className="text-[12px] text-[var(--ft-text-subtle)]">
            Publicada el {releaseDate}
          </span>
        </div>

        <h2 className="mt-4 text-[24px] font-semibold leading-8 tracking-[-0.025em] text-[var(--ft-text-strong)] sm:text-[26px]">
          {announcement.title}
        </h2>
        <p className="mt-3 max-w-2xl text-[14px] leading-7 text-[var(--ft-text-muted)]">
          {announcement.summary}
        </p>

        {announcement.highlights.length > 0 ? (
          <div className="mt-5 overflow-hidden rounded-surface border border-[var(--ft-border)] bg-[var(--ft-surface-muted)]">
            <p className="px-4 pb-2 pt-4 text-[12px] font-semibold text-[var(--ft-text-muted)]">
              Qué cambió en esta versión
            </p>
            <ul className="divide-y divide-[var(--ft-border)] text-[14px] leading-6 text-[var(--ft-text-strong)]">
              {announcement.highlights.map((item) => {
                const tone = releaseTone(item.type)

                return (
                  <li key={`${item.module}-${item.title}`} className="px-4 py-4">
                    <div className="flex gap-3">
                      <span className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-control ${tone.iconClass}`}>
                        <ReleaseBadgeIcon variant={item.type} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex rounded-full border border-[var(--ft-border)] bg-[var(--ft-surface)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ft-text-subtle)]">
                            {item.module}
                          </span>
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone.chipClass}`}>
                            {tone.chipLabel}
                          </span>
                        </div>
                        <p className="mt-2 text-[14px] font-semibold text-[var(--ft-text-strong)]">{item.title}</p>
                        <p className="mt-1 text-[13px] leading-6 text-[var(--ft-text-muted)]">{item.detail}</p>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}

        <div className="mt-6 flex justify-end">
          <Button
            type="button"
            onClick={() => void acknowledge()}
            variant="primary"
            size="lg"
            loading={isClosing}
            disabled={isClosing}
          >
            {isClosing ? 'Guardando...' : 'Entendido'}
          </Button>
        </div>
      </div>
    </div>
  )
}
