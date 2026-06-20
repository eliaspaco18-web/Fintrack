import type { Credit } from '@/types/database.types'

export type CreditDisplayType = 'CARD' | 'LOAN' | 'LINE'
export type CreditDisplayTone = 'info' | 'warning' | 'primary'

export type CreditListItem = Credit & {
  display_type: CreditDisplayType
  has_loan: boolean
  bank_entity?: {
    id: string
    name: string
    short_name: string | null
    color: string | null
    icon: string | null
    is_active: boolean
  } | null
  account?: {
    id: string
    name: string
    type: string
    currency: string
    is_active: boolean
  } | null
}

export function deriveCreditDisplayType(params: {
  creditType: Credit['credit_type']
  hasLoan: boolean
}): CreditDisplayType {
  if (params.creditType === 'CREDIT_CARD') return 'CARD'
  return params.hasLoan ? 'LOAN' : 'LINE'
}

export function getCreditDisplayLabel(displayType: CreditDisplayType): string {
  return {
    CARD: 'Tarjeta',
    LOAN: 'Préstamo',
    LINE: 'Línea',
  }[displayType]
}

export function getCreditDisplayDescription(displayType: CreditDisplayType): string {
  return {
    CARD: 'Tarjetas con ciclos de facturación',
    LOAN: 'Préstamos bancarios con cronograma',
    LINE: 'Líneas de crédito revolventes',
  }[displayType]
}

export function getCreditDisplayTone(displayType: CreditDisplayType): CreditDisplayTone {
  const toneByDisplayType: Record<CreditDisplayType, CreditDisplayTone> = {
    CARD: 'info',
    LOAN: 'warning',
    LINE: 'primary',
  }

  return toneByDisplayType[displayType]
}
