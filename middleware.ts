import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Dejar pasar rutas públicas y assets
  if (
    PUBLIC_PATHS.some(p => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  // La sesión vive en localStorage (client-side) — no es accesible desde middleware.
  // Usamos una cookie liviana que el cliente escribe al iniciar sesión.
  const sesionCookie = request.cookies.get('cuentas_sesion')

  if (!sesionCookie?.value) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
