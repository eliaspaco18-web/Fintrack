// =============================================================================
// app/api/transactions/[id]/route.ts
// GET    /api/transactions/:id  — obtener una transacción
// PATCH  /api/transactions/:id  — actualizar movimiento completo
// DELETE /api/transactions/:id  — eliminar con desvinculación de módulos
// =============================================================================

import { NextRequest }                   from 'next/server'
import { createClient }                  from '@/lib/supabase.server'
import { TransactionService }            from '@/modules/transactions/transaction.service'
import { zUpdateTransactionSchema }      from '@/lib/schemas/transaction.schemas'
import {
  apiUnauthorized,
  apiZodError,
  apiOk,
  apiNoContent,
  fromResult,
  getSessionUserId,
}                                        from '@/lib/api/response'

type Params = { params: { id: string } }

// ─── GET /api/transactions/:id ────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  const service = new TransactionService(supabase)
  const result  = await service.getTransactionById(userId, params.id)
  return fromResult(result)
}

// ─── PATCH /api/transactions/:id ──────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  let body: unknown
  try { body = await req.json() }
  catch { return apiZodError({ issues: [{ path: [], message: 'Body JSON inválido', code: 'custom' }] } as never) }

  const parsed = zUpdateTransactionSchema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  const service = new TransactionService(supabase)
  const result  = await service.updateTransaction(userId, { id: params.id, ...parsed.data })
  return fromResult(result)
}

// ─── DELETE /api/transactions/:id ─────────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: Params) {
  const supabase = createClient()
  const userId   = await getSessionUserId(supabase)
  if (!userId) return apiUnauthorized()

  // Opción force via query param: DELETE /api/transactions/:id?force=true
  const force = req.nextUrl.searchParams.get('force') === 'true'

  const service = new TransactionService(supabase)
  const result  = await service.deleteTransaction(userId, params.id, { force })
  if (!result.ok) return fromResult(result)

  // 204 No Content en eliminación exitosa
  return apiNoContent()
}
