// Types for MaestrIA Application

export interface Subject {
  id: string
  name: string
  icon: string
  color: string
  units: Unit[]
  progress: number
  source?: 'core' | 'teacher'
  programId?: number
  pedagogyProfile?: PedagogyProfile
}

export interface Unit {
  id: string
  name: string
  topics: Topic[]
}

export interface Topic {
  id: string
  name: string
  group?: string
  completed: boolean
}

/**
 * The set of question types the quiz engine, AI generation, and the Moodle
 * GIFT exporter know how to handle. Adding a new type (essay, matching,
 * ordering...) means: one new variant here, one new Zod schema in
 * generate-quiz, one new case in components/quiz-answer-inputs, one new case
 * in lib/moodle-export.ts's GIFT builder — no other file needs to change.
 */
export type QuestionType = 'multiple_choice' | 'short_answer' | 'true_false' | 'numeric'

interface BaseQuestion {
  id: string
  topic: string
  topicName: string
  question: string
  explanation: string
}

export interface MultipleChoiceQuestion extends BaseQuestion {
  type: 'multiple_choice'
  options: string[]
  correctAnswer: number
}

export interface ShortAnswerQuestion extends BaseQuestion {
  type: 'short_answer'
  /** Accepted alternate phrasings; grading is AI-assisted, not exact match. */
  acceptedAnswers: string[]
}

export interface TrueFalseQuestion extends BaseQuestion {
  type: 'true_false'
  correctAnswer: boolean
}

export interface NumericQuestion extends BaseQuestion {
  type: 'numeric'
  correctAnswer: number
  /** Absolute tolerance for correctness; 0/omitted means exact match. */
  tolerance?: number
}

export type Question = MultipleChoiceQuestion | ShortAnswerQuestion | TrueFalseQuestion | NumericQuestion

export interface QuizConfig {
  subject: string
  subjectName: string
  nivel?: string
  grado?: string
  difficulty?: 'basico' | 'intermedio' | 'avanzado'
  topics: { id: string; name: string }[]
  mode: 'teorico' | 'practico' | 'mixto'
  questionCount: number
  pedagogyContext?: string
  previewOnly?: boolean
  misconceptionContext?: string
  /** Types to request from generate-quiz. Omit for multiple_choice-only (default, unchanged behavior). */
  questionTypes?: QuestionType[]
  /** Set when the quiz is being run inside an aula, so the attempt is attributed to it. */
  classroomId?: number
  /** Set only for an assigned cuestionario; enforces the deadline and attempt cap. */
  assignmentId?: number
}

interface BaseAnswer {
  questionId: string
  questionText: string
  isCorrect: boolean
  topic: string
  topicName: string
  explanation: string
  /**
   * Tercer estado, además de correcta e incorrecta: **no se pudo corregir**.
   *
   * Ausente o `'graded'` significa que la corrección corrió y `isCorrect` vale.
   * `'ungraded'` significa que no corrió — hoy sólo pasa en `short_answer`,
   * cuando `/api/quiz/grade-short-answer` no contesta. En ese caso `isCorrect`
   * queda en `false` por el tipo, pero **no significa incorrecta**: significa
   * "no sabemos", y ningún cálculo de nota puede leerlo como un error.
   *
   * Es opcional a propósito. Los otros tres tipos de pregunta se corrigen en el
   * proceso y nunca quedan sin calificar, y las respuestas ya guardadas no
   * traen el campo — las dos cosas se leen como `'graded'`, que es lo que eran.
   *
   * NO leer este campo a mano: usar `countsAsCorrect` / `countsAsIncorrect` de
   * `lib/answer-grading.ts`. El bug original fue exactamente un `!a.isCorrect`
   * suelto contando como error algo que nadie había corregido.
   */
  gradingStatus?: 'graded' | 'ungraded'
}

export interface MultipleChoiceAnswer extends BaseAnswer {
  type: 'multiple_choice'
  options: string[]
  selectedAnswer: number
  correctAnswer: number
}

export interface ShortAnswerAnswer extends BaseAnswer {
  type: 'short_answer'
  selectedText: string
  acceptedAnswers: string[]
}

export interface TrueFalseAnswer extends BaseAnswer {
  type: 'true_false'
  selectedAnswer: boolean
  correctAnswer: boolean
}

export interface NumericAnswer extends BaseAnswer {
  type: 'numeric'
  selectedValue: number
  correctAnswer: number
  tolerance?: number
}

export type Answer = MultipleChoiceAnswer | ShortAnswerAnswer | TrueFalseAnswer | NumericAnswer

export interface QuizResult {
  /**
   * Nota de 0 a 10 sobre las respuestas **corregidas**. Las que quedaron sin
   * calificar no entran ni en el numerador ni en el denominador, así que un
   * cuestionario de 10 con 2 sin calificar se puntúa sobre 8.
   */
  score: number
  /** Preguntas del cuestionario. NO es el denominador de `score`. */
  total: number
  percentage: number
  incorrectTopics: string[]
  answers: Answer[]
  correctAnswers: Answer[]
  incorrectAnswers: Answer[]
  /**
   * Las que no se pudieron corregir. Si viene con elementos, `score` está
   * calculado sobre menos preguntas que `total` y hay que decírselo al alumno.
   */
  ungradedAnswers: Answer[]
}

export interface StudentTip {
  id?: number
  userId?: string
  subject: string
  topicId: string
  topicName: string
  misconceptionType: string
  tip: string
  resolved?: boolean
  createdAt?: string
}

export interface UserProgress {
  streak: number
  lastAttemptDate: string | null
  weakPoints: WeakPoint[]
  subjectProgress: Record<string, number>
  subjectAverages: Record<string, number>
  subjectAttemptCounts: Record<string, number>
  usedQuestionIds: string[]
  tips?: StudentTip[]
}

export interface WeakPoint {
  topic: string
  topicName: string
  subject: string
  count: number
  misconceptionType?: string
  lastTip?: string
  nivel?: string
  grado?: string
}

export interface QuizAttempt {
  id: string
  subject: string
  mode: string
  topics: string[]
  total_questions: number
  correct_answers: number
  score: number
  completed_at: string
}

export interface TopicMastery {
  subject: string
  topic_id: string
  topic_name: string
  max_score: number
  attempts_count: number
  last_attempt_at: string
}

/**
 * Shape returned by /api/quiz/attempt/[id] (a saved quiz_answers row).
 * question_type defaults to 'multiple_choice' for rows written before
 * migration 013. For multiple_choice, options/selected_answer/correct_answer
 * are populated (legacy columns, still written for backward-compat reads);
 * for any other type, answer_payload carries the type-specific fields
 * (see lib/types.ts QuestionType doc comment for the shape per type).
 */
export interface AttemptAnswer {
  id: string
  question_id: string
  question_text: string
  question_type: QuestionType
  options?: string[]
  selected_answer?: number
  correct_answer?: number
  answer_payload?: Record<string, unknown> | null
  is_correct: boolean
  explanation: string
  topic_name: string
}

export type UserRole = 'ALUMNO' | 'DOCENTE'

/**
 * Educational levels the curriculum table is keyed by. Declared here (and
 * re-exported from lib/nivel-options for the UI) so server code can use it
 * without pulling the icon components that file imports into the bundle.
 */
export type Nivel = 'Primario' | 'Secundario' | 'Superior'

export interface PedagogyProfile {
  level: string
  degree: string
  academicYear: string
  complexity: string
  assessmentStyle: 'teorico' | 'practico' | 'mixto'
  methodology: string
}

/**
 * Where a topic inside a teacher's program came from. 'curriculum' means the
 * teacher picked it out of the official `curriculum` table (sourceEje keeps the
 * eje it belonged to, so the UI can show provenance and avoid offering it
 * twice); 'custom' means they typed it. Omitted on programs created before the
 * subject wizard existed — treat a missing origin as 'custom'.
 */
export type ProgramTopicOrigin = 'curriculum' | 'custom'

export interface ProgramTopic {
  id: string
  name: string
  origin?: ProgramTopicOrigin
  sourceEje?: string
}

export interface ProgramUnit {
  id: string
  name: string
  topics: ProgramTopic[]
}

/** Which flow built the program. Drives copy and the "completá los datos" nudge. */
export type ProgramCreatedFrom = 'upload' | 'curriculum' | 'manual'

export interface TeacherProgram {
  id: number
  userId: string
  subjectName: string
  iconName: SubjectIconName
  colorName: SubjectColorName
  pedagogyProfile: PedagogyProfile
  units: ProgramUnit[]
  sourceFileName: string | null
  createdAt: string
  /** Null on programs created before migration 014 — the wizard asks for it on edit. */
  nivel: Nivel | null
  grado: string | null
  jurisdiccion: string | null
  createdFrom: ProgramCreatedFrom
}

export type SubjectIconName =
  | 'book-open'
  | 'calculator'
  | 'sigma'
  | 'chart-line'
  | 'flask-conical'
  | 'atom'
  | 'ruler'
  | 'landmark'
  | 'pie-chart'
  | 'target'

export type SubjectColorName =
  | 'teal'
  | 'blue'
  | 'orange'
  | 'green'
  | 'red'
  | 'indigo'
  | 'amber'
  | 'cyan'
  | 'emerald'
  | 'pink'

export type TeacherQuizStatus = 'saved' | 'pending_share'

export type QuizActionMode = 'realizar' | 'guardar' | 'compartir'

export interface TeacherQuiz {
  id: number
  userId: string
  teacherProgramId: number
  title: string
  subjectName: string
  mode: 'teorico' | 'practico' | 'mixto'
  status: TeacherQuizStatus
  selectedTopics: { id: string; name: string }[]
  questionCount: number
  questions: Question[]
  pedagogyContext?: string
  createdAt: string
  updatedAt: string
}

export interface TeacherProgramFilters {
  name: string
  level: string
  degree: string
  mode: '' | 'teorico' | 'practico' | 'mixto'
  createdAfter: string
}

export interface UserProfile {
  id: string
  email: string
  displayName: string
  role: UserRole
  nivel?: string
  grado?: string
}

// ─── Aulas (Docente ↔ Alumnos) ───────────────────────────────────────────────

export type ClassroomStatus = 'open' | 'closed'

/** One aula = one teacher program, reachable by its join code. */
export interface Classroom {
  id: number
  teacherProgramId: number
  name: string
  joinCode: string
  status: ClassroomStatus
  subjectName: string
  nivel: Nivel | null
  grado: string | null
  memberCount: number
  assignmentCount: number
  createdAt: string
}

export interface ClassroomMember {
  id: number
  userId: string
  displayName: string
  /** false for guests, who only typed a name — shown as "sin verificar". */
  isVerified: boolean
  joinedAt: string
  attemptCount: number
  averageScore: number | null
  lastAttemptAt: string | null
}

/** The scheduling fields an assignment state is computed from. */
export interface ClassroomAssignmentWindow {
  opensAt: string | null
  dueAt: string | null
  maxAttempts: number | null
}

export interface ClassroomAssignment extends ClassroomAssignmentWindow {
  id: number
  teacherQuizId: number
  title: string
  mode: 'teorico' | 'practico' | 'mixto'
  questionCount: number
  createdAt: string
}

export type AssignmentState = 'disponible' | 'programada' | 'vencida' | 'sin_intentos' | 'cerrada'

/** An assignment as one particular student sees it. */
export interface StudentAssignment extends ClassroomAssignment {
  state: AssignmentState
  attemptsUsed: number
  bestScore: number | null
}

/** Everything the student needs to practise inside an aula. */
export interface StudentClassroom {
  id: number
  name: string
  status: ClassroomStatus
  teacherName: string
  subjectName: string
  nivel: Nivel | null
  grado: string | null
  iconName: SubjectIconName
  colorName: SubjectColorName
  teacherProgramId: number
  units: ProgramUnit[]
  pedagogyProfile?: PedagogyProfile
  assignments: StudentAssignment[]
  joinedAt: string
}
