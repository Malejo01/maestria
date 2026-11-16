import { notFound } from 'next/navigation'
import { sql } from '@/lib/db'
import { devLoginHabilitado } from '@/lib/dev-login'
import { TarjetaEntrada, TituloEntrada, BajadaEntrada } from '@/components/entrada/tarjeta-entrada'
import { EntrarComo } from './entrar-como'

export const dynamic = 'force-dynamic'

/**
 * Ingreso de desarrollo. Fuera de `next dev` contra staging, esta página no
 * existe: responde 404 antes de tocar nada. Los candados están en
 * lib/dev-login.ts; el proveedor de Auth.js los vuelve a evaluar al entrar,
 * así que esta página no es la que protege — sólo evita mostrar un formulario
 * que no funcionaría.
 *
 * Los textos van acá y no en lib/textos.ts a propósito: no es interfaz del
 * producto y ningún usuario la ve.
 */
export default async function IngresoDeDesarrolloPage() {
  if (!(await devLoginHabilitado())) notFound()

  const usuarios = (await sql`
    SELECT u.id, u.name, u.role,
           (SELECT COUNT(*)::int FROM teacher_programs p WHERE p.user_id = u.id AND p.status = 'active') AS materias,
           (SELECT COUNT(*)::int FROM classroom_members m WHERE m.user_id = u.id AND m.status = 'active') AS grupos
    FROM users u
    WHERE u.is_guest = false AND u.email IS NOT NULL
    ORDER BY (u.role = 'DOCENTE') DESC, materias DESC, grupos DESC, u.id
    LIMIT 12
  `) as { id: string; name: string | null; role: string | null; materias: number; grupos: number }[]

  return (
    <TarjetaEntrada>
      <TituloEntrada>Ingreso de desarrollo</TituloEntrada>
      <BajadaEntrada>Base de staging, con datos anonimizados. No existe en producción.</BajadaEntrada>
      <EntrarComo
        usuarios={usuarios.map((u) => ({
          id: u.id,
          etiqueta: u.name ?? u.id,
          detalle: `${u.role ?? 'sin rol'} · ${u.materias} materias · ${u.grupos} grupos`,
        }))}
      />
    </TarjetaEntrada>
  )
}
