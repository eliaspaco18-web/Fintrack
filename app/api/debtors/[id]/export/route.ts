import path from 'node:path'
import { promises as fs } from 'node:fs'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase.server'
import { getSessionUserId } from '@/lib/api/response'
import { buildDebtorReportPdf } from '@/modules/receivables/debtor-report-pdf'
import { readAllPages } from '@/modules/receivables/paged-read'
import { projectLegacyReceivableLinks } from '@/lib/server/receivable-read-model'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function readReportAssets() {
  try {
    const [logoSvg, regular, semibold, bold] = await Promise.all([
      fs.readFile(path.join(process.cwd(), 'public', 'brand', 'v3', 'ft-ligature-dark.svg')),
      fs.readFile(path.join(process.cwd(), 'public', 'fonts', 'v3', 'manrope-regular.ttf')),
      fs.readFile(path.join(process.cwd(), 'public', 'fonts', 'v3', 'manrope-semibold.ttf')),
      fs.readFile(path.join(process.cwd(), 'public', 'fonts', 'v3', 'manrope-bold.ttf')),
    ])
    return { logoSvg: new Uint8Array(logoSvg), fonts: { regular: new Uint8Array(regular), semibold: new Uint8Array(semibold), bold: new Uint8Array(bold) } }
  } catch {
    throw new Error('No se pudieron cargar los recursos de marca del reporte.')
  }
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const supabase = await createClient()
  const userId = await getSessionUserId(supabase)
  if (!userId) return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'No autorizado' } }, { status: 401 })

  const { data: debtor, error: debtorError } = await supabase
    .from('debtors')
    .select('id, name, relationship, initial_debt')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (debtorError) return NextResponse.json({ ok: false, error: { code: 'DATABASE_ERROR', message: 'No se pudo verificar el deudor.' } }, { status: 500 })
  if (!debtor) return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'No se encontró el deudor.' } }, { status: 404 })

  try {
    const [allDebtors, allReceivables, transactions] = await Promise.all([
      readAllPages((from, to) => supabase
        .from('debtors')
        .select('id, name')
        .eq('user_id', userId)
        .order('id', { ascending: true })
        .range(from, to)),
      readAllPages((from, to) => supabase
        .from('accounts_receivable')
        .select('id, transaction_id, debtor_id, debtor_name, concept, amount, collected_amount, currency, issue_date, status, notes, attachment_url, transaction:transactions(id, source_account:accounts!transactions_source_account_id_fkey(id, name))')
        .eq('user_id', userId)
        .order('id', { ascending: true })
        .range(from, to)),
      readAllPages((from, to) => supabase
        .from('transactions')
        .select('id, type, debtor_id, amount, currency, description, notes, transaction_date, source_account:accounts!transactions_source_account_id_fkey(id, name), category:categories(id, name)')
        .eq('user_id', userId)
        .eq('debtor_id', id)
        .in('type', ['INCOME', 'EXPENSE'])
        .order('transaction_date', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)),
    ])

    const projection = projectLegacyReceivableLinks(
      allDebtors,
      allReceivables,
      transactions.filter(transaction => transaction.type === 'EXPENSE'),
    )
    if (projection.coverage.ambiguousDebtorIds.has(id)) {
      return NextResponse.json({
        ok: false,
        error: {
          code: 'INCOMPLETE_HISTORY',
          message: 'No se puede generar un PDF íntegro: hay documentos heredados o vínculos repetidos que no se pueden asociar con certeza. Revisa el historial antes de exportar.',
        },
      }, { status: 409 })
    }
    const receivables = projection.byDebtor.get(id) ?? []
    const normalizedReceivables = receivables.map(row => {
      const transaction = Array.isArray(row.transaction) ? row.transaction[0] : row.transaction
      const sourceAccount = transaction?.source_account
      const account = Array.isArray(sourceAccount) ? sourceAccount[0] : sourceAccount
      return { ...row, source_account: account ? { id: account.id, name: account.name } : null }
    })
    const assets = await readReportAssets()
    const pdf = await buildDebtorReportPdf({
      debtor,
      receivables: normalizedReceivables,
      transactions: transactions as never,
      logoSvg: assets.logoSvg,
      fonts: assets.fonts,
      generatedAt: new Date(),
    })
    const safeName = debtor.name.normalize('NFKD').replace(/[^\p{L}\p{N}-]+/gu, '-').replace(/^-|-$/g, '').toLocaleLowerCase('es-PE') || 'deudor'
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="fintrack-deudor-${safeName}.pdf"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return NextResponse.json({ ok: false, error: { code: 'EXPORT_FAILED', message: 'No se pudo completar la exportación íntegra del historial.' } }, { status: 500 })
  }
}
