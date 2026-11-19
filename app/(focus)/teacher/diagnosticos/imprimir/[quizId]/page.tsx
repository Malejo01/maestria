import { ImprimirDiagnostico } from '@/components/docente/diagnostico-impreso'

/** J7: la versión para imprimir de un cuestionario del diagnóstico. Va en (focus): sin la barra de la app, que no tiene que salir en el papel. */
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
  return <ImprimirDiagnostico quizId={Number(quizId)} consulta={consulta} />
}
