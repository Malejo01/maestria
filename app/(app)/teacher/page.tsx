'use client'

import Link from 'next/link'
import { Boton } from '@/components/sistema/boton'
import { HitosOnboarding } from '@/components/docente/hitos-onboarding'
import { MisAlumnos } from '@/components/docente/mis-alumnos'
import { MIS_ALUMNOS } from '@/lib/textos'
import { ChevronRight } from 'lucide-react'
import { TeacherClassrooms } from '@/components/teacher-classrooms'
import { MisMaterias } from '@/components/docente/mis-materias'
import { MisTareas } from '@/components/docente/mis-tareas'
import { usePanelDocente } from '@/components/docente/use-panel-docente'
import { EsqueletoPanel } from '@/components/docente/esqueletos'
import { AvisoDePrueba } from '@/components/docente/aviso-de-prueba'
import { EstadoDelPlan } from '@/components/docente/estado-del-plan'
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
    gruposAbiertos,
    setGruposAbiertos,
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
      <EstadoDelPlan datos={planDatos} />

      <HitosOnboarding
        onCrearMateria={() => setShowOnboardingModal(true)}
        onCargarTemario={() => router.push('/teacher?seccion=materias')}
        onArmarTarea={() => router.push('/teacher?seccion=tareas&armar=1')}
        onMandarTarea={() => router.push('/teacher?seccion=tareas')}
        refrescarCon={`${teacherPrograms.length}-${teacherQuizzes.length}-${teacherSection}-${version}`}
      />

      <MisTareas panel={panel} />
      <MisMaterias panel={panel} />

        {teacherSection === 'aulas' && (
          <div className="space-y-4">
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
            />

            {/* La gestión por grupo de la versión anterior (códigos, tareas
                mandadas, seguimiento por grupo) sigue acá, plegada, hasta que
                el bloque 5 del rediseño rehaga el envío de tareas. El docente
                ya no necesita abrirla para sumar alumnos. */}
            <section className="rounded-lg border border-borde bg-superficie-tarjeta p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="cuerpo text-texto">{MIS_ALUMNOS.grupos.titulo}</h2>
                  <p className="nota text-texto-suave">{MIS_ALUMNOS.grupos.detalle}</p>
                </div>
                <Boton
                  variante="secundario"
                  aria-expanded={gruposAbiertos}
                  onClick={() => setGruposAbiertos((abierto) => !abierto)}
                >
                  {gruposAbiertos ? MIS_ALUMNOS.grupos.ocultar : MIS_ALUMNOS.grupos.mostrar}
                </Boton>
              </div>

              {gruposAbiertos && (
                <div className="mt-4 space-y-4">
                  {/* El diagnóstico del 10/08 no se tomó dentro de un aula, así que
                      no aparece en el seguimiento de ninguna. */}
                  <Link
                    href="/teacher/diagnostico"
                    className="flex items-center justify-between gap-3 rounded-lg border border-borde p-4 hover:border-borde-fuerte"
                  >
                    <span className="min-w-0">
                      <span className="cuerpo-s block font-bold text-texto">Diagnóstico del 10 de agosto</span>
                      <span className="nota block text-texto-suave">
                        Qué nivelar antes de avanzar, por unidad y con los pisos de azar a la vista
                      </span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-texto-suave shrink-0" aria-hidden="true" />
                  </Link>

                  <TeacherClassrooms programs={teacherPrograms} />
                </div>
              )}
            </section>
          </div>
        )}
    </div>
  )
}
