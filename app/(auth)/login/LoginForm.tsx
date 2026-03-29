'use client'

// =============================================================================
// app/(auth)/login/LoginForm.tsx
// =============================================================================

import { useState }         from 'react'
import { useRouter }        from 'next/navigation'
import { createClient }     from '@/lib/supabase.client'

export function LoginForm() {
  const router   = useRouter()
  const supabase = createClient()
  const WELCOME_KEY = 'fintrack.welcome.v1'

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const fieldClass = `
    w-full px-3.5 py-2.5 rounded-lg text-sm font-medium
    bg-[var(--color-surface-2)] border border-[color:var(--color-border)] text-[var(--color-text)]
    placeholder:text-[var(--color-text-faint)]
    focus:outline-none focus:ring-2 focus:ring-emerald-500/20
    focus:border-emerald-500/40 transition-all
  `

  const normalizeDisplayName = (raw: string | null | undefined): string => {
    const clean = (raw ?? '').trim()
    if (!clean) return 'Usuario'
    if (clean.includes('@')) {
      return 'Usuario'
    }
    const formatted = clean.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim()
    return formatted.length > 0 ? formatted : 'Usuario'
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email:    email.trim(),
      password,
    })

    if (authError) {
      setError('Correo o contraseña incorrectos')
      setLoading(false)
      return
    }

    try {
      const metadataName =
        typeof authData?.user?.user_metadata?.full_name === 'string'
          ? authData.user.user_metadata.full_name
          : null

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
        // Si falla la lectura del perfil, usamos fallback.
      }

      const displayName = normalizeDisplayName(
        profileName ??
        metadataName ??
        null
      )

      window.sessionStorage.setItem(
        WELCOME_KEY,
        JSON.stringify({
          name: displayName,
          at: Date.now(),
        })
      )
    } catch {
      // Si sessionStorage no está disponible, seguimos sin bloquear login.
    }

    router.push('/dashboard')
    router.refresh()
  }

  async function handleSignUp() {
    if (!email || !password) {
      setError('Ingresa tu correo y una contraseña para registrarte')
      return
    }
    setLoading(true)
    setError(null)

    const autoName = email
      .trim()
      .split('@')[0]
      ?.replace(/[._-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'Usuario'

    const { error: signUpError } = await supabase.auth.signUp({
      email:    email.trim(),
      password,
      options: {
        data: { full_name: autoName },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    })

    if (signUpError) {
      setError(signUpError.message)
    } else {
      setError(null)
      alert('Revisa tu correo para confirmar tu cuenta.')
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} data-testid="login-form" className="space-y-4">
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-widest
          text-[var(--color-text-muted)] mb-1.5">
          Correo electrónico
        </label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="tu@correo.com"
          data-testid="login-email-input"
          required
          autoComplete="email"
          className={fieldClass}
        />
      </div>

      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-widest
          text-[var(--color-text-muted)] mb-1.5">
          Contraseña
        </label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          data-testid="login-password-input"
          required
          autoComplete="current-password"
          minLength={6}
          className={fieldClass}
        />
      </div>

      {error && (
        <div data-testid="login-error" className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
          <p className="text-[12px] text-red-400">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        data-testid="login-submit-button"
        className="w-full py-3 rounded-xl text-sm font-bold
          bg-emerald-500 hover:bg-emerald-400 text-black
          shadow-lg shadow-emerald-500/20
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-all duration-150 mt-2"
      >
        {loading ? 'Ingresando…' : 'Ingresar'}
      </button>

      <div className="relative my-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[color:var(--color-border)]"/>
        </div>
        <div className="relative flex justify-center">
          <span className="px-3 bg-[var(--color-surface)] text-[10px] text-[var(--color-text-faint)]">¿Sin cuenta?</span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSignUp}
        disabled={loading}
        data-testid="login-signup-button"
        className="w-full py-2.5 rounded-xl text-sm font-semibold
          bg-[var(--color-surface-2)] hover:bg-[var(--color-surface)]
          border border-[color:var(--color-border)] hover:border-[color:var(--color-border-hover)]
          text-[var(--color-text-muted)] hover:text-[var(--color-text)]
          disabled:opacity-40 transition-all duration-150"
      >
        Crear cuenta
      </button>
    </form>
  )
}
