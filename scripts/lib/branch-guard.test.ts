import { describe, expect, it, vi } from 'vitest'
import { createBranchGuard, type BranchDeleter } from './branch-guard'

/**
 * La condición dura del procedimiento de staging: la branch clonada de
 * producción sobrevive si y sólo si la corrida terminó verificada. Cualquier
 * otro final la borra.
 *
 * Estos tests son el motivo por el que el guardián es una fábrica y no unas
 * variables de módulo dentro del script: son 31 alumnos identificables y
 * "seguro que el finally anda" no es una verificación.
 */

const silentLogger = { error: () => {} }

function fakeApi(overrides: Partial<BranchDeleter> = {}) {
  const deleted: string[] = []
  const api: BranchDeleter = {
    findBranchByName: vi.fn(async () => undefined),
    deleteBranch: vi.fn(async (id: string) => {
      deleted.push(id)
    }),
    ...overrides,
  }
  return { api, deleted }
}

describe('createBranchGuard', () => {
  it('borra la branch cuando la corrida falla', async () => {
    const { api, deleted } = fakeApi()
    const guard = createBranchGuard(api, 'staging', silentLogger)

    guard.markAttempted()
    guard.setBranchId('br-123')

    const outcome = await guard.destroy('la verificación encontró un email real')

    expect(outcome).toEqual({ status: 'borrada', branchId: 'br-123', foundByName: false })
    expect(deleted).toEqual(['br-123'])
  })

  it('NO la borra cuando la corrida terminó verificada', async () => {
    const { api, deleted } = fakeApi()
    const guard = createBranchGuard(api, 'staging', silentLogger)

    guard.markAttempted()
    guard.setBranchId('br-123')
    guard.keep()

    expect(await guard.destroy('finally de rutina')).toEqual({ status: 'conservada' })
    expect(deleted).toEqual([])
  })

  it('no intenta borrar nada si nunca se llegó a crear', async () => {
    const { api } = fakeApi()
    const guard = createBranchGuard(api, 'staging', silentLogger)

    expect(await guard.destroy('falló antes de crear')).toEqual({ status: 'nada' })
    expect(api.deleteBranch).not.toHaveBeenCalled()
  })

  it('la busca por nombre cuando la creación no devolvió el id', async () => {
    // Modo de falla real: Neon crea la branch y la respuesta se pierde. La
    // branch existe, con datos reales, y nosotros no tenemos su id.
    const { api, deleted } = fakeApi({
      findBranchByName: vi.fn(async () => ({ id: 'br-huerfana' })),
    })
    const guard = createBranchGuard(api, 'staging', silentLogger)

    guard.markAttempted() // se marca ANTES de crear, justamente para este caso

    const outcome = await guard.destroy('se perdió la respuesta de creación')

    expect(outcome).toEqual({ status: 'borrada', branchId: 'br-huerfana', foundByName: true })
    expect(deleted).toEqual(['br-huerfana'])
  })

  it('no rompe si la branch nunca llegó a existir del lado de Neon', async () => {
    const { api } = fakeApi({ findBranchByName: vi.fn(async () => undefined) })
    const guard = createBranchGuard(api, 'staging', silentLogger)

    guard.markAttempted()

    expect(await guard.destroy('la creación falló')).toEqual({ status: 'nada' })
    expect(api.deleteBranch).not.toHaveBeenCalled()
  })

  it('reporta la branch como huérfana cuando el borrado falla', async () => {
    const boom = new Error('502 Bad Gateway')
    const { api } = fakeApi({
      deleteBranch: vi.fn(async () => {
        throw boom
      }),
    })
    const logged: string[] = []
    const guard = createBranchGuard(api, 'staging', { error: (...a) => logged.push(a.join(' ')) })

    guard.markAttempted()
    guard.setBranchId('br-123')

    const outcome = await guard.destroy('falló la anonimización')

    expect(outcome).toEqual({ status: 'huerfana', branchId: 'br-123', error: boom })
    // Tiene que gritar, no susurrar: es el caso en el que quedan datos vivos.
    expect(logged.join('\n')).toContain('NO SE PUDO BORRAR LA BRANCH')
    expect(logged.join('\n')).toContain('br-123')
  })

  it('reintenta si un primer borrado falló', async () => {
    // El script llama a destroy() desde el finally y otra vez desde el catch de
    // nivel superior. Si el primero falló, el segundo tiene que volver a probar.
    let calls = 0
    const { api } = fakeApi({
      deleteBranch: vi.fn(async () => {
        calls += 1
        if (calls === 1) throw new Error('timeout')
      }),
    })
    const guard = createBranchGuard(api, 'staging', silentLogger)

    guard.markAttempted()
    guard.setBranchId('br-123')

    expect((await guard.destroy('primer intento')).status).toBe('huerfana')
    expect((await guard.destroy('segundo intento')).status).toBe('borrada')
    expect(calls).toBe(2)
  })

  it('no borra dos veces cuando una señal llega durante la limpieza', async () => {
    // Ctrl-C mientras el finally ya está borrando: los dos tienen que esperar al
    // mismo borrado, no disparar dos DELETE ni dejar salir al proceso antes.
    let resolveDelete: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      resolveDelete = resolve
    })

    let calls = 0
    const { api } = fakeApi({
      deleteBranch: vi.fn(async () => {
        calls += 1
        await gate
      }),
    })
    const guard = createBranchGuard(api, 'staging', silentLogger)

    guard.markAttempted()
    guard.setBranchId('br-123')

    const primero = guard.destroy('finally')
    const segundo = guard.destroy('SIGINT')
    resolveDelete()

    const [a, b] = await Promise.all([primero, segundo])

    expect(calls).toBe(1)
    expect(a).toEqual({ status: 'borrada', branchId: 'br-123', foundByName: false })
    expect(b).toEqual(a)
  })

  it('una vez borrada, no vuelve a intentarlo', async () => {
    const { api } = fakeApi()
    const guard = createBranchGuard(api, 'staging', silentLogger)

    guard.markAttempted()
    guard.setBranchId('br-123')

    await guard.destroy('finally')
    expect(await guard.destroy('catch de nivel superior')).toEqual({ status: 'conservada' })
    expect(api.deleteBranch).toHaveBeenCalledTimes(1)
  })
})
