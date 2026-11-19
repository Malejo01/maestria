import { FichaInvitacion } from '@/components/docente/ficha-invitacion'

/** J2: la ficha de un alumno que el docente agregó y todavía no entró. */
export default async function FichaInvitacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <FichaInvitacion invitacionId={Number(id)} />
}
