import type { Question } from '@/lib/types'

/**
 * Question[] blobs persisted before the multi-type migration (teacher_quizzes
 * JSONB rows, Zustand localStorage) have no `type` field — they were always
 * multiple_choice. Call this on every historical Question read so the rest of
 * the app can rely on `type` always being present.
 */
export function normalizeLegacyQuestion(raw: unknown): Question {
  if (raw && typeof raw === 'object' && 'type' in raw && (raw as { type?: unknown }).type) {
    return raw as Question
  }
  return { ...(raw as object), type: 'multiple_choice' } as Question
}

export function normalizeLegacyQuestions(raw: unknown): Question[] {
  if (!Array.isArray(raw)) return []
  return raw.map(normalizeLegacyQuestion)
}
