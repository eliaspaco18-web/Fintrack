'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

interface FirstRunOnboardingProps {
  hasAccounts: boolean
  hasTransactions: boolean
}

interface StepItem {
  id: string
  title: string
  description: string
  href: string
  cta: string
  done: boolean
}

export function FirstRunOnboarding({
  hasAccounts,
  hasTransactions,
}: FirstRunOnboardingProps) {
  const [dismissed, setDismissed] = useState(false)
  const [hasCustomCategories, setHasCustomCategories] = useState(false)

  useEffect(() => {
    let cancelled = false

    const loadCategories = async () => {
      try {
        const res = await fetch('/api/categories?include_system=false', { cache: 'no-store' })
        const json = await res.json().catch(() => null)
        if (cancelled) return
        if (!res.ok || !json?.ok) return
        const categories = Array.isArray(json.data) ? json.data : []
        setHasCustomCategories(categories.length > 0)
      } catch {
        if (!cancelled) setHasCustomCategories(false)
      }
    }

    void loadCategories()

    return () => {
      cancelled = true
    }
  }, [])

  const steps = useMemo<StepItem[]>(() => [
    {
      id: 'portfolio',
      title: 'Crea tu primera cuenta o banco',
      description: 'Configura una cuenta base en Portafolio para empezar a registrar movimientos.',
      href: '/portfolio',
      cta: 'Ir a Portafolio',
      done: hasAccounts,
    },
    {
      id: 'admin',
      title: 'Crea categorías de ingreso y egreso',
      description: 'Define tus categorías en Administración para ordenar mejor tus reportes.',
      href: '/admin',
      cta: 'Ir a Administración',
      done: hasCustomCategories,
    },
    {
      id: 'transactions',
      title: 'Registra tu primera transacción',
      description: 'Carga un ingreso o egreso y valida cómo se actualiza el dashboard.',
      href: '/transactions/new',
      cta: 'Nueva transacción',
      done: hasTransactions,
    },
  ], [hasAccounts, hasCustomCategories, hasTransactions])

  const completed = steps.filter(step => step.done).length

  if (dismissed) return null

  return (
    <section
      data-testid="dashboard-first-run-onboarding"
      className="rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-5 md:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-muted)]">Primer ingreso</p>
          <h2 className="mt-1 text-lg font-bold text-[var(--color-text)]">Bienvenido a FinTrack</h2>
          <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
            Completa estos pasos rápidos para dejar tu cuenta lista y comenzar tus pruebas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-[color:var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-text-muted)]">
            {completed}/3 completado{completed === 1 ? '' : 's'}
          </span>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            data-testid="dashboard-first-run-dismiss"
            className="rounded-lg border border-[color:var(--color-border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-text-muted)] hover:border-[color:var(--color-border-hover)] hover:text-[var(--color-text)] transition-colors"
          >
            Ocultar
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        {steps.map((step, index) => (
          <article
            key={step.id}
            className="rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface-2)] p-3.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-[var(--color-text-muted)]">Paso {index + 1}</span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  step.done
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'bg-amber-500/15 text-amber-300'
                }`}
              >
                {step.done ? 'Listo' : 'Pendiente'}
              </span>
            </div>
            <h3 className="mt-2 text-sm font-semibold text-[var(--color-text)]">{step.title}</h3>
            <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">{step.description}</p>
            <Link
              href={step.href}
              className="mt-3 inline-flex items-center rounded-lg bg-emerald-500 px-3 py-1.5 text-[11px] font-bold text-[var(--color-on-accent)] hover:bg-emerald-400 transition-colors"
            >
              {step.cta}
            </Link>
          </article>
        ))}
      </div>
    </section>
  )
}
