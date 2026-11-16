'use client'

import { SubjectContent } from '@/components/subject-content'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { BookOpen, Plus, Filter, Pencil, X, AlertTriangle, FilePlus, Sparkles } from 'lucide-react'
import { TeacherSubjectWizard } from '@/components/teacher-subject-wizard'
import { TeacherOnboardingModal } from '@/components/teacher-onboarding-modal'
import { SUBJECT_ICON_COMPONENTS } from '@/lib/subject-icons'
import type { TeacherProgram } from '@/lib/types'
import { ASSESSMENT_STYLE_LABELS, type PanelDocente } from '@/components/docente/use-panel-docente'
import { EsqueletoTarjetasDeMateria } from '@/components/docente/esqueletos'
import { contar } from '@/lib/textos'

/**
 * "Mis materias": el listado de materias del docente, el armado de una tarea
 * sobre la materia elegida, y los diálogos que cuelgan de una materia (crear,
 * editar, ver el detalle, borrar, y los caminos para armar el temario).
 *
 * Los diálogos se montan siempre, esté o no a la vista la sección: el primer
 * hito del onboarding los abre desde cualquier pestaña.
 *
 * Presentación movida tal cual desde app/(app)/teacher/page.tsx. El wizard de
 * temario se rehace en el bloque 4 del rediseño.
 */
export function MisMaterias({ panel }: { panel: PanelDocente }) {
  const {
    dismissOnboarding,
    selectedSubject,
    handleSubjectChange,
    activeTeacherProgram,
    handleDeleteActiveProgram,
    activeSubject,
    showCreateWizard,
    setShowCreateWizard,
    showEditWizard,
    setShowEditWizard,
    showOnboardingModal,
    setShowOnboardingModal,
    initialWizardPath,
    setInitialWizardPath,
    showDeleteDialog,
    setShowDeleteDialog,
    showDetailDialog,
    setShowDetailDialog,
    showOnlyMySubjects,
    setShowOnlyMySubjects,
    showFilters,
    setShowFilters,
    teacherPrograms,
    materiasLeidas,
    teacherProgramFilters,
    teacherSection,
    addTeacherProgram,
    updateTeacherProgram,
    setTeacherProgramFilters,
    setTeacherSection,
  } = panel

  /**
   * `showCreateQuizAction` is on inside "Mis materias": starting a quiz used to
   * mean jumping to a separate section and picking the materia all over again,
   * so the action now lives on the materia itself.
   */
  const renderTeacherProgramCard = (program: TeacherProgram, { showCreateQuizAction = false } = {}) => {
    const subjectId = `teacher-${program.id}`
    const isSelected = activeSubject === subjectId
    const Icon = SUBJECT_ICON_COMPONENTS[program.iconName] ?? BookOpen
    // Programs created before the wizard have no nivel/grado — stage 2 needs
    // both to match a classroom, so nudge the teacher to fill them in.
    const needsLevelData = !program.nivel || !program.grado

    return (
      <Card
        key={program.id}
        className={`relative w-full p-4 pt-4 min-h-[170px] border-2 cursor-pointer transition-all ${isSelected ? 'border-accion bg-accion-tenue' : 'border-border hover:border-primary/40'}`}
        onClick={() => handleSubjectChange(subjectId)}
        onDoubleClick={() => {
          handleSubjectChange(subjectId)
          setShowDetailDialog(true)
        }}
      >
        {/* El lápiz y la X van ADENTRO de la tarjeta, en sus esquinas. Estaban
            colgados afuera (-top-3 / -left-3) y pisaban el título de la sección
            y la tarjeta de arriba. Siguen midiendo 44 px, que es el mínimo
            táctil; el ícono de la materia va centrado y no los toca. */}
        <button
          type="button"
          className="absolute left-1 top-1 flex size-11 items-center justify-center rounded-md border border-transparent text-texto-suave hover:border-borde-fuerte hover:text-texto"
          onClick={(event) => {
            event.stopPropagation()
            handleSubjectChange(subjectId)
            setShowEditWizard(true)
          }}
          aria-label="Editar materia"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          type="button"
          className="absolute right-1 top-1 flex size-11 items-center justify-center rounded-md border border-transparent text-texto-suave hover:border-borde-fuerte hover:text-texto"
          onClick={(event) => {
            event.stopPropagation()
            handleSubjectChange(subjectId)
            setShowDeleteDialog(true)
          }}
          aria-label="Eliminar materia"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center text-center gap-2 pt-1">
          <div className="w-11 h-11 rounded-md bg-superficie-suave text-accion flex items-center justify-center">
            <Icon className="w-5 h-5" />
          </div>
          <p className="font-semibold leading-snug whitespace-normal break-words text-sm sm:text-[15px] w-full px-1">
            {program.subjectName}
          </p>
          {needsLevelData ? (
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-1 text-[11px] font-semibold text-flojo bg-flojo-fondo rounded-sm px-2"
              onClick={(event) => {
                event.stopPropagation()
                handleSubjectChange(subjectId)
                setShowEditWizard(true)
              }}
            >
              <AlertTriangle className="w-3 h-3" />
              Completá nivel y año
            </button>
          ) : (
            <p className="text-xs text-muted-foreground">
              {program.nivel} · {program.grado}
            </p>
          )}
          <p className="text-xs text-muted-foreground">{contar(program.units.length, 'unidad', 'unidades')}</p>

          {showCreateQuizAction && (
            <Button
              size="sm"
              className="mt-1 w-full rounded-xl font-bold text-xs"
              onClick={(event) => {
                event.stopPropagation()
                handleSubjectChange(subjectId)
                setTeacherSection('crear')
              }}
            >
              <FilePlus className="w-3.5 h-3.5 mr-1.5" />
              Crear cuestionario
            </Button>
          )}
        </div>
      </Card>
    )
  }

  return (
    <>
        {teacherSection === 'materias' && (
          <Card className="p-4 rounded-lg border border-borde bg-superficie-tarjeta space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => setShowCreateWizard(true)} className="rounded-xl font-bold">
                <Plus className="w-4 h-4 mr-2" />
                Crear materia
              </Button>
              <Button
                variant={showFilters ? 'default' : 'outline'}
                onClick={() => setShowFilters((prev) => !prev)}
              >
                <Filter className="w-4 h-4 mr-2" />
                Filtros
              </Button>
            </div>

            {showFilters && (
              <div className="space-y-3">
                <Button
                  variant={showOnlyMySubjects ? 'default' : 'outline'}
                  onClick={() => setShowOnlyMySubjects((prev) => !prev)}
                >
                  Mostrar solo mis materias
                </Button>
                <div className="grid sm:grid-cols-2 gap-2">
                  <input
                    className="border rounded-md px-3 py-2 bg-background text-sm"
                    placeholder="Filtrar por nombre"
                    value={teacherProgramFilters.name}
                    onChange={(event) => setTeacherProgramFilters({ name: event.target.value })}
                  />
                  <input
                    className="border rounded-md px-3 py-2 bg-background text-sm"
                    placeholder="Filtrar por nivel"
                    value={teacherProgramFilters.level}
                    onChange={(event) => setTeacherProgramFilters({ level: event.target.value })}
                  />
                  <input
                    className="border rounded-md px-3 py-2 bg-background text-sm"
                    placeholder="Filtrar por carrera"
                    value={teacherProgramFilters.degree}
                    onChange={(event) => setTeacherProgramFilters({ degree: event.target.value })}
                  />
                  <select
                    className="border rounded-md px-3 py-2 bg-background text-sm"
                    value={teacherProgramFilters.mode}
                    onChange={(event) => setTeacherProgramFilters({ mode: event.target.value as '' | 'teorico' | 'practico' | 'mixto' })}
                  >
                    <option value="">Modo (todos)</option>
                    <option value="teorico">Teorico</option>
                    <option value="practico">Practico</option>
                    <option value="mixto">Mixto</option>
                  </select>
                  <input
                    className="border rounded-md px-3 py-2 bg-background text-sm sm:col-span-2"
                    type="date"
                    value={teacherProgramFilters.createdAfter}
                    onChange={(event) => setTeacherProgramFilters({ createdAfter: event.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Mis materias</h2>
                <Button variant="ghost" size="sm" onClick={() => setShowOnboardingModal(true)} className="text-xs h-7 text-primary hover:text-primary hover:bg-primary/10">
                  <Sparkles className="w-3.5 h-3.5 mr-1" />
                  Ayuda para crear
                </Button>
              </div>
              {/* "Todavía no cargaste materias" es un hecho: no se dice hasta
                  que la primera lectura terminó. Mientras tanto, el esqueleto. */}
              {!materiasLeidas && teacherPrograms.length === 0 ? (
                <EsqueletoTarjetasDeMateria />
              ) : (
                <>
                  {teacherPrograms.length === 0 && (
                    <p className="text-sm text-muted-foreground">Todavia no cargaste materias propias.</p>
                  )}
                  <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
                    {teacherPrograms.map((program) => renderTeacherProgramCard(program, { showCreateQuizAction: true }))}
                  </div>
                </>
              )}
            </div>
          </Card>
        )}

        {teacherSection === 'crear' && (
          <Card className="p-4 rounded-lg border border-borde bg-superficie-tarjeta space-y-4">
            {/* Arriving from a materia's own "Crear cuestionario" button means
                the materia is already picked — showing the picker again would
                be the extra step this was meant to remove. */}
            {!selectedSubject && (
              <div className="space-y-3">
                <h2 className="text-lg font-bold">Elegí una materia</h2>
                <p className="text-sm text-muted-foreground">Elegí una de tus materias para armar el cuestionario.</p>

                {teacherPrograms.length === 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Todavia no cargaste materias propias.</p>
                    <Button onClick={() => setShowCreateWizard(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Crear materia
                    </Button>
                  </div>
                )}

                {teacherPrograms.length > 0 && (
                  <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
                    {teacherPrograms.map((program) => renderTeacherProgramCard(program))}
                  </div>
                )}
              </div>
            )}

            {selectedSubject && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold truncate">Cuestionario de {selectedSubject.name}</h2>
                    <p className="text-sm text-muted-foreground">Elegí los temas que va a cubrir.</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => handleSubjectChange(null)}
                  >
                    Cambiar materia
                  </Button>
                </div>
                <SubjectContent subject={selectedSubject} />
              </div>
            )}
          </Card>
        )}

      <TeacherSubjectWizard
        open={showCreateWizard}
        onOpenChange={(open) => {
          setShowCreateWizard(open)
          if (!open) setInitialWizardPath(null)
        }}
        onProgramCreated={addTeacherProgram}
        initialPath={initialWizardPath}
      />

      <TeacherSubjectWizard
        open={showEditWizard}
        onOpenChange={setShowEditWizard}
        onProgramCreated={addTeacherProgram}
        onProgramUpdated={(program) => updateTeacherProgram(program.id, program)}
        programToEdit={activeTeacherProgram}
      />

      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {activeTeacherProgram && (
            <>
              <DialogHeader>
                <DialogTitle>{activeTeacherProgram.subjectName}</DialogTitle>
                <DialogDescription>
                  {activeTeacherProgram.nivel ?? 'Sin nivel'} · {activeTeacherProgram.grado ?? 'Sin año'}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid sm:grid-cols-3 gap-3 text-sm">
                  <div className="rounded-xl border p-3">
                    <p className="text-xs text-muted-foreground">Complejidad</p>
                    <p className="font-semibold">{activeTeacherProgram.pedagogyProfile.complexity || 'No especificado'}</p>
                  </div>
                  <div className="rounded-xl border p-3">
                    <p className="text-xs text-muted-foreground">Enfoque</p>
                    <p className="font-semibold">
                      {ASSESSMENT_STYLE_LABELS[activeTeacherProgram.pedagogyProfile.assessmentStyle] ||
                        activeTeacherProgram.pedagogyProfile.assessmentStyle ||
                        'No especificado'}
                    </p>
                  </div>
                  <div className="rounded-xl border p-3">
                    <p className="text-xs text-muted-foreground">Unidades</p>
                    <p className="font-semibold">{contar(activeTeacherProgram.units.length, 'unidad', 'unidades')}</p>
                  </div>
                </div>

                {activeTeacherProgram.pedagogyProfile.methodology && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground">Metodología de enseñanza</p>
                    <p className="text-sm">{activeTeacherProgram.pedagogyProfile.methodology}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">Temario completo</p>
                  {activeTeacherProgram.units.map((unit, index) => (
                    <div key={unit.id} className="rounded-xl border p-3 space-y-2">
                      <p className="font-semibold text-sm">
                        {index + 1}. {unit.name}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {unit.topics.map((topic) => (
                          <Badge key={topic.id} variant={topic.origin === 'curriculum' ? 'secondary' : 'outline'} className="text-xs">
                            {topic.name}
                          </Badge>
                        ))}
                        {unit.topics.length === 0 && (
                          <p className="text-xs text-muted-foreground">Sin temas.</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {activeTeacherProgram.units.length === 0 && (
                    <p className="text-sm text-muted-foreground">Esta materia todavía no tiene unidades cargadas.</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowDetailDialog(false)
                    setShowEditWizard(true)
                  }}
                >
                  Editar materia
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Esta seguro que desea eliminar esta materia?</AlertDialogTitle>
            <AlertDialogDescription>
              Una vez realizada esta accion no puede volverse atras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-texto-sobre-accion hover:bg-destructive/90" onClick={handleDeleteActiveProgram}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TeacherOnboardingModal
        open={showOnboardingModal}
        onOpenChange={(next) => {
          if (next) setShowOnboardingModal(true)
          else dismissOnboarding()
        }}
        onSelectPath={(path) => {
          dismissOnboarding()
          setInitialWizardPath(path)
          setShowCreateWizard(true)
        }}
      />
    </>
  )
}
