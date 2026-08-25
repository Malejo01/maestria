import { auth } from '@/auth'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { sql } from '@/lib/db'
import type { UserRole } from '@/lib/types'
import { captureRouteFailure } from '@/lib/observability'

export async function GET() {
  const session = await auth()
  const userId = session?.user?.id ?? null

  if (!userId) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  try {
    // User row was upserted at sign-in time by auth.ts; just fetch it.
    const rows = await sql`
      SELECT id, email, name, role, is_onboarded, nivel, grado
      FROM users
      WHERE id = ${userId}
      LIMIT 1
    `

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    return NextResponse.json({
      profile: {
        id: rows[0].id,
        email: rows[0].email,
        displayName: rows[0].name ?? '',
        role: (rows[0].role ?? null) as UserRole | null,
        isOnboarded: rows[0].is_onboarded,
        nivel: rows[0].nivel ?? undefined,
        grado: rows[0].grado ?? undefined,
      },
    })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/user/profile', operation: 'GET' })
    return NextResponse.json(
      { error: 'No se pudo obtener el perfil', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

const patchSchema = z
  .object({
    role: z.enum(['ALUMNO', 'DOCENTE']).optional(),
    nivel: z.enum(['Primario', 'Secundario', 'Superior']).optional(),
    grado: z.string().min(1).max(50).optional(),
  })
  .refine((data) => data.role !== undefined || data.nivel !== undefined || data.grado !== undefined, {
    message: 'Debes enviar al menos un campo (role, nivel o grado).',
  })

export async function PATCH(req: Request) {
  const session = await auth()
  const userId = session?.user?.id ?? null

  if (!userId) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const parsed = patchSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos de perfil invalidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { role, nivel, grado } = parsed.data

    // role is still required to complete onboarding — nivel/grado are optional
    // extras collected right after (only meaningful for ALUMNO).
    const rows = role
      ? await sql`
          UPDATE users
          SET
            role = ${role},
            is_onboarded = true,
            nivel = COALESCE(${nivel ?? null}, nivel),
            grado = COALESCE(${grado ?? null}, grado),
            updated_at = NOW()
          WHERE id = ${userId}
          RETURNING id, email, name, role, is_onboarded, nivel, grado
        `
      : await sql`
          UPDATE users
          SET
            nivel = COALESCE(${nivel ?? null}, nivel),
            grado = COALESCE(${grado ?? null}, grado),
            updated_at = NOW()
          WHERE id = ${userId}
          RETURNING id, email, name, role, is_onboarded, nivel, grado
        `

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    return NextResponse.json({
      profile: {
        id: rows[0].id,
        email: rows[0].email,
        displayName: rows[0].name ?? '',
        role: rows[0].role as UserRole,
        isOnboarded: rows[0].is_onboarded,
        nivel: rows[0].nivel ?? undefined,
        grado: rows[0].grado ?? undefined,
      },
    })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/user/profile', operation: 'PATCH' })
    return NextResponse.json(
      { error: 'No se pudo actualizar el perfil', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
