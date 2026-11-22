import { notFound } from 'next/navigation'
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
  const materia = await etiquetaDeMateriaDe(grupo.teacher_id, Number(grupo.teacher_program_id), grupo.subject_name).catch(
    () => grupo.subject_name,
  )
  return <InformeParaImprimir grupoId={Number(grupo.id)} nombre={grupo.name} materia={materia} />
}
