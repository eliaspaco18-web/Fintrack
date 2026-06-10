// =============================================================================
// lib/email/templates/auth-welcome.ts
// Template de bienvenida para nuevos registros en FinTrack.
// =============================================================================

export interface WelcomeAuthEmailData {
  fullName: string
  accountType: 'PERSONAL' | 'BUSINESS'
  defaultCurrency: 'PEN' | 'USD'
  country: string
  appUrl: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function countryLabel(code: string): string {
  const map: Record<string, string> = {
    PE: 'Perú',
    CO: 'Colombia',
    CL: 'Chile',
    MX: 'México',
    US: 'Estados Unidos',
    ES: 'España',
  }

  return map[code] ?? code
}

export function buildWelcomeAuthEmailSubject(): string {
  return 'Bienvenido a FinTrack · Tu acceso está casi listo'
}

export function buildWelcomeAuthEmailHtml(data: WelcomeAuthEmailData): string {
  const safeName = escapeHtml(data.fullName || 'Usuario')
  const safeCountry = escapeHtml(countryLabel(data.country))
  const safeCurrency = escapeHtml(data.defaultCurrency)
  const safeType = data.accountType === 'BUSINESS' ? 'Empresa / equipo' : 'Personal'
  const safeAppUrl = data.appUrl.replace(/\/+$/, '')
  const securityUrl = `${safeAppUrl}/settings?tab=security`
  const logoUrl = `${safeAppUrl}/brand/fintrack-mark.png`
  const safeLogoUrl = escapeHtml(logoUrl)

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bienvenido a FinTrack</title>
</head>
<body style="margin:0; padding:0; background:#f1f5f9; font-family: Inter, Segoe UI, Arial, sans-serif; color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px; background:#f1f5f9;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;">
          <tr>
            <td style="background:linear-gradient(135deg, #054d38 0%, #0a7b58 100%); color:#ffffff; border-radius:16px 16px 0 0; padding:24px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:10px; vertical-align:middle;">
                    <img src="${safeLogoUrl}" alt="FinTrack" width="34" height="34" style="width:34px;height:34px;border-radius:10px;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <p style="margin:0; font-size:12px; letter-spacing:0.12em; text-transform:uppercase; opacity:0.85;">FinTrack</p>
                  </td>
                </tr>
              </table>
              <h1 style="margin:10px 0 0; font-size:24px; line-height:1.2;">Bienvenido, ${safeName}</h1>
              <p style="margin:8px 0 0; font-size:14px; line-height:1.5; opacity:0.94;">
                Tu cuenta fue creada correctamente. Solo falta validar tu correo para activar el acceso completo.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background:#ffffff; border:1px solid #dbe3ea; border-top:0; border-radius:0 0 16px 16px; padding:24px 28px;">
              <p style="margin:0 0 14px; font-size:14px; color:#334155; line-height:1.6;">
                Este registro se configuró con las siguientes preferencias iniciales:
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0; border-radius:12px; overflow:hidden;">
                <tr>
                  <td style="padding:12px 14px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#475569;">Tipo de cuenta</td>
                  <td style="padding:12px 14px; border-bottom:1px solid #e2e8f0; font-size:13px; font-weight:600; text-align:right;">${safeType}</td>
                </tr>
                <tr>
                  <td style="padding:12px 14px; border-bottom:1px solid #e2e8f0; font-size:13px; color:#475569;">Moneda base</td>
                  <td style="padding:12px 14px; border-bottom:1px solid #e2e8f0; font-size:13px; font-weight:600; text-align:right;">${safeCurrency}</td>
                </tr>
                <tr>
                  <td style="padding:12px 14px; font-size:13px; color:#475569;">País</td>
                  <td style="padding:12px 14px; font-size:13px; font-weight:600; text-align:right;">${safeCountry}</td>
                </tr>
              </table>

              <div style="margin-top:18px; padding:14px 16px; border-radius:12px; background:#f8fafc; border:1px solid #e2e8f0;">
                <p style="margin:0 0 8px; font-size:12px; letter-spacing:0.08em; text-transform:uppercase; color:#0f766e; font-weight:700;">
                  Recomendado
                </p>
                <p style="margin:0; font-size:13px; color:#334155; line-height:1.55;">
                  Después de validar tu correo, revisa la sección de seguridad para actualizar contraseña, sesiones activas y alertas.
                </p>
              </div>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
                <tr>
                  <td align="center">
                    <a href="${securityUrl}"
                       style="display:inline-block; padding:12px 24px; border-radius:10px; background:#0a7b58; color:#ffffff; font-size:13px; font-weight:700; text-decoration:none;">
                      Revisar seguridad de la cuenta
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:20px 0 0; font-size:12px; line-height:1.5; color:#64748b;">
                Si no reconoces este registro, ignora este correo y contacta soporte.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:16px 6px 0; text-align:center; font-size:11px; color:#94a3b8;">
              © 2026 FinTrack · Tus finanzas personales bajo control
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
