// =============================================================================
// lib/email/templates/auth-password-reset.ts
// Template claro para correo de recuperacion de contrasena.
// =============================================================================

export interface AuthPasswordResetEmailData {
  appUrl: string
  resetUrl: string
  expiresInMinutes?: number
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function buildAuthPasswordResetEmailSubject(): string {
  return 'Restablece tu contrasena de FinTrack'
}

export function buildAuthPasswordResetEmailHtml(data: AuthPasswordResetEmailData): string {
  const safeResetUrl = escapeHtml(data.resetUrl)
  const logoUrl = `${data.appUrl.replace(/\/+$/, '')}/brand/fintrack-mark.png`
  const safeLogoUrl = escapeHtml(logoUrl)
  const expiresIn = Number.isFinite(data.expiresInMinutes)
    ? Math.max(1, Math.floor(data.expiresInMinutes as number))
    : 60

  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Restablecer tu contrasena - FinTrack</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background-color: #f8fafc; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; -webkit-text-size-adjust: 100%; }
    a { color: inherit; text-decoration: none; }
    img { border: 0; display: block; }
  </style>
</head>
<body style="background-color:#f8fafc; margin:0; padding:0;">

  <div style="display:none;max-height:0;overflow:hidden;color:#f8fafc;font-size:1px;">
    Solicitaste restablecer tu contrasena de FinTrack. El enlace expira pronto.
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f8fafc; padding:34px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;">

          <tr>
            <td style="background-color:#075941; border-radius:18px 18px 0 0; padding:20px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:10px; vertical-align:middle;">
                    <img src="${safeLogoUrl}" alt="FinTrack" width="34" height="34" style="width:34px;height:34px;border-radius:10px;" />
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-size:19px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">FinTrack</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background-color:#ffffff; border:1px solid #e2e8f0; border-top:0; border-radius:0 0 18px 18px; overflow:hidden; box-shadow:0 10px 30px rgba(15,23,42,0.08);">

              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:30px 30px 0;">
                <tr>
                  <td>
                    <p style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.09em; color:#0f766e; margin-bottom:10px;">Seguridad de cuenta</p>
                    <h1 style="font-size:26px; font-weight:800; color:#0f172a; letter-spacing:-0.02em; line-height:1.2; margin-bottom:10px;">
                      Restablecer contrasena
                    </h1>
                    <p style="font-size:14px; color:#475569; line-height:1.6;">
                      Recibimos una solicitud para cambiar tu contrasena. Si fuiste tu, usa el boton de abajo para continuar.
                    </p>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:22px 30px 0;">
                <tr>
                  <td style="border:1px solid #dbe7f1; border-radius:12px; background:#f8fbff; padding:14px 16px;">
                    <p style="font-size:12px; font-weight:700; color:#075985; margin-bottom:4px;">Enlace seguro de un solo uso</p>
                    <p style="font-size:12px; color:#64748b; line-height:1.55;">
                      Este enlace expira en <strong style="color:#0f766e;">${expiresIn} minutos</strong> y se invalida despues de usarse.
                    </p>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:26px 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${safeResetUrl}"
                       style="display:inline-block;padding:14px 32px;background-color:#059669;color:#ffffff;font-size:14px;font-weight:700;letter-spacing:0.02em;border-radius:12px;box-shadow:0 6px 20px rgba(5,150,105,0.28);">
                      Restablecer mi contrasena ->
                    </a>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:24px 30px 0;">
                <tr>
                  <td style="border:1px solid #e2e8f0; border-radius:12px; background:#f8fafc; padding:14px 16px;">
                    <p style="font-size:12px; color:#64748b; margin-bottom:8px; line-height:1.5;">
                      Si el boton no funciona, copia y pega este enlace en tu navegador:
                    </p>
                    <p style="font-size:11px; color:#0f766e; word-break:break-all; line-height:1.55; font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">
                      ${safeResetUrl}
                    </p>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:20px 30px 0;">
                <tr>
                  <td style="border:1px solid #fecaca; border-radius:12px; background:#fef2f2; padding:14px 16px;">
                    <p style="font-size:12px; font-weight:700; color:#b91c1c; margin-bottom:4px;">No solicitaste este cambio?</p>
                    <p style="font-size:12px; color:#7f1d1d; line-height:1.55;">
                      Ignora este correo. Tu contrasena actual seguira activa. Si detectas actividad sospechosa, cambia tu clave y revisa sesiones activas.
                    </p>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:24px 30px 28px;">
                <tr>
                  <td style="border-top:1px solid #eef2f7; padding-top:16px; text-align:center;">
                    <p style="font-size:11px; color:#94a3b8; margin-bottom:4px;">&copy; 2026 FinTrack · Tus finanzas personales bajo control</p>
                    <p style="font-size:10px; color:#a8b4c2;">Este es un correo automatico. No respondas este mensaje.</p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
