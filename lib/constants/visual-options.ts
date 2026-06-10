export interface VisualIconOption {
  value: string
  label: string
}

export const ACCOUNT_ICON_OPTIONS: readonly VisualIconOption[] = [
  { value: 'wallet', label: 'Billetera' },
  { value: 'bank', label: 'Banco' },
  { value: 'credit-card', label: 'Tarjeta' },
  { value: 'coins', label: 'Monedas' },
  { value: 'piggy-bank', label: 'Ahorros' },
  { value: 'briefcase', label: 'Negocio' },
  { value: 'shield', label: 'Caja fuerte' },
  { value: 'chart-line', label: 'Inversion' },
]

export const CATEGORY_ICON_OPTIONS: readonly VisualIconOption[] = [
  { value: 'tag', label: 'Etiqueta' },
  { value: 'wallet', label: 'Cobro / Billetera' },
  { value: 'bank', label: 'Banco / Transferencia' },
  { value: 'coins', label: 'Monedas / Cripto' },
  { value: 'utensils', label: 'Alimentacion' },
  { value: 'car', label: 'Transporte' },
  { value: 'home', label: 'Vivienda' },
  { value: 'heart', label: 'Salud' },
  { value: 'book-open', label: 'Educacion' },
  { value: 'film', label: 'Entretenimiento' },
  { value: 'package', label: 'Activo' },
  { value: 'shield', label: 'Proteccion / Seguro' },
  { value: 'chart-line', label: 'Inversion / Analitica' },
  { value: 'credit-card', label: 'Credito / Prestamo' },
  { value: 'file-minus', label: 'Cuenta por pagar' },
  { value: 'minus-circle', label: 'Otros gastos' },
  { value: 'briefcase', label: 'Trabajo' },
]

export const ACCOUNT_COLOR_OPTIONS = [
  '#10b981',
  '#06b6d4',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#f59e0b',
  '#f97316',
  '#ef4444',
  '#14b8a6',
  '#64748b',
] as const

export const CATEGORY_COLOR_OPTIONS = [
  '#10b981',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#f59e0b',
  '#f97316',
  '#ef4444',
  '#64748b',
] as const
