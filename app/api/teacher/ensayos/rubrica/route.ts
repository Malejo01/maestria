import { NextResponse } from 'next/server'
import { getTeacherViewer } from '@/lib/auth-session'
import { guardAiCall } from '@/lib/ai-guard'
import { proponerRubrica } from '@/lib/ensayo-ia'
import { MINIMO_CRITERIOS } from '@/lib/ensayo'
import { captureAiSchemaFailure } from '@/lib/observability'
import type { AiSdkUsage } from '@/lib/ai-usage'

export const dynamic = 'force-dynamic'

/** Ronda W · W5 — POST { consigna, guia, materia }: la IA propone de 3 a 5 criterios; el docente los edita. */
export async function POST(req: Request) {
  const teacher = await getTeacherViewer()
  if (!teacher) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const body = (await req.json().catch(() => null)) as { consigna?: unknown; guia?: unknown; materia?: unknown } | null
  const consigna = String(body?.consigna ?? '').trim().slice(0, 2000)
  if (consigna.length < 10) return NextResponse.json({ error: 'Falta la consigna' }, { status: 400 })

  const guard = await guardAiCall({ bucket: 'grading', actor: 'docente' })
  if (!guard.ok) return guard.response
  let usage: AiSdkUsage | undefined
  try {
    const criterios = await proponerRubrica({
      consigna,
      guia: String(body?.guia ?? '').slice(0, 2000),
      materia: String(body?.materia ?? 'la materia').slice(0, 100),
      onUsage: (u) => (usage = u),
    })
    await guard.finish(usage)
    if (criterios.length < MINIMO_CRITERIOS) return NextResponse.json({ error: 'No alcanzaron los criterios' }, { status: 502 })
    return NextResponse.json({ rubrica: criterios })
  } catch (error) {
    await guard.fail()
    captureAiSchemaFailure(error, { endpoint: '/api/teacher/ensayos/rubrica', fallback: 'none' })
    return NextResponse.json({ error: 'No se pudieron proponer criterios' }, { status: 500 })
  }
}
