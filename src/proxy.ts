import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (pathname.startsWith('/login')) {
    if (user) return NextResponse.redirect(new URL('/', request.url))
    return response
  }

  // Alguien que llega desde el link del correo todavía no tiene una sesión
  // "normal" — el intercambio del código de recuperación pasa recién en el
  // cliente, en esta misma pantalla. A diferencia de /login, no redirige ni
  // aunque ya haya sesión (podría estar cambiando su contraseña logueada).
  if (pathname.startsWith('/reset-password')) {
    return response
  }

  // Mismo caso que /reset-password, pero para la confirmación de registro:
  // el link de la plantilla "Confirm signup" apunta a "/" con
  // ?token_hash=&type=signup, y todavía no hay sesión — el canje pasa
  // recién en el cliente, en esta misma pantalla.
  if (pathname === '/' && request.nextUrl.searchParams.get('type') === 'signup' && request.nextUrl.searchParams.get('token_hash')) {
    return response
  }

  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
