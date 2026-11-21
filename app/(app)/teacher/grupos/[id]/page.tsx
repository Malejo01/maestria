import { notFound } from 'next/navigation'
import { PaginaDelGrupo } from '@/components/docente/grupo/pagina-del-grupo'
import { grupoDelDocente } from '@/lib/grupo-del-docente-server'
import { pestanaDeLaUrl } from '@/lib/grupo-del-docente'
import { etiquetaDeMateriaDe } from '@/lib/etiqueta-materia-server'

export const dynamic = 'force-dynamic'

/**
 * M3: todo un grupo en una página — alumnos, tareas, temas y diagnósticos —,
 * con la pestaña en la URL. Valida en el servidor que el grupo sea del docente:
 * para cualquier otro, 404.
 */
export default async function GrupoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const consulta = await searchParams
  const grupo = await grupoDelDocente(id)
  if (!grupo) notFound()
  // La misma etiqueta que en Mis grupos (H6): "Matemática · 3.º Sec.".
  const materia = await etiquetaDeMateriaDe(grupo.teacher_id, Number(grupo.teacher_program_id), grupo.subject_name).catch(
    () => grupo.subject_name,
  )

  return (
    <PaginaDelGrupo
      grupo={{
        id: Number(grupo.id),
        nombre: grupo.name,
        codigo: grupo.join_code,
        estado: grupo.status,
        materiaId: Number(grupo.teacher_program_id),
        materia,
        nivel: grupo.nivel,
        grado: grupo.grado,
      }}
      pestana={pestanaDeLaUrl(consulta['pestaña'] ?? consulta.pestana)}
      nuevo={consulta.nuevo === '1'}
    />
  )
}
