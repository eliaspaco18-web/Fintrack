'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ReleaseHighlight, ReleaseHighlightType } from '@/lib/release/current-release'

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
      chipClass: 'bg-[color:rgba(15,118,110,0.10)] text-[var(--ft-primary)] border-[color:rgba(15,118,110,0.16)]',
      iconClass: 'bg-[color:rgba(15,118,110,0.12)] text-[var(--ft-primary)]',
    }
  }

  if (variant === 'fix') {
    return {
      chipLabel: 'Corregido',
      chipClass: 'bg-[color:rgba(21,128,61,0.10)] text-[color:#166534] border-[color:rgba(21,128,61,0.16)]',
      iconClass: 'bg-[color:rgba(34,197,94,0.12)] text-[color:#15803d]',
    }
  }

  return {
    chipLabel: 'Mejorado',
    chipClass: 'bg-[color:rgba(37,99,235,0.10)] text-[color:#1d4ed8] border-[color:rgba(37,99,235,0.16)]',
    iconClass: 'bg-[color:rgba(59,130,246,0.12)] text-[color:#1d4ed8]',
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
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[color:rgba(15,23,42,0.36)] px-4 backdrop-blur-[3px]">
      <div className="w-full max-w-2xl rounded-[24px] border border-[var(--ft-border)] bg-[var(--ft-surface)] p-6 shadow-[0_40px_120px_-48px_rgba(15,23,42,0.45)] sm:p-7">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-[var(--ft-primary-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ft-primary)]">
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

        <h2 className="mt-4 text-[28px] font-semibold tracking-[-0.02em] text-[var(--ft-text)]">
          {announcement.title}
        </h2>
        <p className="mt-3 max-w-2xl text-[14px] leading-7 text-[var(--ft-text-muted)]">
          {announcement.summary}
        </p>

        {announcement.highlights.length > 0 ? (
          <div className="mt-5 rounded-[18px] border border-[var(--ft-border)] bg-[var(--ft-surface-2)] px-5 py-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--ft-text-subtle)]">
              Qué cambió en esta versión
            </p>
            <ul className="mt-3 space-y-3 text-[14px] leading-6 text-[var(--ft-text)]">
              {announcement.highlights.map((item) => {
                const tone = releaseTone(item.type)

                return (
                  <li key={`${item.module}-${item.title}`} className="rounded-[16px] border border-[var(--ft-border)] bg-[var(--ft-surface)] px-4 py-3">
                    <div className="flex gap-3">
                      <span className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] ${tone.iconClass}`}>
                        <ReleaseBadgeIcon variant={item.type} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex rounded-full border border-[var(--ft-border)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--ft-text-subtle)]">
                            {item.module}
                          </span>
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${tone.chipClass}`}>
                            {tone.chipLabel}
                          </span>
                        </div>
                        <p className="mt-2 text-[14px] font-semibold text-[var(--ft-text)]">{item.title}</p>
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
          <button
            type="button"
            onClick={() => void acknowledge()}
            className="inline-flex h-11 items-center justify-center rounded-[14px] bg-[var(--ft-primary)] px-5 text-[13px] font-semibold text-[var(--ft-text-on-primary)] transition-colors duration-150 hover:bg-[var(--ft-primary-hover)] disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isClosing}
          >
            {isClosing ? 'Guardando...' : 'Entendido'}
          </button>
        </div>
      </div>
    </div>
  )
}
