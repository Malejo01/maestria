'use client'

import { BANCO } from '@/lib/textos'
import Link from 'next/link'
import { ComoFunciona } from '@/components/sistema/como-funciona'
import { ExportarMoodle } from '@/components/docente/exportar-moodle'
import { useState } from 'react'
import { MIS_TAREAS as T } from '@/lib/textos'

import { Boton } from '@/components/sistema/boton'
import { PANEL_DOCENTE } from '@/lib/textos'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TeacherQuizReview } from '@/components/teacher-quiz-review'
import { ShareQuizDialog } from '@/components/share-quiz-dialog'
import type { PanelDocente } from '@/components/docente/use-panel-docente'
import { EsqueletoListaDeTareas } from '@/components/docente/esqueletos'
import { resumirTemas } from '@/lib/alumnos-docente'
import { etiquetaDeMateria, materiaDePrograma } from '@/lib/etiqueta-materia'
import { filtrarPorTipo, type FiltroDeTipo } from '@/lib/tarea-docente'
import { CorregirTiposDialog } from '@/components/docente/corregir-tipos-dialog'
import { DialogoDeLimite } from '@/components/docente/pantalla-de-limite'
import { useToast } from '@/hooks/use-toast'
import { contarMarcadas } from '@/lib/corregir-tipos'
import { guardarPreguntas } from '@/lib/guardar-preguntas'
import type { CuerpoDeBloqueo } from '@/lib/planes'
import { CORREGIR_TIPOS } from '@/lib/textos'

/**
 * "Mis tareas": las tareas guardadas y las realizadas, con revisar, editar,
 * previsualizar, exportar y mandar a un grupo.
 *
 * Presentación movida tal cual desde app/(app)/teacher/page.tsx. El envío de
 * tareas se rehace en el bloque 5 del rediseño.
 */
export function MisTareas({ panel }: { panel: PanelDocente }) {
  const {
    handleDeleteQuiz,
    handleRunQuiz,
    handlePreviewQuiz,
    handleExportQuiz,
    quizSubjectFilter,
    setQuizSubjectFilter,
    performedQuizzes,
    revisandoQuiz,
    setRevisandoQuiz,
    exportingQuizId,
    sharingQuiz,
    setSharingQuiz,
    setVersion,
    tareasLeidas,
    teacherPrograms,
    teacherQuizzes,
    teacherSection,
    setTeacherQuizzes,
    setTeacherSection,
  } = panel

  // H6: con dos materias del mismo nombre, el filtro y la tarjeta suman nivel y año.
  const materias = teacherPrograms.map(materiaDePrograma)
  const materiaDeTarea = (quiz: (typeof teacherQuizzes)[number]) => {
    const programa = teacherPrograms.find((p) => p.id === quiz.teacherProgramId)
    return programa ? etiquetaDeMateria(materiaDePrograma(programa), materias) : quiz.subjectName
  }

  /** La tarea que está pidiendo confirmación para borrarse, o null. */
  const [borrando, setBorrando] = useState<number | null>(null)

  // N2: corregir en lote las preguntas cuyo tipo no encaja con la consigna.
  const { toast } = useToast()
  const [corrigiendo, setCorrigiendo] = useState<(typeof teacherQuizzes)[number] | null>(null)
  const [bloqueoPlan, setBloqueoPlan] = useState<CuerpoDeBloqueo | null>(null)

  // L1: los cuestionarios del diagnóstico salían mezclados con las tareas.
  const [tipo, setTipo] = useState<FiltroDeTipo>('todas')
  const hayDiagnosticos = teacherQuizzes.some((quiz) => quiz.tipo === 'diagnostico')
  const visibles = filtrarPorTipo(teacherQuizzes, hayDiagnosticos ? tipo : 'todas')

  return (
    <>
      {/* "Mis tareas" junta dos cosas que todavía son secciones separadas:
          las tareas ya armadas y el armado de una nueva. El bloque 3 del
          rediseño parte esta página; hasta entonces se alterna con estos dos. */}
      {(teacherSection === 'cuestionarios' || teacherSection === 'crear') && (
        <div className="flex flex-wrap gap-2">
          <Boton
            variante="secundario"
            aria-pressed={teacherSection === 'cuestionarios'}
            className="aria-pressed:border-texto"
            onClick={() => setTeacherSection('cuestionarios')}
          >
            {PANEL_DOCENTE.tareas.guardadas}
          </Boton>
          <Boton
            variante="secundario"
            aria-pressed={teacherSection === 'crear'}
            className="aria-pressed:border-texto"
            onClick={() => setTeacherSection('crear')}
          >
            {PANEL_DOCENTE.tareas.armar}
          </Boton>
          {/* W1: el banco de preguntas. */}
          <Boton variante="secundario" asChild>
            <Link href="/teacher/banco">{BANCO.abrir}</Link>
          </Boton>
        </div>
      )}

        {teacherSection === 'cuestionarios' && (
          <section className="space-y-4 rounded-lg border border-borde bg-superficie-tarjeta p-4">
            <div className="space-y-3">
              <div className="flex items-center gap-1">
                <h1 className="titulo-l text-texto">{T.titulo}</h1>
                <ComoFunciona guia="armar-una-tarea" soloIcono />
              </div>
              {teacherPrograms.length > 1 && (
                <div role="group" aria-label={T.filtro} className="flex flex-wrap gap-2">
                  <Boton
                    variante="secundario"
                    aria-pressed={quizSubjectFilter === 'all'}
                    className="aria-pressed:border-texto"
                    onClick={() => setQuizSubjectFilter('all')}
                  >
                    {T.todas}
                  </Boton>
                  {teacherPrograms.map((program) => (
                    <Boton
                      key={program.id}
                      variante="secundario"
                      aria-pressed={quizSubjectFilter === `teacher-${program.id}`}
                      className="aria-pressed:border-texto"
                      onClick={() => setQuizSubjectFilter(`teacher-${program.id}`)}
                    >
                      {etiquetaDeMateria(materiaDePrograma(program), materias)}
                    </Boton>
                  ))}
                </div>
              )}
              {hayDiagnosticos && (
                <div role="group" aria-label={T.tipos.etiqueta} className="flex flex-wrap gap-2">
                  {(['todas', 'tarea', 'diagnostico'] as const).map((opcion) => (
                    <Boton
                      key={opcion}
                      variante="secundario"
                      aria-pressed={tipo === opcion}
                      className="aria-pressed:border-texto"
                      onClick={() => setTipo(opcion)}
                    >
                      {T.tipos[opcion]}
                    </Boton>
                  ))}
                </div>
              )}
            </div>

            {revisandoQuiz ? (
              <TeacherQuizReview
                quiz={revisandoQuiz}
                onClose={() => setRevisandoQuiz(null)}
                onSaved={(guardado, info) => {
                  // Si el servidor devolvió una COPIA, el id cambió: la lista se
                  // recarga entera en vez de reemplazar en el lugar, porque
                  // ahora hay un cuestionario más y las asignaciones se movieron.
                  setTeacherQuizzes(
                    info.copiado
                      ? [guardado, ...teacherQuizzes]
                      : teacherQuizzes.map((q) => (q.id === guardado.id ? guardado : q)),
                  )
                  setRevisandoQuiz(guardado)
                }}
              />
            ) : (
            <Tabs defaultValue="guardados">
              <TabsList>
                <TabsTrigger value="guardados">
                  {tareasLeidas ? T.guardadas(teacherQuizzes.length) : T.guardadasSinContar}
                </TabsTrigger>
                <TabsTrigger value="realizados">
                  {tareasLeidas ? T.hechas(performedQuizzes.length) : T.hechasSinContar}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="guardados" className="space-y-3">
                {!tareasLeidas && teacherQuizzes.length === 0 && <EsqueletoListaDeTareas />}
                {tareasLeidas && teacherQuizzes.length === 0 && (
                  <div className="rounded-lg border border-borde p-4">
                    <p className="cuerpo text-texto">{T.vacio.titulo}</p>
                    <p className="cuerpo-s mt-1 text-texto-suave">{T.vacio.detalle}</p>
                    <Boton className="mt-3" onClick={() => setTeacherSection('crear')}>
                      {PANEL_DOCENTE.tareas.armar}
                    </Boton>
                  </div>
                )}
                {tareasLeidas && teacherQuizzes.length > 0 && visibles.length === 0 && (
                  <p className="cuerpo-s text-texto-suave">{T.sinDelTipo}</p>
                )}
                <ul className="grid gap-3 lg:grid-cols-2">
                  {visibles.map((quiz) => (
                    <li key={quiz.id} className="flex flex-col gap-3 rounded-lg border border-borde p-4">
                      <div>
                        {quiz.tipo === 'diagnostico' && (
                          <span className="etiqueta mb-1 inline-block rounded-sm border border-accion-tenue-borde bg-accion-tenue px-2 py-0.5 text-accion">
                            {T.diagnostico}
                          </span>
                        )}
                        <h2 className="cuerpo text-texto">{quiz.title}</h2>
                        <p className="nota text-texto-suave">
                          {materiaDeTarea(quiz)} · {T.preguntas(quiz.questionCount)} · {T.modo[quiz.mode]}
                        </p>
                        <TemasDeTarea temas={quiz.selectedTopics.map((topic) => topic.name)} />
                      </div>

                      {/* N2: lo marcado se corrige de una vez, con antes → después. */}
                      {contarMarcadas(quiz.questions) > 0 && (
                        <Boton variante="secundario" className="self-start border-flojo text-flojo hover:border-flojo hover:text-flojo" onClick={() => setCorrigiendo(quiz)}>
                          {CORREGIR_TIPOS.boton(contarMarcadas(quiz.questions))}
                        </Boton>
                      )}

                      {/* Una sola acción principal por tarea: mandarla. */}
                      <Boton className="self-start" onClick={() => setSharingQuiz(quiz)}>
                        {T.mandar}
                      </Boton>

                      <div className="flex flex-wrap gap-2">
                        <Boton variante="secundario" onClick={() => setRevisandoQuiz(quiz)}>
                          {T.revisar}
                        </Boton>
                        <Boton variante="secundario" onClick={() => handlePreviewQuiz(quiz)}>
                          {T.verComoAlumno}
                        </Boton>
                        <Boton variante="secundario" onClick={() => handleRunQuiz(quiz)}>
                          {T.probar}
                        </Boton>
                        <ExportarMoodle exportando={exportingQuizId === quiz.id} onExportar={(formato) => handleExportQuiz(quiz, formato)} />
                        {/* Borrar no se deshace: pide confirmación en el lugar. */}
                        {borrando === quiz.id ? (
                          <>
                            <Boton
                              variante="secundario"
                              className="border-flojo text-flojo hover:border-flojo hover:text-flojo"
                              onClick={() => {
                                setBorrando(null)
                                void handleDeleteQuiz(quiz.id)
                              }}
                            >
                              {T.confirmarBorrado}
                            </Boton>
                            <Boton variante="secundario" onClick={() => setBorrando(null)}>
                              {T.noBorrar}
                            </Boton>
                          </>
                        ) : (
                          <Boton variante="secundario" onClick={() => setBorrando(quiz.id)}>
                            {T.borrar}
                          </Boton>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </TabsContent>
              <TabsContent value="realizados" className="space-y-3">
                {tareasLeidas && performedQuizzes.length === 0 && (
                  <p className="cuerpo-s text-texto-suave">{T.sinHechas}</p>
                )}
                <ul className="grid gap-3 lg:grid-cols-2">
                  {performedQuizzes.map((attempt) => (
                    <li key={String(attempt.id)} className="rounded-lg border border-borde p-4">
                      <p className="cuerpo text-texto">{String(attempt.subject)}</p>
                      <p className="nota text-texto-suave">
                        {T.nota(String(attempt.score))} ·{' '}
                        {new Date(String(attempt.completed_at)).toLocaleDateString('es-AR')}
                      </p>
                    </li>
                  ))}
                </ul>
              </TabsContent>
            </Tabs>
            )}
          </section>
        )}

      {corrigiendo && (
        <CorregirTiposDialog
          quizId={corrigiendo.id}
          preguntas={corrigiendo.questions}
          abierto={Boolean(corrigiendo)}
          onOpenChange={(abierto) => !abierto && setCorrigiendo(null)}
          alBloquear={setBloqueoPlan}
          alAplicar={async (nuevas, cambios) => {
            const resultado = await guardarPreguntas(corrigiendo, nuevas)
            if (!resultado.ok) {
              if ('bloqueo' in resultado) {
                setCorrigiendo(null)
                setBloqueoPlan(resultado.bloqueo)
                return
              }
              return resultado.error
            }
            // Con copia, el id cambió: la copia entra a la lista y el original
            // (que sostiene los intentos viejos) se queda.
            setTeacherQuizzes(
              resultado.copiado
                ? [resultado.quiz, ...teacherQuizzes]
                : teacherQuizzes.map((q) => (q.id === resultado.quiz.id ? resultado.quiz : q)),
            )
            toast({
              title: CORREGIR_TIPOS.aplicado(cambios),
              description: resultado.copiado ? CORREGIR_TIPOS.aplicadoCopia : undefined,
            })
          }}
        />
      )}
      <DialogoDeLimite bloqueo={bloqueoPlan} onCerrar={() => setBloqueoPlan(null)} />

      <ShareQuizDialog
        open={Boolean(sharingQuiz)}
        onOpenChange={(open) => {
          if (open) return
          setSharingQuiz(null)
          // Puede haberse mandado una tarea: que los primeros pasos se pongan al día.
          setVersion((actual) => actual + 1)
        }}
        quiz={sharingQuiz}
        onExportMoodle={(formato) => sharingQuiz && handleExportQuiz(sharingQuiz, formato)}
        isExporting={exportingQuizId === sharingQuiz?.id}
      />
    </>
  )
}

/**
 * Los temas de una tarea, en su tarjeta: los primeros con su nombre corto y el
 * resto contado. Escritos enteros y separados por coma eran nueve renglones a
 * 390 px antes de llegar al botón de mandarla, que es para lo que está la
 * tarjeta. El detalle queda en `title` y para lector de pantalla.
 */
function TemasDeTarea({ temas }: { temas: string[] }) {
  const { visibles, resto, completo } = resumirTemas(temas)
  if (visibles.length === 0) return null
  return (
    <p className="nota mt-1 text-texto-suave" title={completo}>
      <span aria-hidden="true">
        {visibles.join(' · ')}
        {resto > 0 && <span className="whitespace-nowrap"> {T.masTemas(resto)}</span>}
      </span>
      <span className="sr-only">{completo}</span>
    </p>
  )
}
