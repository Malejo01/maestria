/**
 * Tope de invitados nuevos por aula, a través del handler real.
 *
 * El doble de la base no devuelve conteos armados: guarda las filas que el
 * handler inserta en `users` y `classroom_members`, con su `created_at` según
 * un reloj que el test controla, y el conteo sale de esas filas. La forma de
 * la respuesta es la de Neon, verificada contra la base real: `COUNT(*)::int`
 * llega como número y un `COUNT(*)` sin cast llega como string ("32"). Si el
 * handler dejara de castear, este doble le devolvería un string, igual que
 * producción.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

interface UserRow {
  id: string
  name: string
  isGuest: boolean
  createdAt: number
}

interface MemberRow {
  classroomId: number
  userId: string
  status: 'active' | 'removed'
}

const DAY_MS = 24 * 60 * 60 * 1000

const { db, sqlMock, getViewerMock, captureGuestJoinCapReached } = vi.hoisted(() => {
  const db = {
    now: 0,
    users: [] as UserRow[],
    members: [] as MemberRow[],
    classroom: { id: 2, name: 'Análisis 3ro', status: 'open', teacher_program_id: 7, subject_name: 'Análisis de Sistemas' },
    joinCode: 'ABC234',
  }

  const sqlMock = async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join('?')

    if (text.includes('FROM classrooms c') && text.includes('c.join_code =')) {
      return values[0] === db.joinCode ? [{ ...db.classroom }] : []
    }

    if (text.includes('AS new_guests')) {
      const classroomId = values[0] as number
      const since = db.now - DAY_MS
      const count = db.members.filter((m) => {
        if (m.classroomId !== classroomId) return false
        const user = db.users.find((u) => u.id === m.userId)
        return !!user && user.isGuest && user.createdAt > since
      }).length
      return [{ new_guests: text.includes('COUNT(*)::int') ? count : String(count) }]
    }

    if (text.includes('INSERT INTO users')) {
      const [id, name] = values as [string, string]
      db.users.push({ id, name, isGuest: true, createdAt: db.now })
      return []
    }

    if (text.includes('INSERT INTO classroom_members')) {
      const [classroomId, userId] = values as [number, string]
      const existing = db.members.find((m) => m.classroomId === classroomId && m.userId === userId)
      if (existing) existing.status = 'active'
      else db.members.push({ classroomId, userId, status: 'active' })
      return []
    }

    if (text.includes('UPDATE users SET name')) return []

    throw new Error(`Consulta no reconocida por el doble: ${text}`)
  }

  return { db, sqlMock, getViewerMock: vi.fn(), captureGuestJoinCapReached: vi.fn() }
})

vi.mock('@/lib/db', () => ({ sql: sqlMock }))
vi.mock('@/lib/auth-session', () => ({ getViewer: getViewerMock }))
vi.mock('@/lib/observability', () => ({
  captureRouteFailure: vi.fn(),
  captureGuestJoinCapReached,
}))

import { POST } from './route'
import { DEFAULT_CLASSROOM_DAILY_NEW_GUEST_LIMIT } from '@/lib/classroom-guest-cap'

function join(displayName: string) {
  return POST(
    new Request('http://localhost/api/classrooms/join', {
      method: 'POST',
      body: JSON.stringify({ code: db.joinCode, displayName }),
    })
  )
}

/** Un alumno sin cookie ni cuenta: el camino que crea un invitado nuevo. */
async function joinAsNewGuest(n: number) {
  getViewerMock.mockResolvedValueOnce(null)
  return join(`Alumno ${n}`)
}

const guestCount = () => db.users.filter((u) => u.isGuest).length

beforeEach(() => {
  db.now = Date.parse('2026-10-01T13:00:00Z')
  db.users = []
  db.members = []
  getViewerMock.mockReset()
  captureGuestJoinCapReached.mockReset()
  delete process.env.CLASSROOM_DAILY_NEW_GUEST_LIMIT
})

describe('tope de invitados nuevos por aula', () => {
  it('una clase de 30 que entra sin cuenta en una hora pasa entera', async () => {
    for (let n = 0; n < 30; n += 1) {
      db.now += 2 * 60 * 1000
      const response = await joinAsNewGuest(n)
      expect(response.status, `el alumno ${n} quedó afuera`).toBe(200)
    }

    expect(guestCount()).toBe(30)
    expect(captureGuestJoinCapReached).not.toHaveBeenCalled()
  })

  it('al llegar al tope rechaza al siguiente, le dice por qué y cómo entrar, y no crea el invitado', async () => {
    for (let n = 0; n < DEFAULT_CLASSROOM_DAILY_NEW_GUEST_LIMIT; n += 1) {
      expect((await joinAsNewGuest(n)).status).toBe(200)
    }

    const rejected = await joinAsNewGuest(999)
    expect(rejected.status).toBe(429)

    const body = await rejected.json()
    expect(body.guestCapReached).toBe(true)
    expect(body.error).toMatch(/Google/)
    expect(body.error).toMatch(/docente/)
    expect(rejected.headers.get('set-cookie')).toBeNull()

    expect(guestCount()).toBe(DEFAULT_CLASSROOM_DAILY_NEW_GUEST_LIMIT)
    expect(captureGuestJoinCapReached).toHaveBeenCalledWith({
      classroomId: db.classroom.id,
      newGuests: DEFAULT_CLASSROOM_DAILY_NEW_GUEST_LIMIT,
      limit: DEFAULT_CLASSROOM_DAILY_NEW_GUEST_LIMIT,
    })
  })

  it('con el aula en el tope, el invitado que vuelve con su cookie y el alumno con Google entran igual', async () => {
    for (let n = 0; n < DEFAULT_CLASSROOM_DAILY_NEW_GUEST_LIMIT; n += 1) await joinAsNewGuest(n)

    const returning = db.users[0]
    getViewerMock.mockResolvedValueOnce({
      id: returning.id,
      role: 'ALUMNO',
      isGuest: true,
      displayName: returning.name,
      email: null,
    })
    expect((await join(returning.name)).status).toBe(200)

    getViewerMock.mockResolvedValueOnce({
      id: '1077',
      role: 'ALUMNO',
      isGuest: false,
      displayName: 'Alumna',
      email: 'alumna@example.com',
    })
    expect((await join('Alumna')).status).toBe(200)

    expect(guestCount()).toBe(DEFAULT_CLASSROOM_DAILY_NEW_GUEST_LIMIT)
  })

  it('la ventana es de 24 h deslizantes: los invitados de ayer ya no cuentan', async () => {
    for (let n = 0; n < DEFAULT_CLASSROOM_DAILY_NEW_GUEST_LIMIT; n += 1) await joinAsNewGuest(n)

    db.now += DAY_MS + 60 * 1000
    expect((await joinAsNewGuest(1000)).status).toBe(200)
  })

  it('sacar invitados de la lista no libera cupo para fabricar más', async () => {
    for (let n = 0; n < DEFAULT_CLASSROOM_DAILY_NEW_GUEST_LIMIT; n += 1) await joinAsNewGuest(n)
    for (const member of db.members) member.status = 'removed'

    expect((await joinAsNewGuest(1000)).status).toBe(429)
  })

  it('el tope se puede ajustar por env', async () => {
    process.env.CLASSROOM_DAILY_NEW_GUEST_LIMIT = '2'

    expect((await joinAsNewGuest(1)).status).toBe(200)
    expect((await joinAsNewGuest(2)).status).toBe(200)
    expect((await joinAsNewGuest(3)).status).toBe(429)
  })
})
