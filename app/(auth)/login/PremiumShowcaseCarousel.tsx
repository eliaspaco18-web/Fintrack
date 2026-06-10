// =============================================================================
// app/(auth)/login/PremiumShowcaseCarousel.tsx
// Panel editorial de prueba de producto para la experiencia de acceso.
// =============================================================================

interface ProofMetric {
  label: string
  value: string
  detail: string
}

interface LedgerRow {
  name: string
  type: string
  amount: string
  tone: 'positive' | 'neutral' | 'warning'
}

const PROOF_METRICS: ProofMetric[] = [
  { label: 'Liquidez disponible', value: 'S/ 248.4k', detail: '+4.8% esta semana' },
  { label: 'Cobros pendientes', value: '12 cuentas', detail: '3 vencen hoy' },
  { label: 'Alertas críticas', value: '02', detail: 'prioridad operativa' },
]

const LEDGER_ROWS: LedgerRow[] = [
  { name: 'Caja operativa', type: 'Saldo principal', amount: 'S/ 96.2k', tone: 'positive' },
  { name: 'Ingresos esperados', type: 'Próximos 7 días', amount: 'S/ 41.8k', tone: 'neutral' },
  { name: 'Pagos por aprobar', type: 'Flujo pendiente', amount: 'S/ 19.6k', tone: 'warning' },
]

const OPERATING_PILLARS = [
  'Dashboard con foco en caja, riesgo y movimientos.',
  'Autenticación alineada con una experiencia sobria y verificable.',
  'Base lista para equipos, cuentas y alertas desde el primer ingreso.',
]

function ProofIcon({ tone }: { tone: LedgerRow['tone'] }) {
  return (
    <span className="fin-auth-proof-icon" data-tone={tone} aria-hidden>
      <svg viewBox="0 0 20 20" fill="none">
        <path
          d="M4.5 10.5L8 14l7.5-8"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

export function PremiumShowcaseCarousel() {
  return (
    <aside className="fin-auth-showcase" aria-label="Vista previa operativa de FinTrack">
      <div className="fin-auth-showcase-shell">
        <div className="fin-auth-showcase-header">
          <p className="fin-auth-showcase-kicker">Vista previa del producto</p>
          <h2 className="fin-auth-showcase-title">
            Una entrada alineada con la plataforma que verás adentro.
          </h2>
          <p className="fin-auth-showcase-copy">
            Menos espectáculo, más contexto: una prueba visual de caja, seguimiento y
            prioridades para que el acceso ya se sienta parte del mismo sistema.
          </p>
        </div>

        <div className="fin-auth-proof-shell">
          <div className="fin-auth-proof-summary">
            {PROOF_METRICS.map(metric => (
              <article key={metric.label} className="fin-auth-proof-stat">
                <p className="fin-auth-proof-label">{metric.label}</p>
                <p className="fin-auth-proof-value">{metric.value}</p>
                <p className="fin-auth-proof-detail">{metric.detail}</p>
              </article>
            ))}
          </div>

          <div className="fin-auth-proof-body">
            <section className="fin-auth-proof-ledger" aria-label="Resumen operativo">
              <div className="fin-auth-proof-section-head">
                <p className="fin-auth-proof-section-kicker">Operación de hoy</p>
                <p className="fin-auth-proof-section-title">Prioridades visibles antes de entrar</p>
              </div>

              <div className="fin-auth-proof-ledger-list">
                {LEDGER_ROWS.map(row => (
                  <article key={row.name} className="fin-auth-proof-ledger-row">
                    <div className="fin-auth-proof-ledger-meta">
                      <ProofIcon tone={row.tone} />
                      <div>
                        <p className="fin-auth-proof-ledger-name">{row.name}</p>
                        <p className="fin-auth-proof-ledger-type">{row.type}</p>
                      </div>
                    </div>
                    <p className="fin-auth-proof-amount">{row.amount}</p>
                  </article>
                ))}
              </div>
            </section>

            <aside className="fin-auth-proof-side">
              <section className="fin-auth-proof-signal">
                <p className="fin-auth-proof-section-kicker">Señal principal</p>
                <p className="fin-auth-proof-signal-value">Riesgo controlado</p>
                <p className="fin-auth-proof-signal-copy">
                  El sistema prioriza lo que exige acción inmediata sin recargar la entrada.
                </p>
              </section>

              <section className="fin-auth-proof-pillars">
                <p className="fin-auth-proof-section-kicker">Qué obtienes</p>
                <ul className="fin-auth-proof-list">
                  {OPERATING_PILLARS.map(item => (
                    <li key={item} className="fin-auth-proof-list-item">
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            </aside>
          </div>
        </div>

        <p className="fin-auth-proof-footnote">
          Diseñado para que el primer contacto con FinTrack ya comunique calma,
          trazabilidad y control financiero.
        </p>
      </div>
    </aside>
  )
}
