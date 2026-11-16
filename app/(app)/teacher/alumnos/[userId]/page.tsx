import { FichaAlumno } from '@/components/docente/ficha-alumno'

/** La ficha de un alumno. El proxy ya deja pasar sólo a docentes en /teacher/*. */
export default async function FichaAlumnoPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  return <FichaAlumno userId={decodeURIComponent(userId)} />
}
