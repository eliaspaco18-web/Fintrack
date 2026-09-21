import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase.server'
import { apiError, apiOk, apiUnauthorized, getSessionUserId } from '@/lib/api/response'
import { LOAN_TYPE_VALUES, type LoanType } from '@/modules/loans/loan-type'
import { extractSbsAnnualRate } from '@/modules/loans/sbs-rate-parser'
import { getVerifiedSbsDailySnapshotRate } from '@/modules/loans/sbs-official-snapshots'

const DAILY_SOURCES: Partial<Record<LoanType, { title: string; url: string; scope: string }>> = {
  CONSUMPTION: {
    title: 'SBS · Tasa promedio para créditos de consumo',
    url: 'https://www.sbs.gob.pe/app/pp/EstadisticasSAEEPortal/Paginas/TIPMicroConsumo.aspx',
    scope: 'Créditos de consumo del sistema financiero',
  },
  VEHICLE: {
    title: 'SBS · Tasa promedio para créditos de consumo',
    url: 'https://www.sbs.gob.pe/app/pp/EstadisticasSAEEPortal/Paginas/TIPMicroConsumo.aspx',
    scope: 'Referencia SBS de consumo; incluye operaciones de automóviles',
  },
  MICROENTERPRISE: {
    title: 'SBS · Tasa promedio para créditos a la microempresa',
    url: 'https://www.sbs.gob.pe/app/pp/EstadisticasSAEEPortal/Paginas/TIPMicroEmpresa.aspx?tip=B',
    scope: 'Créditos a la microempresa del sistema financiero',
  },
}

const TABLE_SOURCE = {
  title: 'SBS · Tasas activas por tipo de crédito',
  url: 'https://www.sbs.gob.pe/app/pp/EstadisticasSAEEPortal/Paginas/TIActivaTipoCreditoEmpresa.aspx?tip=B',
}

function isLoanType(value: string | null): value is LoanType {
  return Boolean(value && LOAN_TYPE_VALUES.includes(value as LoanType))
}

function getLimaIsoDate(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const valueFor = (type: string) => parts.find(part => part.type === type)?.value
  return `${valueFor('year')}-${valueFor('month')}-${valueFor('day')}`
}

function isSbsAutomationChallenge(html: string): boolean {
  return /_Incapsula_Resource|noindex,nofollow/i.test(html)
}

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const loanTypeParam = req.nextUrl.searchParams.get('loan_type')
  const currencyParam = req.nextUrl.searchParams.get('currency')
  if (!isLoanType(loanTypeParam) || (currencyParam !== 'PEN' && currencyParam !== 'USD')) {
    return apiError({ code: 'VALIDATION_ERROR', message: 'Tipo de préstamo o moneda inválidos.' })
  }

  const source = DAILY_SOURCES[loanTypeParam]
  if (!source) {
    return apiOk({
      availability: 'UNAVAILABLE',
      rate_annual_percent: null,
      source: TABLE_SOURCE,
      message: 'La referencia SBS por producto aún no puede verificarse automáticamente para este tipo de préstamo.',
    })
  }

  try {
    const response = await fetch(source.url, {
      cache: 'no-store',
      headers: { 'User-Agent': 'FinTrack market-rate verifier' },
    })
    if (!response.ok) throw new Error(`SBS respondió ${response.status}`)

    const html = await response.text()
    const rate = extractSbsAnnualRate(html, currencyParam)
    if (rate === null) {
      const snapshotDate = getLimaIsoDate()
      const snapshotRate = isSbsAutomationChallenge(html)
        ? getVerifiedSbsDailySnapshotRate(snapshotDate, loanTypeParam, currencyParam)
        : null

      if (snapshotRate !== null) {
        return apiOk({
          availability: 'AVAILABLE',
          rate_annual_percent: snapshotRate,
          source: {
            ...source,
            scope: `${source.scope} · publicación SBS verificada el ${snapshotDate.split('-').reverse().join('/')}`,
          },
          message: 'Referencia diaria oficial SBS verificada para la fecha actual.',
        })
      }

      return apiOk({
        availability: 'UNAVAILABLE',
        rate_annual_percent: null,
        source,
        message: 'La SBS no publicó una tasa verificable para esta moneda en su respuesta actual.',
      })
    }

    return apiOk({
      availability: 'AVAILABLE',
      rate_annual_percent: rate,
      source,
      message: null,
    })
  } catch {
    return apiOk({
      availability: 'UNAVAILABLE',
      rate_annual_percent: null,
      source,
      message: 'No se pudo consultar la referencia SBS en este momento.',
    })
  }
}
