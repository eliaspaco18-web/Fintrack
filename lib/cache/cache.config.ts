// =============================================================================
// lib/cache/cache.config.ts
// Estrategia de caché centralizada para toda la aplicación.
// REGLA: cada entidad tiene un tag. Las mutaciones invalidan los tags afectados.
// =============================================================================

// ─── TAGS DE CACHÉ ────────────────────────────────────────────────────────────
// Un tag por entidad + tags compuestos para invalidación granular.

export const CacheTags = {
  // Entidades base
  dashboard:     'dashboard',
  transactions:  'transactions',
  accounts:      'accounts',
  categories:    'categories',
  budgets:       'budgets',
  assets:        'assets',
  credits:       'credits',
  loans:         'loans',
  receivables:   'receivables',
  payables:      'payables',
  goals:         'goals',
  exchangeRate:  'exchange-rate',

  // Tags por usuario (para invalidación específica)
  userDashboard:    (userId: string) => `dashboard:${userId}`,
  userTransactions: (userId: string) => `transactions:${userId}`,
  userAccounts:     (userId: string) => `accounts:${userId}`,
  singleTx:         (id: string)     => `tx:${id}`,
} as const

// ─── TTL POR TIPO DE DATO ─────────────────────────────────────────────────────
// En segundos. Guía al sistema de caché de Next.js y a SWR en el cliente.

export const CacheTTL = {
  // Datos que cambian con cada transacción
  dashboard:    60,          // 1 min — revalidado en cada mutación de todos modos
  transactions: 30,          // 30 seg — lista puede recibir nuevas entradas
  accounts:     120,         // 2 min — saldo cambia solo con transacciones

  // Datos más estables
  categories:   3600,        // 1 hora — raramente cambian
  credits:      300,         // 5 min
  assets:       300,
  budgets:      300,
  receivables:  120,
  payables:     120,
  goals:        300,

  // Datos externos
  exchangeRate: 3600,        // 1 hora — cacheado también en BD
} as const

// ─── MAPA DE INVALIDACIÓN POR MUTACIÓN ───────────────────────────────────────
// Qué tags invalidar cuando se ejecuta cada tipo de operación.
// Principio: invalidar TODOS los tags que podrían quedar desactualizados.

export const InvalidationMap = {
  createTransaction: [
    CacheTags.dashboard,
    CacheTags.transactions,
    CacheTags.accounts,
  ],
  updateTransaction: [
    CacheTags.dashboard,
    CacheTags.transactions,
  ],
  deleteTransaction: [
    CacheTags.dashboard,
    CacheTags.transactions,
    CacheTags.accounts,
    CacheTags.assets,
    CacheTags.credits,
    CacheTags.receivables,
    CacheTags.payables,
  ],
  createAsset:      [CacheTags.dashboard, CacheTags.assets],
  updateAsset:      [CacheTags.dashboard, CacheTags.assets],
  createCredit:     [CacheTags.dashboard, CacheTags.credits],
  updateCredit:     [CacheTags.dashboard, CacheTags.credits],
  payInstallment:   [CacheTags.dashboard, CacheTags.loans],
  collectReceivable:[CacheTags.dashboard, CacheTags.receivables, CacheTags.accounts],
  payPayable:       [CacheTags.dashboard, CacheTags.payables,    CacheTags.accounts],
  updateAccount:    [CacheTags.dashboard, CacheTags.accounts],
} as const

// ─── PATHS DE REVALIDACIÓN ────────────────────────────────────────────────────
// Qué rutas revalidar con revalidatePath() tras cada mutación.
// Se usa en Server Actions (además de revalidateTag).

export const RevalidationPaths = {
  createTransaction: ['/dashboard', '/transactions'],
  updateTransaction: ['/dashboard', '/transactions'],
  deleteTransaction: ['/dashboard', '/transactions', '/assets', '/credits', '/receivables', '/payables'],
  createAsset:       ['/dashboard', '/assets'],
  createCredit:      ['/dashboard', '/credits'],
  payInstallment:    ['/dashboard', '/credits'],
  collectReceivable: ['/dashboard', '/receivables'],
  payPayable:        ['/dashboard', '/payables'],
} as const

// ─── HELPER: revalidar por mutación ──────────────────────────────────────────
// Importar en Server Actions para centralizar la lógica de invalidación.

import { revalidatePath, revalidateTag } from 'next/cache'

type MutationKey = keyof typeof InvalidationMap

export function revalidateAfterMutation(
  mutation: MutationKey,
  extraPaths: string[] = []
): void {
  // Invalidar tags del Data Cache de Next.js
  for (const tag of InvalidationMap[mutation]) {
    revalidateTag(tag)
  }

  // Revalidar rutas del Full Route Cache
  const paths = [
    ...(RevalidationPaths[mutation as keyof typeof RevalidationPaths] ?? []),
    ...extraPaths,
  ]
  for (const path of paths) {
    revalidatePath(path)
  }
}
