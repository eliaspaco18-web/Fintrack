import { clamp } from './svg-utils'

export type HealthFactorKey =
  | 'savings'
  | 'credit'
  | 'liquidity'
  | 'debt'
  | 'diversification'
  | 'discipline'

export interface HealthFactorScores {
  savings: number
  credit: number
  liquidity: number
  debt: number
  diversification: number
  discipline: number
}

export type HealthToneKey = 'solid' | 'moderate' | 'pressure'

export interface HealthTone {
  key: HealthToneKey
  color: string
  label: string
  ring: string
}

export interface HealthScoreResult {
  scores: number[]
  average: number
  tone: HealthTone
}

export const HEALTH_FACTOR_ORDER: HealthFactorKey[] = [
  'savings',
  'credit',
  'liquidity',
  'debt',
  'diversification',
  'discipline',
]

export function calcSavingsScore(ingresos: number, egresos: number): number {
  if (ingresos <= 0) return 0

  const savingsRate = ((ingresos - egresos) / ingresos) * 100
  return clamp(savingsRate * 5, 0, 100)
}

export function calcCreditScore(creditUsagePct: number): number {
  return clamp(100 - creditUsagePct, 0, 100)
}

export function calcLiquidityScore(balance: number, egresos: number): number {
  if (egresos <= 0) return balance > 0 ? 100 : 0

  return clamp((balance / egresos) * 33, 0, 100)
}

export function calcDebtScore(totalDeuda: number, totalActivos: number): number {
  if (totalDeuda <= 0 && totalActivos <= 0) return 80
  if (totalDeuda > 0 && totalActivos <= 0) return 15

  const debtToAssetRatio = (totalDeuda / totalActivos) * 100
  return clamp(100 - debtToAssetRatio, 0, 100)
}

export function calcDiversificationScore(uniqueAssetTypes: number): number {
  return clamp(uniqueAssetTypes * 25, 0, 100)
}

export function calcDisciplineScore(alertas: number, criticalDue: number): number {
  return clamp(100 - alertas * 15 - criticalDue * 25, 0, 100)
}

export function scoreTone(score: number): HealthTone {
  if (score >= 75) {
    return {
      key: 'solid',
      color: 'var(--ft-primary)',
      label: 'Salud sólida',
      ring: 'border-[var(--ft-primary-border)] bg-[var(--ft-primary-soft)] text-[var(--ft-primary)]',
    }
  }

  if (score >= 55) {
    return {
      key: 'moderate',
      color: 'var(--ft-warning)',
      label: 'Atención moderada',
      ring: 'border-[color-mix(in_oklch,var(--ft-warning)_24%,transparent)] bg-[color-mix(in_oklch,var(--ft-warning)_10%,transparent)] text-[var(--ft-warning)]',
    }
  }

  return {
    key: 'pressure',
    color: 'var(--ft-danger)',
    label: 'Presión financiera',
    ring: 'border-[color-mix(in_oklch,var(--ft-danger)_24%,transparent)] bg-[color-mix(in_oklch,var(--ft-danger)_10%,transparent)] text-[var(--ft-danger)]',
  }
}

export function calcHealthScore(factors: HealthFactorScores): HealthScoreResult {
  const scores = HEALTH_FACTOR_ORDER.map((key) => clamp(factors[key], 0, 100))
  const average = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)

  return {
    scores,
    average,
    tone: scoreTone(average),
  }
}
