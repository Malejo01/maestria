import { describe, it, expect } from 'vitest'
import {
  JOIN_CODE_ALPHABET,
  JOIN_CODE_LENGTH,
  assignmentState,
  canStartAssignment,
  generateJoinCode,
  guestCapStatus,
  isValidJoinCode,
  normalizeJoinCode,
} from '@/lib/classrooms'

const NOW = new Date('2026-08-10T12:00:00.000Z')
const OPEN = { opensAt: null, dueAt: null, maxAttempts: null }

describe('generateJoinCode', () => {
  it('has the expected length and avoids ambiguous glyphs', () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateJoinCode()
      expect(code).toHaveLength(JOIN_CODE_LENGTH)
      expect(code).toMatch(new RegExp(`^[${JOIN_CODE_ALPHABET}]+$`))
      expect(code).not.toMatch(/[IO01]/)
    }
  })
})

describe('normalizeJoinCode', () => {
  it('accepts what a student actually types', () => {
    expect(normalizeJoinCode('abc234')).toBe('ABC234')
    expect(normalizeJoinCode(' ABC-234 ')).toBe('ABC234')
    expect(normalizeJoinCode('ABC 234')).toBe('ABC234')
  })

  it('drops characters that can never be part of a code', () => {
    expect(normalizeJoinCode('AB@C2#34')).toBe('ABC234')
    expect(isValidJoinCode('abc234')).toBe(true)
    expect(isValidJoinCode('abc23')).toBe(false)
  })
})

describe('assignmentState', () => {
  it('is available when there is no window and attempts are left', () => {
    expect(assignmentState(OPEN, 0, NOW)).toBe('disponible')
    expect(assignmentState({ ...OPEN, maxAttempts: 3 }, 2, NOW)).toBe('disponible')
  })

  it('is scheduled before the opening date', () => {
    expect(assignmentState({ ...OPEN, opensAt: '2026-08-11T12:00:00.000Z' }, 0, NOW)).toBe('programada')
  })

  it('is overdue after the deadline', () => {
    expect(assignmentState({ ...OPEN, dueAt: '2026-08-09T12:00:00.000Z' }, 0, NOW)).toBe('vencida')
  })

  it('runs out of attempts once the maximum is reached', () => {
    expect(assignmentState({ ...OPEN, maxAttempts: 2 }, 2, NOW)).toBe('sin_intentos')
    expect(assignmentState({ ...OPEN, maxAttempts: 2 }, 5, NOW)).toBe('sin_intentos')
  })

  it('lets the deadline win over the attempt count', () => {
    // Overdue AND out of attempts: the student should be told the assignment
    // closed, not that they burned their attempts.
    const overdueAndSpent = { opensAt: null, dueAt: '2026-08-09T12:00:00.000Z', maxAttempts: 1 }
    expect(assignmentState(overdueAndSpent, 1, NOW)).toBe('vencida')
  })

  it('reports a closed aula regardless of the window', () => {
    expect(assignmentState(OPEN, 0, NOW, 'closed')).toBe('cerrada')
    expect(assignmentState({ ...OPEN, dueAt: '2027-01-01T00:00:00.000Z' }, 0, NOW, 'closed')).toBe('cerrada')
  })

  it('only allows starting an available assignment', () => {
    expect(canStartAssignment('disponible')).toBe(true)
    for (const state of ['programada', 'vencida', 'sin_intentos', 'cerrada'] as const) {
      expect(canStartAssignment(state)).toBe(false)
    }
  })
})

describe('guestCapStatus', () => {
  it('avisa al 75% y marca el tope exactamente donde el join empieza a rechazar', () => {
    expect(guestCapStatus(0, 60)).toBe('ok')
    expect(guestCapStatus(44, 60)).toBe('ok')
    expect(guestCapStatus(45, 60)).toBe('near')
    expect(guestCapStatus(59, 60)).toBe('near')
    // El join rechaza cuando newGuests >= limit: con 60 ya creados, el 61 no entra.
    expect(guestCapStatus(60, 60)).toBe('reached')
    expect(guestCapStatus(75, 60)).toBe('reached')
  })

  it('una clase de 30 con el tope por defecto no dispara ningún aviso', () => {
    expect(guestCapStatus(30, 60)).toBe('ok')
  })
})
