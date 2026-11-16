'use client'

import { Boton } from '@/components/sistema/boton'
import { PANEL_DOCENTE } from '@/lib/textos'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Pencil, Trash2, PlayCircle, Eye, Download, Users } from 'lucide-react'
import { TeacherQuizReview } from '@/components/teacher-quiz-review'
import { ShareQuizDialog } from '@/components/share-quiz-dialog'
import type { PanelDocente } from '@/components/docente/use-panel-docente'

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
    expandedQuizId,
    setExpandedQuizId,
    revisandoQuiz,
    setRevisandoQuiz,
    exportingQuizId,
    sharingQuiz,
    setSharingQuiz,
    teacherPrograms,
    teacherQuizzes,
    teacherSection,
    setTeacherQuizzes,
    setTeacherSection,
  } = panel

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
        </div>
      )}

        {teacherSection === 'cuestionarios' && (
          <Card className="p-4 rounded-2xl border border-border/60 bg-card/75 backdrop-blur-md shadow-[0_6px_30px_rgba(23,23,23,0.06)] space-y-3">
            <div className="space-y-2">
              <h2 className="font-bold">Mis cuestionarios</h2>
              <p className="text-sm text-muted-foreground">Se muestran todos tus cuestionarios. Usa el filtro para ver una materia puntual.</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={quizSubjectFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setQuizSubjectFilter('all')}
                >
                  Todas las materias
                </Button>
                {teacherPrograms.map((program) => (
                  <Button
                    key={program.id}
                    variant={quizSubjectFilter === `teacher-${program.id}` ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setQuizSubjectFilter(`teacher-${program.id}`)}
                  >
                    {program.subjectName}
                  </Button>
                ))}
              </div>
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
                <TabsTrigger value="guardados">Guardados ({teacherQuizzes.length})</TabsTrigger>
                <TabsTrigger value="realizados">Realizados ({performedQuizzes.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="guardados" className="space-y-2">
                {teacherQuizzes.length === 0 && <p className="text-sm text-muted-foreground">No hay cuestionarios guardados para este filtro.</p>}
                <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
                  {teacherQuizzes.map((quiz) => (
                    <Card key={quiz.id} className="p-3 border self-start">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold">{quiz.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {quiz.subjectName} | {quiz.mode} | {quiz.questionCount} preguntas | {quiz.status === 'pending_share' ? 'PENDIENTE_COMPARTIR' : 'GUARDADO'}
                            </p>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => setExpandedQuizId((prev) => (prev === quiz.id ? null : quiz.id))}>
                            <Eye className="w-4 h-4 mr-1" />
                            Ver detalle
                          </Button>
                        </div>

                        {expandedQuizId === quiz.id && (
                          <div className="space-y-1 text-sm bg-muted/40 rounded-md p-2">
                            <p><strong>Temas:</strong> {quiz.selectedTopics.map((topic) => topic.name).join(', ') || 'Sin temas'}</p>
                            <p><strong>Creado:</strong> {new Date(quiz.createdAt).toLocaleString('es-AR')}</p>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => setRevisandoQuiz(quiz)}>
                            <Pencil className="w-4 h-4 mr-1" />
                            Revisar y editar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handlePreviewQuiz(quiz)}>
                            <Eye className="w-4 h-4 mr-1" />
                            Previsualizar
                          </Button>
                          <Button size="sm" onClick={() => handleRunQuiz(quiz)}>
                            <PlayCircle className="w-4 h-4 mr-1" />
                            Realizar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={exportingQuizId === quiz.id}
                            onClick={() => handleExportQuiz(quiz)}
                          >
                            <Download className="w-4 h-4 mr-1" />
                            {exportingQuizId === quiz.id ? 'Exportando...' : 'Exportar Moodle'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setSharingQuiz(quiz)}>
                            <Users className="w-4 h-4 mr-1" />
                            Asignar a un aula
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDeleteQuiz(quiz.id)}>
                            <Trash2 className="w-4 h-4 mr-1" />
                            Eliminar
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="realizados" className="space-y-2">
                {performedQuizzes.length === 0 && <p className="text-sm text-muted-foreground">No hay cuestionarios realizados para este filtro.</p>}
                <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
                  {performedQuizzes.map((attempt) => (
                    <Card key={String(attempt.id)} className="p-3 border">
                      <p className="font-semibold">{String(attempt.subject)}</p>
                      <p className="text-xs text-muted-foreground">
                        {String(attempt.mode)} | Nota: {String(attempt.score)} | Fecha: {new Date(String(attempt.completed_at)).toLocaleString('es-AR')}
                      </p>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
            )}
          </Card>
        )}

      <ShareQuizDialog
        open={Boolean(sharingQuiz)}
        onOpenChange={(open) => !open && setSharingQuiz(null)}
        quiz={sharingQuiz}
        onExportMoodle={() => sharingQuiz && handleExportQuiz(sharingQuiz)}
        isExporting={exportingQuizId === sharingQuiz?.id}
        onGoToClassrooms={() => {
          setSharingQuiz(null)
          setTeacherSection('aulas')
        }}
      />
    </>
  )
}
