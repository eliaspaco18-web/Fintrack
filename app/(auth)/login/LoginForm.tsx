'use client'

// =============================================================================
// app/(auth)/login/LoginForm.tsx
// Login, registro y recuperación de contraseña para FinTrack.
// =============================================================================

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase.client'

export type AuthMode = 'login' | 'signup' | 'recovery'

export interface AuthNotice {
  kind: 'success' | 'error' | 'info'
  message: string
}

interface LoginFormProps {
  initialMode?: AuthMode
  nextPath?: string
  initialNotice?: AuthNotice | null
}

interface PasswordRule {
  label: string
  passed: boolean
}

interface PasswordStrength {
  score: number
  label: string
  rules: PasswordRule[]
}

type CurrencyCode = 'PEN' | 'USD'
type AccountType = 'PERSONAL' | 'BUSINESS'

const REMEMBER_EMAIL_KEY = 'fintrack.auth.remember-email.v1'
const WELCOME_KEY = 'fintrack.welcome.v1'

const COUNTRY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'PE', label: 'Perú' },
  { value: 'CO', label: 'Colombia' },
  { value: 'CL', label: 'Chile' },
  { value: 'MX', label: 'México' },
  { value: 'US', label: 'Estados Unidos' },
  { value: 'ES', label: 'España' },
]

const MODE_DETAILS: Record<AuthMode, { title: string; description: string }> = {
  login: {
    title: 'Entrar a tu espacio',
    description: 'Accede a tus saldos, movimientos y alertas con un flujo directo y verificable.',
  },
  signup: {
    title: 'Crear una cuenta nueva',
    description: 'Configura tu base operativa desde el primer día con país, moneda y tipo de cuenta.',
  },
  recovery: {
    title: 'Recuperar el acceso',
    description: 'Solicita un enlace seguro para restablecer tu contraseña sin interrumpir tu operación.',
  },
}

function sanitizeRelativePath(value: string | undefined): string {
  if (!value) return '/dashboard'
  if (!value.startsWith('/')) return '/dashboard'
  if (value.startsWith('//')) return '/dashboard'
  return value
}

function normalizeDisplayName(raw: string | null | undefined): string {
  const clean = (raw ?? '').trim()
  if (!clean) return 'Usuario'

  if (clean.includes('@')) return 'Usuario'

  const formatted = clean
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return formatted.length > 0 ? formatted : 'Usuario'
}

function getPasswordStrength(password: string): PasswordStrength {
  const rules: PasswordRule[] = [
    { label: '8+ caracteres', passed: password.length >= 8 },
    { label: 'Al menos una mayúscula', passed: /[A-Z]/.test(password) },
    { label: 'Al menos un número', passed: /\d/.test(password) },
    { label: 'Al menos un símbolo', passed: /[^A-Za-z0-9]/.test(password) },
  ]

  const score = rules.reduce((total, rule) => total + (rule.passed ? 1 : 0), 0)

  if (score <= 1) {
    return { score, label: 'Débil', rules }
  }
  if (score === 2) {
    return { score, label: 'Aceptable', rules }
  }
  if (score === 3) {
    return { score, label: 'Fuerte', rules }
  }

  return { score, label: 'Muy fuerte', rules }
}

function mapAuthError(message: string): string {
  const normalized = message.toLowerCase()

  if (normalized.includes('invalid login credentials')) {
    return 'Correo o contraseña inválidos.'
  }
  if (normalized.includes('email not confirmed')) {
    return 'Debes verificar tu correo antes de ingresar.'
  }
  if (normalized.includes('user already registered')) {
    return 'Este correo ya está registrado. Inicia sesión o recupera tu contraseña.'
  }
  if (normalized.includes('password')) {
    return 'La contraseña no cumple con la política de seguridad.'
  }

  return 'No se pudo completar la operación. Intenta nuevamente.'
}

export function LoginForm({
  initialMode = 'login',
  nextPath,
  initialNotice = null,
}: LoginFormProps) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const resolvedNextPath = useMemo(() => sanitizeRelativePath(nextPath), [nextPath])

  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [notice, setNotice] = useState<AuthNotice | null>(initialNotice)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [loginData, setLoginData] = useState({ email: '', password: '' })
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [rememberEmail, setRememberEmail] = useState(true)

  const [signupData, setSignupData] = useState({
    fullName: '',
    email: '',
    phone: '',
    country: 'PE',
    defaultCurrency: 'PEN' as CurrencyCode,
    accountType: 'PERSONAL' as AccountType,
    password: '',
    confirmPassword: '',
    acceptsTerms: false,
    acceptsPrivacy: false,
    marketingOptIn: false,
  })
  const [showSignUpPassword, setShowSignUpPassword] = useState(false)
  const [showSignUpConfirmPassword, setShowSignUpConfirmPassword] = useState(false)

  const [recoveryEmail, setRecoveryEmail] = useState('')

  const signupPasswordStrength = useMemo(
    () => getPasswordStrength(signupData.password),
    [signupData.password]
  )

  useEffect(() => {
    setMode(initialMode)
  }, [initialMode])

  useEffect(() => {
    setNotice(initialNotice)
  }, [initialNotice])

  useEffect(() => {
    try {
      const remembered = window.localStorage.getItem(REMEMBER_EMAIL_KEY)
      if (!remembered) return

      setLoginData(prev => ({ ...prev, email: remembered }))
      setRecoveryEmail(remembered)
      setRememberEmail(true)
    } catch {
      // localStorage puede no estar disponible en algunos contextos.
    }
  }, [])

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode)
    setNotice(null)

    if (nextMode === 'recovery' && loginData.email.trim()) {
      setRecoveryEmail(loginData.email.trim())
    }

    if (nextMode === 'login' && recoveryEmail.trim()) {
      setLoginData(prev => ({ ...prev, email: recoveryEmail.trim() }))
    }
  }

  function persistRememberedEmail(email: string) {
    try {
      if (rememberEmail) {
        window.localStorage.setItem(REMEMBER_EMAIL_KEY, email)
      } else {
        window.localStorage.removeItem(REMEMBER_EMAIL_KEY)
      }
    } catch {
      // Ignoramos errores de almacenamiento local.
    }
  }

  async function persistWelcomeName(candidateName: string | null | undefined) {
    try {
      const displayName = normalizeDisplayName(candidateName)
      window.sessionStorage.setItem(
        WELCOME_KEY,
        JSON.stringify({
          name: displayName,
          at: Date.now(),
        })
      )
    } catch {
      // sessionStorage puede estar restringido; no bloqueamos el flujo.
    }
  }

  async function triggerWelcomeEmail(input: {
    email: string
    fullName: string
    country: string
    defaultCurrency: CurrencyCode
    accountType: AccountType
  }) {
    try {
      await fetch('/api/auth/welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
    } catch {
      // El email de bienvenida es complementario; no bloquea el registro.
    }
  }

  async function handleLoginSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice(null)

    const email = loginData.email.trim().toLowerCase()
    if (!email || !loginData.password) {
      setNotice({ kind: 'error', message: 'Completa correo y contraseña para ingresar.' })
      return
    }

    setIsSubmitting(true)

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: loginData.password,
    })

    if (authError) {
      setNotice({ kind: 'error', message: mapAuthError(authError.message) })
      setIsSubmitting(false)
      return
    }

    persistRememberedEmail(email)

    let profileName: string | null = null
    try {
      const profileRes = await fetch('/api/profile', { cache: 'no-store' })
      const profileJson = await profileRes.json().catch(() => null)
      if (profileRes.ok && profileJson?.ok) {
        const candidate = profileJson.data?.full_name
        if (typeof candidate === 'string' && candidate.trim().length > 0) {
          profileName = candidate
        }
      }
    } catch {
      // Si falla perfil, usamos metadata del usuario.
    }

    const metadataName =
      typeof authData?.user?.user_metadata?.full_name === 'string'
        ? authData.user.user_metadata.full_name
        : null

    await persistWelcomeName(profileName ?? metadataName)

    router.push(resolvedNextPath)
    router.refresh()
  }

  async function handleSignUpSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice(null)

    const fullName = signupData.fullName.trim()
    const email = signupData.email.trim().toLowerCase()
    const phone = signupData.phone.trim()

    if (!fullName || fullName.length < 2) {
      setNotice({ kind: 'error', message: 'Ingresa tu nombre completo.' })
      return
    }

    if (!email) {
      setNotice({ kind: 'error', message: 'Ingresa un correo corporativo o personal válido.' })
      return
    }

    if (phone && !/^\+?[0-9()\-\s]{7,20}$/.test(phone)) {
      setNotice({ kind: 'error', message: 'El teléfono no tiene un formato válido.' })
      return
    }

    if (signupData.password !== signupData.confirmPassword) {
      setNotice({ kind: 'error', message: 'Las contraseñas no coinciden.' })
      return
    }

    if (signupData.password.length < 8 || signupPasswordStrength.score < 3) {
      setNotice({
        kind: 'error',
        message: 'Usa una contraseña más robusta (8+ caracteres, mayúscula, número y símbolo).',
      })
      return
    }

    if (!signupData.acceptsTerms || !signupData.acceptsPrivacy) {
      setNotice({ kind: 'error', message: 'Debes aceptar términos y política de privacidad para continuar.' })
      return
    }

    setIsSubmitting(true)

    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(resolvedNextPath)}`

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password: signupData.password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          full_name: fullName,
          phone: phone || undefined,
          country: signupData.country,
          default_currency: signupData.defaultCurrency,
          account_type: signupData.accountType,
          marketing_opt_in: signupData.marketingOptIn,
        },
      },
    })

    if (signUpError) {
      setNotice({ kind: 'error', message: mapAuthError(signUpError.message) })
      setIsSubmitting(false)
      return
    }

    await triggerWelcomeEmail({
      email,
      fullName,
      country: signupData.country,
      defaultCurrency: signupData.defaultCurrency,
      accountType: signupData.accountType,
    })

    if (signUpData.session) {
      try {
        await fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: fullName,
            default_currency: signupData.defaultCurrency,
          }),
        })
      } catch {
        // Si falla esta sincronización, el trigger de perfil seguirá dejando base mínima.
      }

      await persistWelcomeName(fullName)
      router.push(resolvedNextPath)
      router.refresh()
      return
    }

    setIsSubmitting(false)
    setMode('login')
    setLoginData({ email, password: '' })
    setRecoveryEmail(email)
    setNotice({
      kind: 'success',
      message: 'Cuenta creada. Revisa tu correo para confirmar tu acceso y finalizar la activación.',
    })
  }

  async function handleRecoverySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice(null)

    const email = recoveryEmail.trim().toLowerCase()
    if (!email) {
      setNotice({ kind: 'error', message: 'Ingresa tu correo para enviar el enlace de recuperación.' })
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const payload = await response.json().catch(() => null) as
        | { ok?: boolean; data?: { message?: string }; error?: { message?: string } }
        | null

      if (!response.ok || !payload?.ok) {
        const message = payload?.error?.message ?? 'No se pudo enviar el correo de recuperación.'
        setNotice({ kind: 'error', message })
        setIsSubmitting(false)
        return
      }

      setMode('login')
      setLoginData(prev => ({ ...prev, email, password: '' }))
      setNotice({
        kind: 'success',
        message: payload.data?.message ?? 'Si el correo existe, recibirás un enlace para recuperar tu cuenta.',
      })
    } catch {
      setNotice({ kind: 'error', message: 'Error de red al solicitar recuperación de contraseña.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const canSubmitSignUp =
    signupData.fullName.trim().length >= 2 &&
    signupData.email.trim().length > 0 &&
    signupData.password.length >= 8 &&
    signupData.confirmPassword.length >= 8 &&
    signupData.password === signupData.confirmPassword &&
    signupPasswordStrength.score >= 3 &&
    signupData.acceptsTerms &&
    signupData.acceptsPrivacy
  const modeDetails = MODE_DETAILS[mode]

  return (
    <div className="fin-auth-form-panel">
      <div className="fin-auth-segmented" role="tablist" aria-label="Opciones de acceso">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'login'}
          className="fin-auth-segment"
          data-active={mode === 'login'}
          onClick={() => changeMode('login')}
        >
          Iniciar sesión
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signup'}
          className="fin-auth-segment"
          data-active={mode === 'signup'}
          onClick={() => changeMode('signup')}
        >
          Crear cuenta
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'recovery'}
          className="fin-auth-segment"
          data-active={mode === 'recovery'}
          onClick={() => changeMode('recovery')}
        >
          Recuperar
        </button>
      </div>

      {notice && (
        <div className="fin-auth-notice" data-kind={notice.kind} role="status">
          {notice.message}
        </div>
      )}

      <div className="fin-auth-mode-intro">
        <p className="fin-auth-mode-heading">{modeDetails.title}</p>
        <p className="fin-auth-mode-copy">{modeDetails.description}</p>
      </div>

      <div className="fin-auth-mode-stage">
        <div key={mode} className="fin-auth-mode-panel" data-mode={mode}>
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} data-testid="login-form" className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="login-email" className="fin-auth-label">Correo electrónico</label>
                <input
                  id="login-email"
                  type="email"
                  data-testid="login-email-input"
                  autoComplete="email"
                  value={loginData.email}
                  onChange={event => setLoginData(prev => ({ ...prev, email: event.target.value }))}
                  placeholder="tu@empresa.com"
                  className="fin-auth-input"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="login-password" className="fin-auth-label">Contraseña</label>
                <div className="fin-auth-password-wrap">
                  <input
                    id="login-password"
                    type={showLoginPassword ? 'text' : 'password'}
                    data-testid="login-password-input"
                    autoComplete="current-password"
                    value={loginData.password}
                    onChange={event => setLoginData(prev => ({ ...prev, password: event.target.value }))}
                    placeholder="••••••••"
                    className="fin-auth-input pr-11"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    className="fin-auth-eye-btn"
                    onClick={() => setShowLoginPassword(prev => !prev)}
                    aria-label={showLoginPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showLoginPassword ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
              </div>

              <div className="fin-auth-row-between">
                <label className="fin-auth-checkbox">
                  <input
                    type="checkbox"
                    checked={rememberEmail}
                    onChange={event => setRememberEmail(event.target.checked)}
                  />
                  <span>Recordar correo en este dispositivo</span>
                </label>

                <button
                  type="button"
                  className="fin-auth-link"
                  onClick={() => changeMode('recovery')}
                >
                  Olvidé mi contraseña
                </button>
              </div>

              <button
                type="submit"
                data-testid="login-submit-button"
                disabled={isSubmitting}
                className="fin-auth-btn-primary"
              >
                {isSubmitting ? 'Ingresando...' : 'Ingresar a FinTrack'}
              </button>

              <div className="fin-auth-divider">
                <span>¿Aún no tienes espacio?</span>
              </div>

              <button
                type="button"
                data-testid="login-signup-button"
                className="fin-auth-btn-secondary"
                onClick={() => changeMode('signup')}
                disabled={isSubmitting}
              >
                Crear espacio de trabajo
              </button>
            </form>
          )}

          {mode === 'signup' && (
            <form onSubmit={handleSignUpSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="signup-full-name" className="fin-auth-label">Nombre completo</label>
                <input
                  id="signup-full-name"
                  type="text"
                  autoComplete="name"
                  value={signupData.fullName}
                  onChange={event => setSignupData(prev => ({ ...prev, fullName: event.target.value }))}
                  placeholder="Nombre y apellido"
                  className="fin-auth-input"
                  required
                  minLength={2}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <label htmlFor="signup-email" className="fin-auth-label">Correo de acceso</label>
                  <input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    value={signupData.email}
                    onChange={event => setSignupData(prev => ({ ...prev, email: event.target.value }))}
                    placeholder="nombre@empresa.com"
                    className="fin-auth-input"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="signup-phone" className="fin-auth-label">Teléfono (opcional)</label>
                  <input
                    id="signup-phone"
                    type="tel"
                    autoComplete="tel"
                    value={signupData.phone}
                    onChange={event => setSignupData(prev => ({ ...prev, phone: event.target.value }))}
                    placeholder="+51 999 999 999"
                    className="fin-auth-input"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="signup-country" className="fin-auth-label">País</label>
                  <select
                    id="signup-country"
                    value={signupData.country}
                    onChange={event => setSignupData(prev => ({ ...prev, country: event.target.value }))}
                    className="fin-auth-input"
                  >
                    {COUNTRY_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="signup-currency" className="fin-auth-label">Moneda base</label>
                  <select
                    id="signup-currency"
                    value={signupData.defaultCurrency}
                    onChange={event => setSignupData(prev => ({ ...prev, defaultCurrency: event.target.value as CurrencyCode }))}
                    className="fin-auth-input"
                  >
                    <option value="PEN">PEN · Sol peruano</option>
                    <option value="USD">USD · Dólar estadounidense</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="signup-account-type" className="fin-auth-label">Tipo de cuenta</label>
                  <select
                    id="signup-account-type"
                    value={signupData.accountType}
                    onChange={event => setSignupData(prev => ({ ...prev, accountType: event.target.value as AccountType }))}
                    className="fin-auth-input"
                  >
                    <option value="PERSONAL">Personal</option>
                    <option value="BUSINESS">Empresa / equipo</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="signup-password" className="fin-auth-label">Contraseña</label>
                  <div className="fin-auth-password-wrap">
                    <input
                      id="signup-password"
                      type={showSignUpPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={signupData.password}
                      onChange={event => setSignupData(prev => ({ ...prev, password: event.target.value }))}
                      placeholder="Crea una contraseña segura"
                      className="fin-auth-input pr-11"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      className="fin-auth-eye-btn"
                      onClick={() => setShowSignUpPassword(prev => !prev)}
                      aria-label={showSignUpPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showSignUpPassword ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="signup-confirm-password" className="fin-auth-label">Confirmar contraseña</label>
                  <div className="fin-auth-password-wrap">
                    <input
                      id="signup-confirm-password"
                      type={showSignUpConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={signupData.confirmPassword}
                      onChange={event => setSignupData(prev => ({ ...prev, confirmPassword: event.target.value }))}
                      placeholder="Repite la contraseña"
                      className="fin-auth-input pr-11"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      className="fin-auth-eye-btn"
                      onClick={() => setShowSignUpConfirmPassword(prev => !prev)}
                      aria-label={showSignUpConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showSignUpConfirmPassword ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="fin-auth-password-rules">
                <div className="fin-auth-password-meter" data-score={signupPasswordStrength.score}>
                  {[1, 2, 3, 4].map(step => (
                    <span key={step} className="fin-auth-password-meter-step" data-active={signupPasswordStrength.score >= step} />
                  ))}
                </div>
                <p className="fin-auth-password-label">Seguridad: {signupPasswordStrength.label}</p>
                <div className="grid gap-1 sm:grid-cols-2">
                  {signupPasswordStrength.rules.map(rule => (
                    <p key={rule.label} className="fin-auth-password-rule" data-passed={rule.passed}>
                      {rule.passed ? '✓' : '•'} {rule.label}
                    </p>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="fin-auth-checkbox">
                  <input
                    type="checkbox"
                    checked={signupData.acceptsTerms}
                    onChange={event => setSignupData(prev => ({ ...prev, acceptsTerms: event.target.checked }))}
                  />
                  <span>Acepto términos y condiciones de FinTrack.</span>
                </label>
                <label className="fin-auth-checkbox">
                  <input
                    type="checkbox"
                    checked={signupData.acceptsPrivacy}
                    onChange={event => setSignupData(prev => ({ ...prev, acceptsPrivacy: event.target.checked }))}
                  />
                  <span>Acepto la política de privacidad y tratamiento de datos.</span>
                </label>
                <label className="fin-auth-checkbox">
                  <input
                    type="checkbox"
                    checked={signupData.marketingOptIn}
                    onChange={event => setSignupData(prev => ({ ...prev, marketingOptIn: event.target.checked }))}
                  />
                  <span>Quiero recibir novedades y buenas prácticas financieras (opcional).</span>
                </label>
              </div>

              <button
                type="submit"
                className="fin-auth-btn-primary"
                disabled={isSubmitting || !canSubmitSignUp}
              >
                {isSubmitting ? 'Creando cuenta...' : 'Crear cuenta y enviar verificación'}
              </button>

              <button
                type="button"
                className="fin-auth-btn-secondary"
                disabled={isSubmitting}
                onClick={() => changeMode('login')}
              >
                Ya tengo cuenta
              </button>
            </form>
          )}

          {mode === 'recovery' && (
            <form onSubmit={handleRecoverySubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="recovery-email" className="fin-auth-label">Correo de recuperación</label>
                <input
                  id="recovery-email"
                  type="email"
                  autoComplete="email"
                  value={recoveryEmail}
                  onChange={event => setRecoveryEmail(event.target.value)}
                  placeholder="tu@correo.com"
                  className="fin-auth-input"
                  required
                />
              </div>

              <p className="fin-auth-help-text">
                Te enviaremos un enlace seguro para recuperar el acceso y actualizar tu contraseña
                sin perder la continuidad de tu operación.
              </p>

              <button
                type="submit"
                className="fin-auth-btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Enviando enlace...' : 'Enviar enlace de recuperación'}
              </button>

              <button
                type="button"
                className="fin-auth-btn-secondary"
                disabled={isSubmitting}
                onClick={() => changeMode('login')}
              >
                Volver a iniciar sesión
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
