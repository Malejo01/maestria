import { auth } from '@/auth'
import { NextResponse } from 'next/server'
import { isAdminEmail } from '@/lib/ai-rate-limit'
import { esRutaPublica } from '@/lib/rutas-publicas'
import { COOKIE_DE_ORIGEN, cookieAGuardar, DIAS_DE_LA_COOKIE } from '@/lib/origen'

// Routes that do NOT require a NextAuth session live in lib/rutas-publicas.ts.
//
// The aula routes are listed here because a guest student has no NextAuth
// session at all — they carry a signed guest cookie instead. Each of those
// handlers resolves the viewer itself (getViewer) and answers 401 when there
// is neither identity, so "public" here means "the middleware must not bounce
// them to /sign-in", not "unauthenticated access allowed".
//
// Los cuatro endpoints de IA de esta lista pasan además por guardAiCall
// (lib/ai-guard.ts), que exige identidad antes de tocar Gemini. Hasta la
// migración 016 tres de ellos no verificaban absolutamente nada: cualquiera
// con curl podía quemar la cuota. Si agregás un endpoint de IA acá, cableá el
// guard en el handler o volvés a abrir ese agujero.

/**
 * V1: la primera visita con `?origen=` o `?ref=` deja la cookie (30 días) en
 * la respuesta que sea. Nunca pisa una anterior.
 */
function conOrigen(req: Parameters<Parameters<typeof auth>[0]>[0], res: NextResponse): NextResponse {
  const valor = cookieAGuardar(req.cookies.get(COOKIE_DE_ORIGEN)?.value, req.nextUrl.searchParams, new Date())
  if (valor) {
    res.cookies.set(COOKIE_DE_ORIGEN, valor, { maxAge: DIAS_DE_LA_COOKIE * 86_400, httpOnly: true, sameSite: 'lax', secure: req.nextUrl.protocol === 'https:', path: '/' })
  }
  return res
}

export default auth((req) => conOrigen(req, decidir(req)))

function decidir(req: Parameters<Parameters<typeof auth>[0]>[0]): NextResponse {
  const { nextUrl, auth: session } = req
  const isAuthenticated = !!session

  if (!isAuthenticated && !esRutaPublica(nextUrl.pathname)) {
    const signInUrl = new URL('/sign-in', nextUrl.origin)
    signInUrl.searchParams.set('callbackUrl', nextUrl.pathname)
    return NextResponse.redirect(signInUrl)
  }

  // /admin no se protege por rol sino por la allowlist ADMIN_EMAILS: no existe
  // un rol ADMIN en el producto. Esto es defensa en profundidad — la página y
  // la ruta ya chequean con getAdminViewer() — y evita además que un no-admin
  // llegue siquiera a ejecutar el handler.
  if (isAuthenticated) {
    const { pathname } = nextUrl
    const isAdminPath =
      pathname === '/admin' ||
      pathname.startsWith('/admin/') ||
      pathname === '/api/admin' ||
      pathname.startsWith('/api/admin/')

    // P1: 404 y no redirect ni 403. Si no es para vos, /admin no existe: ni
    // siquiera se confirma que hay algo ahí. Las páginas se reescriben a una
    // ruta que no existe (el not-found de la app, con estado 404).
    if (isAdminPath && !isAdminEmail(session?.user?.email)) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
      }
      return NextResponse.rewrite(new URL('/_no-existe', nextUrl.origin))
    }
  }

  // Authorize roles: block ALUMNO from teacher API and page endpoints
  if (isAuthenticated && session?.user?.role === 'ALUMNO') {
    const { pathname } = nextUrl
    if (pathname === '/api/teacher' || pathname.startsWith('/api/teacher/')) {
      return NextResponse.json(
        { error: 'Acceso denegado: Los alumnos no tienen permitido el acceso a endpoints de docente.' },
        { status: 403 }
      )
    }
    if (pathname === '/teacher' || pathname.startsWith('/teacher/')) {
      return NextResponse.redirect(new URL('/', nextUrl.origin))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Se saltea los internos de Next y los assets estáticos.
    //
    // `api/auth` queda afuera A PROPÓSITO, y es el arreglo de las 305 fallas de
    // login del 2026-08-10. El wrapper `auth()` de arriba corre una instancia
    // completa de Auth.js por request y emite su propia cookie
    // `__Host-authjs.csrf-token`; sobre las rutas del propio NextAuth eso
    // duplica la cookie y puede pisar el token que el cliente acaba de recibir
    // por `GET /api/auth/csrf`, con lo que el POST de signin muere con
    // MissingCSRF. Diagnóstico completo en docs/investigacion-login-10-08.md.
    //
    // No se pierde protección: `/api/auth` ya está en PUBLIC_PATHS, así que el
    // middleware nunca hizo nada por esas rutas más que duplicar la cookie.
    //
    // El patrón `/(api|trpc)(.*)` que había acá abajo se borró: hacía que
    // `/api/auth/*` volviera a entrar por la ventana aunque el primero lo
    // excluyera, y además era redundante — `/api/*` ya cae dentro del primer
    // patrón, que sólo excluye `_next` y extensiones estáticas. Eso está
    // verificado con casos, no de memoria: tests/middleware-matcher.test.ts.
    '/((?!api/auth|_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
  ],
}
