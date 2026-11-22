import { notFound } from 'next/navigation'
import Link from 'next/link'
import { emailDeUsuario, puedeImprimirYMoodle } from '@/lib/planes-server'
import { MENSAJE_CON_UN_PLAN } from '@/lib/planes'
import { PLANES_GRATIS } from '@/lib/textos'
import { InformeParaImprimir } from '@/components/docente/grupo/informe-para-imprimir'
import { grupoDelDocente } from '@/lib/grupo-del-docente-server'
import { etiquetaDeMateriaDe } from '@/lib/etiqueta-materia-server'

export const dynamic = 'force-dynamic'

/**
 * O9: el informe del grupo para imprimir. En (focus), sin la barra de la app,
 * que no va al papel (como la hoja del diagnóstico, J7). El grupo se valida en
 * el servidor: de otro docente, 404. El orden y el filtro de la planilla
 * vienen en la URL, los mismos que en la página del grupo.
 */
export default async function ImprimirInformeDelGrupo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const grupo = await grupoDelDocente(id)
  if (!grupo) notFound()
  // B1: el informe para imprimir viene con un plan pago (no en el gratis).
  const teacherId = String(grupo.teacher_id)
  if (!(await puedeImprimirYMoodle(teacherId, await emailDeUsuario(teacherId)))) {
    return (
      <main className="mx-auto max-w-md space-y-4 p-6 text-center">
        <p className="cuerpo text-texto">{MENSAJE_CON_UN_PLAN}</p>
        <Link href="/precios" className="cuerpo-s inline-flex min-h-11 items-center font-semibold text-accion underline">
          {PLANES_GRATIS.irAPrecios}
        </Link>
      </main>
    )
  }
  const materia = await etiquetaDeMateriaDe(grupo.teacher_id, Number(grupo.teacher_program_id), grupo.subject_name).catch(
    () => grupo.subject_name,
  )
  return <InformeParaImprimir grupoId={Number(grupo.id)} nombre={grupo.name} materia={materia} />
}
