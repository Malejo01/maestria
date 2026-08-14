import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Guarda del `matcher` de [proxy.ts](../proxy.ts).
 *
 * El 2026-08-10, 30 alumnos entrando a la vez produjeron 305 `MissingCSRF` en
 * `POST /api/auth/signin/google`: el middleware corría sobre las rutas del
 * propio NextAuth, así que había dos instancias de Auth.js por request y cada
 * una emitía su propia cookie de CSRF. El arreglo fue sacar `api/auth` del
 * matcher — una línea que es fácil de deshacer sin querer, porque el patrón es
 * una tira de regex ilegible en medio de un objeto de configuración.
 *
 * Por qué el patrón se duplica acá en vez de importarse: Next exige que
 * `export const config` de un middleware sea **estáticamente analizable**, así
 * que sacar la constante a un módulo compartido rompería la extracción del
 * matcher en build. La duplicación se auto-vigila con el primer test, que lee
 * proxy.ts del disco y falla si las dos copias se separan.
 */
const MATCHER =
  '/((?!api/auth|_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)'

/** El matcher de Next es una ruta con un grupo de regex; ancla en los extremos. */
const matches = (pathname: string): boolean => new RegExp(`^${MATCHER}$`).test(pathname)

describe('matcher del middleware', () => {
  it('sigue siendo el mismo patrón que declara proxy.ts', () => {
    const source = readFileSync(join(process.cwd(), 'proxy.ts'), 'utf8')

    // En el archivo el patrón vive dentro de un literal de TypeScript, donde
    // cada `\` va escapado como `\\`. Acá `MATCHER` ya es el valor en runtime
    // (con `\` simple), así que hay que re-escaparlo para comparar contra el
    // texto crudo. Comparar el literal alcanza y no depende de poder importar
    // proxy.ts, que arrastra NextAuth y su configuración.
    const comoEstaEscritoEnElArchivo = MATCHER.replace(/\\/g, '\\\\')
    expect(source).toContain(`'${comoEstaEscritoEnElArchivo}'`)

    // El segundo patrón hacía que /api/auth volviera a entrar por la ventana.
    expect(source).not.toContain("'/(api|trpc)(.*)'")
  })

  it('NO corre sobre las rutas de NextAuth — es el arreglo del MissingCSRF', () => {
    expect(matches('/api/auth/csrf')).toBe(false)
    expect(matches('/api/auth/session')).toBe(false)
    expect(matches('/api/auth/signin/google')).toBe(false)
    expect(matches('/api/auth/callback/google')).toBe(false)
  })

  it('sigue corriendo sobre todo lo que sí protege', () => {
    // Las rutas de docente son las que dependen del middleware para el bloqueo
    // de ALUMNO, y las páginas /teacher/* dependen SÓLO de él.
    expect(matches('/api/teacher/classrooms')).toBe(true)
    expect(matches('/teacher')).toBe(true)
    expect(matches('/teacher/aulas/3')).toBe(true)
    expect(matches('/api/admin/ai-usage')).toBe(true)
    expect(matches('/admin')).toBe(true)
  })

  it('cubre el resto de /api sin el patrón que se borró', () => {
    // Esto es lo que justificaba `/(api|trpc)(.*)`: hay que ver que el primer
    // patrón ya lo cubre, o borrarlo habría abierto un agujero.
    expect(matches('/api/quiz/save-result')).toBe(true)
    expect(matches('/api/quiz/grade-short-answer')).toBe(true)
    expect(matches('/api/feedback')).toBe(true)
    expect(matches('/api/generate-quiz')).toBe(true)
    expect(matches('/trpc/algo')).toBe(true)
    expect(matches('/')).toBe(true)
  })

  it('sigue salteando internos de Next y assets estáticos', () => {
    expect(matches('/_next/static/chunks/main.js')).toBe(false)
    expect(matches('/logo.png')).toBe(false)
    expect(matches('/styles.css')).toBe(false)
    expect(matches('/fuente.woff2')).toBe(false)
    // `js(?!on)` está para que un .json siga pasando por el middleware.
    expect(matches('/datos.json')).toBe(true)
  })

  it('la exclusión es por prefijo: ninguna ruta propia puede empezar con api/auth', () => {
    // `(?!api/auth)` no exige la barra siguiente, así que una ruta futura
    // llamada /api/authorize quedaría fuera del middleware sin que nadie lo
    // note. Hoy no existe ninguna; este test es el que avisa si alguien la crea.
    expect(matches('/api/authorize')).toBe(false)

    const apiDir = join(process.cwd(), 'app', 'api')
    const rutas = readdirSync(apiDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => name.startsWith('auth') && name !== 'auth')

    expect(rutas).toEqual([])
  })
})
