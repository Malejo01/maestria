import { ImprimirDiagnostico } from '@/components/docente/diagnostico-impreso'

/** J7: la versión para imprimir de un cuestionario del diagnóstico. Va en (focus): sin la barra de la app, que no tiene que salir en el papel. */
export default async function Pagina({
  params,
  searchParams,
}: {
  params: Promise<{ quizId: string }>
  searchParams: Promise<{ alumno?: string; invitacion?: string; grupo?: string }>
}) {
  const { quizId } = await params
  const { alumno, invitacion, grupo } = await searchParams
  // L4: `grupo=…` imprime la hoja para todo el grupo, sin nombre.
  const consulta = alumno
    ? `alumno=${encodeURIComponent(alumno)}`
    : grupo
      ? `grupo=${Number(grupo)}`
      : `invitacion=${Number(invitacion)}`
  return <ImprimirDiagnostico quizId={Number(quizId)} consulta={consulta} />
}
