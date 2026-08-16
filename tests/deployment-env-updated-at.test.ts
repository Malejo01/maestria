import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * `deployment_env.updated_at` contesta "¿cuándo se decidió por última vez qué es
 * esta base?". Es lo que se mira cuando una branch clonada y la producción real
 * dicen las dos `production` y hay que saber cuál de los dos marcadores quedó
 * sin flipear (ver el comentario largo de 017-deployment-env.sql). Un timestamp
 * congelado miente en las dos direcciones: hace parecer viejo un marcador que se
 * acaba de escribir, y tapa que hace meses que nadie lo toca.
 *
 * La columna tiene DEFAULT NOW(), pero un DEFAULT sólo corre en el INSERT — todo
 * UPDATE que no lo ponga a mano se lleva el valor viejo puesto. Sin ORM no hay
 * un único lugar donde cablearlo, y un trigger obligaría a una migración nueva
 * corrida contra producción para arreglar algo que hoy no rompe nada. Así que el
 * guardrail es este chequeo léxico sobre el repo, el mismo enfoque que
 * tests/migrations.test.ts usa para la numeración.
 *
 * Los INSERT pelados no se exigen: ahí el DEFAULT sí corre. Lo que falla es un
 * `UPDATE deployment_env` o un `ON CONFLICT … DO UPDATE` que se olvide.
 */
const ROOT = process.cwd()
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', '.claude', 'coverage', 'qa-reports'])
const EXTENSIONS = ['.ts', '.tsx', '.sql']

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (EXTENSIONS.some((ext) => entry.name.endsWith(ext))) out.push(full)
  }
  return out
}

/**
 * Saca comentarios antes de buscar. Sin esto, la prosa que explica el marcador
 * —que en este repo es abundante y cita el SQL textualmente— cuenta como si
 * fuera una sentencia y el test falla por algo que nunca se ejecuta.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^[ \t]*--.*$/gm, ' ')
    .replace(/^[ \t]*\/\/.*$/gm, ' ')
}

interface Write {
  file: string
  kind: string
  text: string
}

function writesToMarker(file: string): Write[] {
  const source = stripComments(readFileSync(file, 'utf8'))
  const label = relative(ROOT, file).split('\\').join('/')
  const found: Write[] = []

  // Cada sentencia se corta en el backtick que cierra el tagged template o en el
  // `;` del .sql, lo que venga primero.
  for (const match of source.matchAll(/UPDATE\s+deployment_env\b[\s\S]*?(?=`|;|$)/gi)) {
    found.push({ file: label, kind: 'UPDATE', text: match[0] })
  }

  for (const match of source.matchAll(/INSERT\s+INTO\s+deployment_env\b[\s\S]*?(?=`|;|$)/gi)) {
    if (/\bDO\s+UPDATE\b/i.test(match[0])) {
      found.push({ file: label, kind: 'ON CONFLICT DO UPDATE', text: match[0] })
    }
  }

  return found
}

const writes = walk(ROOT).flatMap(writesToMarker)

describe('deployment_env.updated_at', () => {
  /**
   * Sin esto el test pasa solo: si el regex se rompe o los archivos se mueven,
   * "cero escrituras encontradas" satisface la aserción de abajo sin revisar
   * nada. Hoy hay tres — markEnvironment y los runners 017 y 018.
   */
  it('encuentra las escrituras al marcador', () => {
    expect(writes.length).toBeGreaterThanOrEqual(3)
    expect(writes.map((write) => write.file)).toContain('scripts/lib/db-target.ts')
  })

  it.each(writes.map((write) => [`${write.file} — ${write.kind}`, write] as const))(
    '%s refresca updated_at',
    (_label, write) => {
      expect(
        /\bupdated_at\b/i.test(write.text),
        `${write.file}: este ${write.kind} sobre deployment_env no toca updated_at, así que ` +
          'la fila va a quedar diciendo que se escribió por última vez cuando se creó. ' +
          'Agregale `updated_at = NOW()` al SET.',
      ).toBe(true)
    },
  )
})
