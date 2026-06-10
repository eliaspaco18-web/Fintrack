// =============================================================================
// lib/email/templates/transaction-notification.ts
// Template inspirado en el estilo bancario BCP:
// mensaje amigable · filas de datos limpias · número de operación
// =============================================================================

type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER'

interface TransactionEmailData {
  userName:               string
  userEmail:              string
  transactionId:          string
  type:                   TransactionType
  amount:                 number
  currency:               'PEN' | 'USD'
  exchangeRate?:          number
  description:            string
  transactionDate:        string   // YYYY-MM-DD
  transactionTime?:       string   // HH:MM (optional)
  accountName:            string
  destinationAccountName?: string
  categoryName?:          string
  notes?:                 string
  appUrl:                 string
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-PE', {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
  })
}

export function generateOpNumber(uuid: string): string {
  const hex     = uuid.replace(/-/g, '')
  const encode  = (h: string) =>
    parseInt(h, 16).toString(36).toUpperCase().padStart(3, '0').slice(-3)
  const a = encode(hex.slice(0, 4))
  const b = encode(hex.slice(8, 12))
  const c = encode(hex.slice(16, 20))
  const d = encode(hex.slice(24, 28))
  return `FT-${a}${b}-${c}${d}`
}

// ─── Type config ─────────────────────────────────────────────────────────────

const TYPE_CFG = {
  INCOME: {
    label:      'ingreso',
    labelCap:   'Ingreso',
    verb:       'recibiste un ingreso',
    sign:       '+',
    accentBg:   '#065f46',         // dark green header
    accentLine: '#10b981',
    amountColor:'#065f46',
    sectionColor:'#065f46',
    chipBg:     '#d1fae5',
    chipText:   '#064e3b',
    btnBg:      '#059669',
    btnShadow:  'rgba(5,150,105,0.35)',
  },
  EXPENSE: {
    label:      'gasto',
    labelCap:   'Gasto',
    verb:       'realizaste un gasto',
    sign:       '-',
    accentBg:   '#7f1d1d',
    accentLine: '#ef4444',
    amountColor:'#991b1b',
    sectionColor:'#991b1b',
    chipBg:     '#fee2e2',
    chipText:   '#7f1d1d',
    btnBg:      '#dc2626',
    btnShadow:  'rgba(220,38,38,0.35)',
  },
  TRANSFER: {
    label:      'transferencia',
    labelCap:   'Transferencia',
    verb:       'realizaste una transferencia',
    sign:       '',
    accentBg:   '#1e3a8a',
    accentLine: '#3b82f6',
    amountColor:'#1d4ed8',
    sectionColor:'#1d4ed8',
    chipBg:     '#dbeafe',
    chipText:   '#1e3a8a',
    btnBg:      '#2563eb',
    btnShadow:  'rgba(37,99,235,0.35)',
  },
} as const

// ─── Row: full-width label left / value right ────────────────────────────────

function row(label: string, value: string, isLast = false): string {
  return `
  <tr>
    <td style="
      padding: 13px 24px;
      border-bottom: ${isLast ? 'none' : '1px solid #f1f5f9'};
    ">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td style="font-size:13px; color:#64748b;">${label}</td>
          <td style="font-size:13px; color:#111827; font-weight:600; text-align:right;">${value}</td>
        </tr>
      </table>
    </td>
  </tr>`
}

// ─── Main builder ─────────────────────────────────────────────────────────────

export function buildTransactionEmailHtml(data: TransactionEmailData): string {
  const cfg        = TYPE_CFG[data.type]
  const opNumber   = generateOpNumber(data.transactionId)
  const amountFmt  = formatCurrency(data.amount, data.currency)
  const dateFmt    = formatDate(data.transactionDate)
  const displayName = data.userName || data.userEmail.split('@')[0] || 'Usuario'
  const safeAppUrl = data.appUrl.replace(/\/+$/, '')
  const txLink     = `${safeAppUrl}/transactions?highlight=${data.transactionId}`
  const logoUrl    = `${safeAppUrl}/brand/fintrack-mark.png`

  // Friendly opening sentence
  const accountRef = data.type === 'TRANSFER' && data.destinationAccountName
    ? `de <strong>${data.accountName}</strong> hacia <strong>${data.destinationAccountName}</strong>`
    : `en <strong>${data.accountName}</strong>`

  const openingSentence = data.type === 'INCOME'
    ? `Recibiste un ingreso de <strong style="color:${cfg.amountColor};">${amountFmt}</strong> en <strong>${data.accountName}</strong>.`
    : data.type === 'EXPENSE'
    ? `Realizaste un gasto de <strong style="color:${cfg.amountColor};">${amountFmt}</strong> en <strong>${data.accountName}</strong>.`
    : `Realizaste una transferencia de <strong style="color:${cfg.amountColor};">${amountFmt}</strong> ${accountRef}.`

  const tcRow = data.currency === 'USD' && data.exchangeRate
    ? row('Equivalente en soles', `≈ ${formatCurrency(data.amount * data.exchangeRate, 'PEN')} (T/C ${data.exchangeRate.toFixed(3)})`)
    : ''

  const categoryRow = data.categoryName
    ? row('Categoría', data.categoryName)
    : ''

  const notesRow = data.notes
    ? row('Notas', data.notes)
    : ''

  const destRow = data.type === 'TRANSFER' && data.destinationAccountName
    ? row('Cuenta destino', data.destinationAccountName)
    : ''

  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${cfg.labelCap} registrado — FinTrack</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    *  { box-sizing:border-box; margin:0; padding:0; }
    body { background-color:#f8fafc; font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
    a  { text-decoration:none; }
  </style>
</head>
<body style="background-color:#f8fafc; margin:0; padding:0;">

  <!-- Preheader -->
  <div style="display:none;max-height:0;overflow:hidden;color:#f8fafc;font-size:1px;">
    ${cfg.sign}${amountFmt} · ${data.description} · ${dateFmt}
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f8fafc; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:580px;">

          <!-- ── LOGO HEADER BAR ── -->
          <tr>
            <td style="
              background-color:${cfg.accentBg};
              border-radius:16px 16px 0 0;
              padding:20px 28px;
            ">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:10px; vertical-align:middle;">
                    <img src="${logoUrl}" alt="FinTrack" width="36" height="36"
                      style="width:36px;height:36px;border-radius:10px;display:block;"/>
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-size:18px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">FinTrack</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── MAIN CARD ── -->
          <tr>
            <td style="background-color:#ffffff; border-radius:0 0 16px 16px; border:1px solid #e2e8f0; border-top:none; overflow:hidden; box-shadow:0 8px 32px rgba(0,0,0,0.07);">

              <!-- Greeting + opening sentence -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:28px 28px 0;">
                <tr>
                  <td>
                    <p style="font-size:15px;color:#374151;margin-bottom:10px;">Hola <strong>${displayName}</strong>,</p>
                    <p style="font-size:16px;color:#111827;line-height:1.55;margin-bottom:6px;">
                      ${openingSentence}
                    </p>
                    <p style="font-size:13px;color:#64748b;line-height:1.5;">
                      Por tu seguridad, te enviamos los datos de tu operación.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:20px 28px 0;">
                <tr><td style="height:1px; background-color:#f1f5f9;"></td></tr>
              </table>

              <!-- ── Monto section ── -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:20px 28px 0;">
                <tr>
                  <td>
                    <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:${cfg.sectionColor};margin-bottom:10px;">Monto</p>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
                      style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:10px;">
                      <tbody>
                        <tr>
                          <td style="padding:14px 24px; border-bottom: ${tcRow ? '1px solid #f1f5f9' : 'none'};">
                            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                              <tr>
                                <td style="font-size:13px;color:#64748b;">Total del ${cfg.label}</td>
                                <td style="font-size:15px;color:${cfg.amountColor};font-weight:800;text-align:right;">${cfg.sign}${amountFmt}</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        ${tcRow ? `<tr><td style="padding:14px 24px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td style="font-size:13px;color:#64748b;">Equivalente en soles</td>
                              <td style="font-size:13px;color:#111827;font-weight:600;text-align:right;">≈ ${formatCurrency(data.amount * (data.exchangeRate ?? 1), 'PEN')} (T/C ${(data.exchangeRate ?? 1).toFixed(3)})</td>
                            </tr>
                          </table>
                        </td></tr>` : ''}
                      </tbody>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- ── Datos de la operación section ── -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:20px 28px 0;">
                <tr>
                  <td>
                    <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:${cfg.sectionColor};margin-bottom:10px;">Datos de la operación</p>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
                      style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; overflow:hidden;">
                      <tbody>
                        ${row('Tipo de operación', cfg.labelCap)}
                        ${row('Descripción', data.description)}
                        ${row('Fecha', dateFmt)}
                        ${row('Cuenta', data.accountName)}
                        ${destRow}
                        ${categoryRow}
                        ${notesRow}
                        ${row('Moneda', data.currency)}
                        ${row('N° de operación', `<span style="font-family:monospace;letter-spacing:0.06em;">${opNumber}</span>`, true)}
                      </tbody>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- ── CTA button ── -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:24px 28px;">
                <tr>
                  <td align="center">
                    <a href="${txLink}"
                       style="display:inline-block;padding:13px 30px;background-color:${cfg.btnBg};color:#ffffff;font-size:13px;font-weight:700;letter-spacing:0.02em;border-radius:10px;box-shadow:0 4px 16px ${cfg.btnShadow};">
                      Ver movimiento en FinTrack →
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- ── FOOTER ── -->
          <tr>
            <td style="padding:22px 0; text-align:center;">
              <p style="font-size:11px;color:#94a3b8;margin-bottom:4px;">
                © 2026 FinTrack · Tus finanzas personales bajo control
              </p>
              <p style="font-size:11px;color:#cbd5e1;">
                Ref: <span style="font-family:monospace;">${opNumber}</span> · Recibes este correo porque tienes activas las alertas de transacciones.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ─── Subject (sin número de operación) ───────────────────────────────────────

export function buildTransactionEmailSubject(data: TransactionEmailData): string {
  const cfg    = TYPE_CFG[data.type]
  const amount = formatCurrency(data.amount, data.currency)
  return `${cfg.labelCap} registrado: ${cfg.sign}${amount} — ${data.description}`
}

export type { TransactionEmailData }
