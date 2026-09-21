'use client'

import { useEffect, useState } from 'react'
import { formatPercent } from '@/lib/contracts/ui.contracts'
import { getLoanRateVerdict, type LoanRateVerdict } from '@/modules/loans/loan-rate-analysis'

type MarketRateResponse = {
  availability: 'AVAILABLE' | 'UNAVAILABLE'
  rate_annual_percent: number | null
  source: { title: string; url: string; scope?: string }
  message: string | null
}

const VERDICT_PRESENTATION: Record<LoanRateVerdict, { label: string; className: string }> = {
  ECONOMICAL: { label: 'Más económico que la referencia', className: 'text-[var(--ft-success)]' },
  MARKET: { label: 'En rango de mercado', className: 'text-[var(--ft-primary)]' },
  EXPENSIVE: { label: 'Más costoso que la referencia', className: 'text-[var(--ft-danger)]' },
}

export function LoanMarketRateComparison({
  loanType,
  currency,
  tceaPercent,
}: {
  loanType: string
  currency: 'PEN' | 'USD'
  tceaPercent: number | null
}) {
  const [result, setResult] = useState<MarketRateResponse | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setResult(null)

    fetch(`/api/market-rates/sbs?loan_type=${encodeURIComponent(loanType)}&currency=${currency}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(response => response.json())
      .then(payload => {
        if (!controller.signal.aborted && payload?.ok) setResult(payload.data)
      })
      .catch(() => null)

    return () => controller.abort()
  }, [currency, loanType])

  if (tceaPercent === null) {
    return (
      <p className="text-[12px] leading-5 text-[var(--ft-text-muted)]">
        No se pudo calcular la TCEA desde las fechas y montos del cronograma.
      </p>
    )
  }

  const verdict = result?.availability === 'AVAILABLE' && result.rate_annual_percent !== null
    ? getLoanRateVerdict(tceaPercent, result.rate_annual_percent)
    : null
  const verdictPresentation = verdict ? VERDICT_PRESENTATION[verdict] : null

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[12px] font-semibold text-[var(--ft-text)]">
          TCEA estimada: {formatPercent(tceaPercent, { fractionDigits: 2 })}
        </span>
        {result?.availability === 'AVAILABLE' && result.rate_annual_percent !== null ? (
          <span className="text-[12px] text-[var(--ft-text-muted)]">
            SBS: {formatPercent(result.rate_annual_percent, { fractionDigits: 2 })}
          </span>
        ) : null}
      </div>
      {verdictPresentation ? (
        <p className={`text-[12px] font-semibold ${verdictPresentation.className}`}>
          {verdictPresentation.label}
        </p>
      ) : (
        <p className="text-[12px] leading-5 text-[var(--ft-text-muted)]">
          {result?.message ?? 'Consultando la referencia oficial de la SBS…'}
        </p>
      )}
      {result?.source ? (
        <div className="space-y-1">
          <a
            href={result.source.url}
            target="_blank"
            rel="noreferrer"
            className="text-[12px] font-medium text-[var(--ft-primary)] underline underline-offset-2"
          >
            {result.source.title}
          </a>
          {result.source.scope ? (
            <p className="text-[11px] leading-4 text-[var(--ft-text-muted)]">{result.source.scope}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
