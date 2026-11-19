import { extractGradoNumber } from '@/lib/grado'
import type {
  Nivel,
  PedagogyProfile,
  ProgramCreatedFrom,
  Subject,
  TeacherProgram,
  ProgramUnit,
  ProgramTopic,
  SubjectColorName,
  SubjectIconName,
} from '@/lib/types'

export const NIVEL_VALUES: Nivel[] = ['Primario', 'Secundario', 'Superior']

const CREATED_FROM_VALUES: ProgramCreatedFrom[] = ['upload', 'curriculum', 'manual']

export function parseNivel(value: unknown): Nivel | null {
  const candidate = String(value ?? '').trim()
  return (NIVEL_VALUES as string[]).includes(candidate) ? (candidate as Nivel) : null
}

export function parseCreatedFrom(value: unknown, fallback: ProgramCreatedFrom = 'upload'): ProgramCreatedFrom {
  const candidate = String(value ?? '').trim()
  return (CREATED_FROM_VALUES as string[]).includes(candidate) ? (candidate as ProgramCreatedFrom) : fallback
}

/**
 * nivel/grado are now first-class columns, but pedagogy_profile.level and
 * .academicYear are still what feeds the AI prompt (see
 * pedagogyProfileToContext) and what the old dashboard filters read. Rather
 * than make the wizard fill the same data twice — or 400 when it doesn't —
 * mirror the columns into the profile whenever the profile fields are blank.
 * 'degree' only means something for Superior, so it gets a placeholder below.
 */
export function withDerivedPedagogyProfile(
  profile: PedagogyProfile,
  nivel: Nivel | null,
  grado: string | null
): PedagogyProfile {
  const level = profile?.level?.trim() || nivel || ''
  const academicYear = profile?.academicYear?.trim() || grado || ''
  const degree = profile?.degree?.trim() || (nivel && nivel !== 'Superior' ? 'No aplica' : '')

  return { ...profile, level, academicYear, degree }
}

type LegacySubtopic = { id?: string; name?: string }
type LegacyProgramTopic = ProgramTopic & { subtopics?: LegacySubtopic[] }

/**
 * Topics saved before the subject wizard have no origin — they were all typed
 * or AI-extracted from an uploaded file, which is what 'custom' means.
 */
function normalizeTopicOrigin(input: unknown): Pick<ProgramTopic, 'origin' | 'sourceEje'> {
  const topic = (input ?? {}) as { origin?: unknown; sourceEje?: unknown }
  const origin: ProgramTopic['origin'] = topic.origin === 'curriculum' ? 'curriculum' : 'custom'
  const sourceEje = typeof topic.sourceEje === 'string' ? topic.sourceEje.trim() : ''

  return origin === 'curriculum' && sourceEje ? { origin, sourceEje } : { origin }
}

export function normalizeUnits(units: ProgramUnit[] | unknown): ProgramUnit[] {
  if (!Array.isArray(units)) {
    return []
  }

  return units.map((unit, unitIndex) => {
    const safeTopics = Array.isArray(unit?.topics) ? unit.topics : []

    return {
      id: unit?.id || `tp-u-${unitIndex + 1}`,
      name: unit?.name || `Unidad ${unitIndex + 1}`,
      topics: safeTopics.flatMap((topic: LegacyProgramTopic, topicIndex: number) => {
        if (Array.isArray(topic?.subtopics) && topic.subtopics.length > 0) {
          return topic.subtopics
            .map((subtopic, subIndex) => {
              const name = String(subtopic?.name || '').trim()
              if (!name) return null

              return {
                id: String(subtopic?.id || `tp-u-${unitIndex + 1}-t-${topicIndex + 1}-legacy-${subIndex + 1}`),
                name,
                ...normalizeTopicOrigin(subtopic),
              }
            })
            .filter((value): value is ProgramTopic => value !== null)
        }

        const name = String(topic?.name || '').trim()
        if (!name) {
          return []
        }

        return [
          {
            id: String(topic?.id || `tp-u-${unitIndex + 1}-t-${topicIndex + 1}`),
            name,
            ...normalizeTopicOrigin(topic),
          },
        ]
      }),
    }
  })
}

/** Values the old form let through that carry no information for the model. */
const PEDAGOGY_PLACEHOLDERS = new Set([
  'no especificado',
  'no especificada',
  'no aplica',
  'sin especificar',
  'ninguno',
  'ninguna',
  'n/a',
  '-',
  '--',
])

function meaningful(value: string | undefined | null): string {
  const trimmed = String(value ?? '').trim()
  return PEDAGOGY_PLACEHOLDERS.has(trimmed.toLowerCase()) ? '' : trimmed
}

function sameText(a: string, b: string): boolean {
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
  return Boolean(a) && normalize(a) === normalize(b)
}

/**
 * Builds the "PREFERENCIAS PEDAGOGICAS DEL DOCENTE" block that generate-quiz
 * and explain-error paste into the prompt.
 *
 * Two things it deliberately does NOT do:
 * - It never emits placeholder values ("No especificado"), which the old
 *   upload form required and which only added noise to the prompt.
 * - It drops 'Carrera' when it merely repeats the level or the year. Programs
 *   created before nivel/grado were real columns often have the year typed
 *   into that box, which produced the nonsensical "Carrera: 4to Año".
 *
 * The year is labelled 'Grado/Año' (not the old 'Ano') because that is the
 * label generate-quiz greps for when the caller doesn't pass grado explicitly
 * — with the old label a teacher's quiz silently lost its grade level.
 */
export function pedagogyProfileToContext(profile: PedagogyProfile): string {
  const level = meaningful(profile?.level)
  const academicYear = meaningful(profile?.academicYear)
  const degree = meaningful(profile?.degree)
  const complexity = meaningful(profile?.complexity)
  const assessmentStyle = meaningful(profile?.assessmentStyle)
  const methodology = meaningful(profile?.methodology)

  const degreeIsRedundant =
    sameText(degree, academicYear) ||
    sameText(degree, level) ||
    // "4to" vs "4to Año": same year, different spelling.
    (extractGradoNumber(degree) !== null && extractGradoNumber(degree) === extractGradoNumber(academicYear))

  const lines: string[] = []
  if (level) lines.push(`Nivel: ${level}`)
  if (academicYear) lines.push(`Grado/Año: ${academicYear}`)
  if (degree && !degreeIsRedundant) lines.push(`Carrera: ${degree}`)
  if (complexity) lines.push(`Complejidad: ${complexity}`)
  if (assessmentStyle) lines.push(`Enfoque: ${assessmentStyle}`)
  if (methodology) lines.push(`Metodologia: ${methodology}`)

  return lines.join('\n')
}

export function teacherProgramToSubject(program: TeacherProgram): Subject {
  const id = Number((program as TeacherProgram & { id?: number | string }).id) || 0
  const subjectName =
    (program as TeacherProgram & { subject_name?: string }).subjectName ||
    (program as TeacherProgram & { subject_name?: string }).subject_name ||
    'Materia docente'
  const pedagogyProfile =
    (program as TeacherProgram & { pedagogy_profile?: PedagogyProfile }).pedagogyProfile ||
    (program as TeacherProgram & { pedagogy_profile?: PedagogyProfile }).pedagogy_profile
  const iconName =
    (program as TeacherProgram & { iconName?: SubjectIconName; icon_name?: SubjectIconName }).iconName ||
    (program as TeacherProgram & { iconName?: SubjectIconName; icon_name?: SubjectIconName }).icon_name ||
    'book-open'
  const colorName =
    (program as TeacherProgram & { colorName?: SubjectColorName; color_name?: SubjectColorName }).colorName ||
    (program as TeacherProgram & { colorName?: SubjectColorName; color_name?: SubjectColorName }).color_name ||
    'teal'

  const normalizedUnits = normalizeUnits((program as TeacherProgram & { units: ProgramUnit[] | unknown }).units)

  return {
    id: `teacher-${id}`,
    name: subjectName,
    icon: iconName,
    color: colorName,
    progress: 0,
    source: 'teacher',
    programId: id,
    pedagogyProfile,
    units: normalizedUnits.map((unit) => ({
      id: unit.id,
      name: unit.name,
      topics: unit.topics.map((topic) => ({
        id: topic.id,
        name: topic.name,
        completed: false,
      })),
    })),
  }
}
