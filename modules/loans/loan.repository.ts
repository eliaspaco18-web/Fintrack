// =============================================================================
// modules/loans/loan.repository.ts
// =============================================================================

import type {
  Loan,
  Installment,
  Credit,
  TablesInsert,
  TablesUpdate,
} from '@/types/database.types'
import { BaseRepository, type DbClient } from '@/modules/shared/repository.base'
import { type Result, Errors, ok }       from '@/modules/shared/result.types'

type LoanWithInstallments = Loan & {
  installments: Installment[]
  credit: Pick<Credit, 'id' | 'name' | 'credit_type'> | null
}

export class LoanRepository extends BaseRepository {
  constructor(db: DbClient) { super(db) }

  async findById(id: string): Promise<Result<Loan>> {
    return this.query(async () =>
      await this.db.from('loans').select('*').eq('id', id).single()
    )
  }

  async findWithInstallments(id: string): Promise<Result<LoanWithInstallments>> {
    return this.query(async () =>
      await this.db
        .from('loans')
        .select(`*, installments(*), credit:credits(id, name, credit_type)`)
        .eq('id', id)
        .single()
    )
  }

  async findAllByUser(userId: string): Promise<Result<Loan[]>> {
    return this.queryList(async () =>
      await this.db
        .from('loans')
        .select('*')
        .eq('user_id', userId)
        .order('start_date', { ascending: false })
    )
  }

  async create(data: TablesInsert<'loans'>): Promise<Result<Loan>> {
    return this.query(async () =>
      await this.db.from('loans').insert(data).select().single()
    )
  }

  async update(id: string, data: TablesUpdate<'loans'>): Promise<Result<Loan>> {
    return this.query(async () =>
      await this.db.from('loans').update(data).eq('id', id).select().single()
    )
  }

  async delete(id: string): Promise<Result<true>> {
    try {
      const { error } = await this.db.from('loans').delete().eq('id', id)
      if (error) return Errors.database(error.message)
      return ok(true)
    } catch (e) {
      return Errors.database(e instanceof Error ? e.message : 'Error desconocido')
    }
  }

  // ── INSTALLMENTS ────────────────────────────────────────────────────────────

  async findInstallmentsByLoan(loanId: string): Promise<Result<Installment[]>> {
    return this.queryList(async () =>
      await this.db
        .from('installments')
        .select('*')
        .eq('loan_id', loanId)
        .order('installment_number')
    )
  }

  async findOverdueInstallments(userId: string): Promise<Result<Installment[]>> {
    return this.queryList(async () =>
      await this.db
        .from('installments')
        .select('*, loan:loans!inner(user_id, creditor_name, currency)')
        .eq('loan.user_id', userId)
        .in('status', ['PENDING', 'PARTIAL'])
        .lt('due_date', new Date().toISOString().split('T')[0])
        .order('due_date')
    )
  }

  async createInstallments(
    installments: TablesInsert<'installments'>[]
  ): Promise<Result<Installment[]>> {
    return this.queryList(async () =>
      await this.db.from('installments').insert(installments).select()
    )
  }

  /**
   * Genera el cronograma de cuotas usando el método francés (cuota fija).
   * Retorna los InstalmentInsert listos para persistir, sin ejecutar la query.
   */
  static buildInstallmentSchedule(params: {
    loanId:            string
    principalAmount:   number
    interestRate:      number   // tasa mensual expresada como 0.05 = 5%
    totalInstallments: number
    startDate:         string   // 'YYYY-MM-DD'
  }): TablesInsert<'installments'>[] {
    const { loanId, principalAmount, interestRate, totalInstallments, startDate } = params
    const schedule: TablesInsert<'installments'>[] = []

    // Cuota fija mensual (método francés)
    const monthlyRate = interestRate / 100

    // Si la tasa es 0, es un préstamo sin interés
    const fixedPayment = monthlyRate === 0
      ? principalAmount / totalInstallments
      : (principalAmount * monthlyRate * Math.pow(1 + monthlyRate, totalInstallments))
        / (Math.pow(1 + monthlyRate, totalInstallments) - 1)

    let remainingPrincipal = principalAmount
    const baseDate = new Date(startDate)

    for (let i = 1; i <= totalInstallments; i++) {
      const interestAmount  = Math.round(remainingPrincipal * monthlyRate * 100) / 100
      const principalPayment = Math.round((fixedPayment - interestAmount) * 100) / 100

      // Ajuste en la última cuota para eliminar centavos de redondeo
      const isLast            = i === totalInstallments
      const adjustedPrincipal = isLast
        ? Math.round(remainingPrincipal * 100) / 100
        : principalPayment

      const dueDate = new Date(baseDate)
      dueDate.setMonth(dueDate.getMonth() + i)

      schedule.push({
        loan_id:            loanId,
        transaction_id:     null,
        installment_number: i,
        principal_amount:   adjustedPrincipal,
        interest_amount:    interestAmount,
        total_amount:       Math.round((adjustedPrincipal + interestAmount) * 100) / 100,
        due_date:           dueDate.toISOString().split('T')[0] ?? '',
        paid_date:          null,
        paid_amount:        null,
        status:             'PENDING',
      })

      remainingPrincipal -= adjustedPrincipal
    }

    return schedule
  }
}
