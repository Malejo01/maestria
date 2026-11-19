import { CargarImpreso } from '@/components/docente/diagnostico-impreso'

/** J7: cargar a mano los resultados del impreso. */
export default async function Pagina({
  params,
  searchParams,
}: {
  params: Promise<{ quizId: string }>
  searchParams: Promise<{ alumno?: string; invitacion?: string }>
}) {
  const { quizId } = await params
  const { alumno, invitacion } = await searchParams
  const consulta = alumno ? `alumno=${encodeURIComponent(alumno)}` : `invitacion=${Number(invitacion)}`
  return <CargarImpreso quizId={Number(quizId)} consulta={consulta} />
}
