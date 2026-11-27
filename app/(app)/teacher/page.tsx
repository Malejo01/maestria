'use client'

import { Recomendar } from '@/components/docente/recomendar'
import { AvisoDeEjemplo } from '@/components/docente/materia-de-ejemplo'
import Link from 'next/link'
import { HitosOnboarding } from '@/components/docente/hitos-onboarding'
import { ArranqueGuiado } from '@/components/docente/arranque-guiado'
import { ComoDasClases } from '@/components/docente/como-das-clases'
import { MuroDesdeElAviso } from '@/components/docente/muro-del-tercer-alumno'
import { cupoGratis as cupoGratisPorDefecto } from '@/lib/planes'
import { MisAlumnos } from '@/components/docente/mis-alumnos'
import { EstaSemana } from '@/components/docente/esta-semana'
import { MIS_GRUPOS } from '@/lib/textos'
import { MisGrupos } from '@/components/docente/mis-grupos'
import { cn } from '@/lib/utils'
import { MisMaterias } from '@/components/docente/mis-materias'
import { MisTareas } from '@/components/docente/mis-tareas'
import { usePanelDocente } from '@/components/docente/use-panel-docente'
import { EsqueletoPanel } from '@/components/docente/esqueletos'
import { AvisoDePrueba } from '@/components/docente/aviso-de-prueba'
import { EstadoDelPlan } from '@/components/docente/estado-del-plan'
import { ContadorDelPlan } from '@/components/docente/contador-del-plan'
import { usePlanDocente } from '@/components/docente/use-plan-docente'

/**
 * El panel del docente, como contenedor: tres pestañas (Mis alumnos, Mis
 * materias, Mis tareas) sobre un solo estado.
 *
 * La pestaña la manda la URL (`?seccion=`), que es lo que marcan las pestañas
 * de la barra. El estado y los datos están en use-panel-docente.ts; cada
 * pestaña es un componente de components/docente/.
 */
export default function TeacherPage() {
  const panel = usePanelDocente()
  const {
    isSignedIn,
    router,
    isTeacher,
    sesionCargando,
    seccionDeLaBarra,
    seccionLista,
    agregarDesdeLaUrl,
    agregarAlumno,
    setAgregarAlumno,
    vista,
    setShowOnboardingModal,
    userProfile,
    teacherPrograms,
    teacherQuizzes,
    teacherSection,
    version,
  } = panel
  // El plan se relee cuando el docente crea o borra algo: cambia cuántos
  // alumnos tiene contra su cupo.
  const { datos: planDatos, recargar: recargarPlan } = usePlanDocente(
    `${teacherPrograms.length}-${teacherQuizzes.length}-${version}`,
  )

  if (isSignedIn && userProfile && !isTeacher) {
    return null
  }

  // Antes de saber quién es o en qué pestaña está, el panel no tiene nada
  // propio que dibujar. La pestaña la dice la URL, así que el esqueleto ya es
  // el de la pantalla que viene, no uno genérico.
  if (sesionCargando || !seccionLista) {
    return <EsqueletoPanel seccion={seccionDeLaBarra} />
  }

  return (
    <div className="space-y-4">
      <AvisoDePrueba plan={planDatos?.plan} onArranco={recargarPlan} />
      <ContadorDelPlan datos={planDatos} />
      <EstadoDelPlan datos={planDatos} />
      <AvisoDeEjemplo />
      {/* AC1: «Cómo das clases» (?comoDasClases=1) y el muro desde la campanita (?muro=1). */}
      <ComoDasClases actual={planDatos?.plan.modalidad ?? null} alGuardar={recargarPlan} />
      <MuroDesdeElAviso
        cupoGratis={planDatos?.plan.cupoGratis ?? cupoGratisPorDefecto()}
        precioBloque={planDatos?.renovar?.nivel === 1 ? (planDatos.renovar.mensual?.monto ?? null) : null}
      />

      {/* AB4: mientras 2 alumnos no practicaron, el arranque guiado reemplaza a los primeros pasos. */}
      <ArranqueGuiado
        tareas={teacherQuizzes}
        onSubirPrograma={() => setShowOnboardingModal(true)}
        onArmar={() => router.push('/teacher?seccion=tareas&armar=1')}
        refrescarCon={`${teacherPrograms.length}-${teacherQuizzes.length}-${teacherSection}-${version}`}
      >
        <HitosOnboarding
          onCrearMateria={() => setShowOnboardingModal(true)}
          onCargarTemario={() => router.push('/teacher?seccion=materias')}
          onArmarTarea={() => router.push('/teacher?seccion=tareas&armar=1')}
          onMandarTarea={() => router.push('/teacher?seccion=tareas')}
          refrescarCon={`${teacherPrograms.length}-${teacherQuizzes.length}-${teacherSection}-${version}`}
        />
      </ArranqueGuiado>

      <MisTareas panel={panel} />
      <MisMaterias panel={panel} />
      <Recomendar />

        {teacherSection === 'aulas' && (
          <div className="space-y-4">
            {/* AB5: quién practicó esta semana y qué le falta a cada uno. */}
            <EstaSemana refrescarCon={version} />
            {/* L4: Mis alumnos | Mis grupos, al mismo nivel. La pestaña va en la URL. */}
            <nav aria-label={MIS_GRUPOS.pestanas.etiqueta} className="flex gap-1 border-b border-borde">
              {(['alumnos', 'grupos'] as const).map((pestana) => (
                <Link
                  key={pestana}
                  href={pestana === 'grupos' ? '/teacher?vista=grupos' : '/teacher'}
                  aria-current={vista === pestana ? 'page' : undefined}
                  className={cn(
                    'cuerpo-s -mb-px flex min-h-11 items-center border-b-2 px-4 font-bold',
                    vista === pestana ? 'border-accion text-texto' : 'border-transparent text-texto-suave hover:text-texto',
                  )}
                >
                  {MIS_GRUPOS.pestanas[pestana]}
                </Link>
              ))}
            </nav>

            {vista === 'alumnos' ? (
              <MisAlumnos
                agregarAbierto={agregarAlumno}
                onAgregarCambia={(abierto) => {
                  setAgregarAlumno(abierto)
                  // Saca ?agregar=1 de la URL: si no, recargar reabre el diálogo.
                  if (!abierto && agregarDesdeLaUrl) router.replace('/teacher')
                }}
                onArmarTarea={(materiaId) =>
                  router.push(`/teacher?seccion=tareas&armar=1${materiaId ? `&materia=${materiaId}` : ''}`)
                }
                refrescarCon={teacherPrograms.length}
                // K4: el contador del plan y los hitos se releen con `version`.
                alCambiarAlumnos={() => panel.setVersion((v) => v + 1)}
              />
            ) : (
              <MisGrupos materias={teacherPrograms} alCambiar={() => panel.setVersion((v) => v + 1)} modalidad={planDatos?.plan.modalidad ?? null} />
            )}
          </div>
        )}
    </div>
  )
}
