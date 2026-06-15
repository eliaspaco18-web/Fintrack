// =============================================================================
// lib/constants/category-keys.ts
// Fuente de verdad única para los system_keys de categorías.
//
// POR QUÉ AQUÍ Y NO EN CONTRACTS/UI:
//   Estos valores se usan tanto en la capa de servicio (validaciones)
//   como en la UI (derivar secciones). Al vivir en lib/constants son
//   importables desde cualquier capa sin crear dependencias circulares.
//
// REGLA DE ORO: ningún código compara contra nombres visibles de categoría.
//   MAL:  categoryName === 'Activo'
//   BIEN: categorySystemKey === CategoryKeys.EXPENSE_ASSET
// =============================================================================

/** Claves estables de categorías del sistema. Nunca renombrar estos valores. */
export const CategoryKeys = {
  // ── Ingresos ────────────────────────────────────────────────────────────────
  INCOME_SALARY:     'income_salary',
  INCOME_FREELANCE:  'income_freelance',
  INCOME_INVESTMENT: 'income_investment',
  INCOME_RENTAL:     'income_rental',
  /** Legacy: categoría genérica histórica de cuentas por cobrar */
  INCOME_RECEIVABLE: 'income_receivable',
  /** Cobro de préstamos */
  INCOME_RECEIVABLE_COLLECTION: 'income_receivable_collection',
  /** Préstamos otorgados (De terceros) */
  INCOME_PAYABLE_ISSUE: 'income_payable_issue',
  INCOME_OTHER:      'income_other',

  // ── Egresos ─────────────────────────────────────────────────────────────────
  EXPENSE_FOOD:      'expense_food',
  EXPENSE_TRANSPORT: 'expense_transport',
  EXPENSE_HOUSING:   'expense_housing',
  EXPENSE_HEALTH:    'expense_health',
  EXPENSE_EDUCATION: 'expense_education',
  EXPENSE_LEISURE:   'expense_leisure',
  /** Activa el módulo de activo */
  EXPENSE_ASSET:     'expense_asset',
  /** Activa el módulo de crédito (y opcionalmente préstamo) */
  EXPENSE_CREDIT:    'expense_credit',
  /** Legacy: categoría genérica histórica de cuentas por pagar */
  EXPENSE_PAYABLE:   'expense_payable',
  /** Préstamos otorgados (A terceros) */
  EXPENSE_RECEIVABLE_ISSUE: 'expense_receivable_issue',
  /** Pago de préstamos */
  EXPENSE_PAYABLE_PAYMENT: 'expense_payable_payment',
  EXPENSE_OTHER:     'expense_other',
} as const

export type CategoryKey = (typeof CategoryKeys)[keyof typeof CategoryKeys]

// ─── MÓDULOS QUE ACTIVA CADA CLAVE ────────────────────────────────────────────
// Declarativo: qué módulo deriva de qué system_key.
// Permite agregar nuevas asociaciones sin tocar deriveSections().

export type DerivedModule = 'asset' | 'credit' | 'receivable' | 'payable'

export const LOCKED_CATEGORY_KEYS = [
  CategoryKeys.INCOME_RECEIVABLE_COLLECTION,
  CategoryKeys.EXPENSE_RECEIVABLE_ISSUE,
  CategoryKeys.INCOME_PAYABLE_ISSUE,
  CategoryKeys.EXPENSE_PAYABLE_PAYMENT,
] as const

const LOCKED_CATEGORY_KEY_SET = new Set<string>(LOCKED_CATEGORY_KEYS)

export const MODULE_TRIGGERS: Record<CategoryKey, DerivedModule | null> = {
  [CategoryKeys.INCOME_SALARY]:     null,
  [CategoryKeys.INCOME_FREELANCE]:  null,
  [CategoryKeys.INCOME_INVESTMENT]: null,
  [CategoryKeys.INCOME_RENTAL]:     null,
  [CategoryKeys.INCOME_RECEIVABLE]: 'receivable',
  [CategoryKeys.INCOME_RECEIVABLE_COLLECTION]: 'receivable',
  [CategoryKeys.INCOME_PAYABLE_ISSUE]: 'payable',
  [CategoryKeys.INCOME_OTHER]:      null,
  [CategoryKeys.EXPENSE_FOOD]:      null,
  [CategoryKeys.EXPENSE_TRANSPORT]: null,
  [CategoryKeys.EXPENSE_HOUSING]:   null,
  [CategoryKeys.EXPENSE_HEALTH]:    null,
  [CategoryKeys.EXPENSE_EDUCATION]: null,
  [CategoryKeys.EXPENSE_LEISURE]:   null,
  [CategoryKeys.EXPENSE_ASSET]:     'asset',
  [CategoryKeys.EXPENSE_CREDIT]:    'credit',
  [CategoryKeys.EXPENSE_PAYABLE]:   'payable',
  [CategoryKeys.EXPENSE_RECEIVABLE_ISSUE]: 'receivable',
  [CategoryKeys.EXPENSE_PAYABLE_PAYMENT]: 'payable',
  [CategoryKeys.EXPENSE_OTHER]:     null,
}

/**
 * Dado un system_key, retorna el módulo derivado que activa (o null).
 * Acepta null/undefined para facilitar el uso con valores opcionales del form.
 */
export function getModuleTrigger(systemKey: string | null | undefined): DerivedModule | null {
  if (!systemKey) return null
  return MODULE_TRIGGERS[systemKey as CategoryKey] ?? null
}

export function isLockedCategorySystemKey(systemKey: string | null | undefined): boolean {
  if (!systemKey) return false
  return LOCKED_CATEGORY_KEY_SET.has(systemKey)
}
