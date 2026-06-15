// =============================================================================
// middleware.ts  (raíz del proyecto — al mismo nivel que app/)
// Guard de autenticación. Se ejecuta en cada petición antes del renderizado.
// =============================================================================

import { createServerClient }  from '@supabase/ssr'
import { NextResponse }        from 'next/server'
import type { NextRequest }    from 'next/server'
import {
  APP_CONTROL_CONFIG,
  findControlledModuleByPath,
  isDeveloperBypassRoute,
  isSystemMessageRoute,
} from '@/lib/constants/app-control'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Crear respuesta mutable para poder escribir cookies de sesión
  const response = NextResponse.next({
    request: { headers: request.headers },
  })
  type CookieOptions = Parameters<typeof response.cookies.set>[2]

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll()                           { return request.cookies.getAll() },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value))
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options))
        },
      },
    }
  )

  // Refrescar la sesión si expiró
  const { data: { user } } = await supabase.auth.getUser()

  const isAuthEntryRoute = pathname.startsWith('/login') || pathname.startsWith('/register')
  const isAuthCallbackRoute = pathname.startsWith('/auth/callback')
  const isApiRoute = pathname.startsWith('/api/')
  const isStaticAsset = pathname.startsWith('/_next') || pathname === '/favicon.ico'
  const isLandingPage = pathname === '/'
  const isDeveloperRoute = isDeveloperBypassRoute(pathname)
  const isStateScreenRoute = isSystemMessageRoute(pathname)
  const isLaunchOpen = request.nextUrl.searchParams.get('ft_launch') === 'open'

  if (APP_CONTROL_CONFIG.maintenance.enabled) {
    if (isApiRoute && !isDeveloperRoute && !pathname.startsWith('/api/releases/')) {
      return NextResponse.json({
        ok: false,
        error: {
          code: 'MAINTENANCE_MODE',
          message: APP_CONTROL_CONFIG.maintenance.message,
        },
      }, { status: 503 })
    }

    if (!isStaticAsset && !isAuthCallbackRoute && !isDeveloperRoute && !isStateScreenRoute) {
      return NextResponse.redirect(new URL('/maintenance', request.url))
    }
  }

  // No interceptar rutas estáticas ni API
  if (isStaticAsset || isApiRoute || isAuthCallbackRoute) return response
  if (isStateScreenRoute) return response

  // Landing page: accesible sin sesión; con sesión → dashboard
  if (isLandingPage) {
    if (user) return NextResponse.redirect(new URL('/dashboard', request.url))
    return response
  }

  // Sin sesión → redirigir a login (excepto rutas de auth)
  if (!user && !isAuthEntryRoute) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Con sesión → no dejar ir a login
  if (user && isAuthEntryRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  const controlledModule = findControlledModuleByPath(pathname)
  const hasLaunchAccess = controlledModule?.status === 'launch' && (
    isLaunchOpen || request.cookies.get(`ft_launch_${controlledModule.key}`)?.value === 'open'
  )

  if (controlledModule?.status === 'launch' && isLaunchOpen) {
    response.cookies.set(`ft_launch_${controlledModule.key}`, 'open', {
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
      sameSite: 'lax',
    })
  }

  if (controlledModule && controlledModule.status !== 'live' && !isDeveloperRoute && !hasLaunchAccess) {
    return NextResponse.redirect(new URL(`/module-status/${controlledModule.key}`, request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
