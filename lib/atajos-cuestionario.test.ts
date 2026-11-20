import { describe, expect, it } from 'vitest'
import { accionDeTecla, moverEnOpciones, type EstadoParaAtajos } from './atajos-cuestionario'

const opcionMultiple: EstadoParaAtajos = {
  tipoDePregunta: 'multiple_choice',
  cantidadDeOpciones: 4,
  hayRespuesta: false,
  enviada: false,
  enCampoDeTexto: false,
  dialogoAbierto: false,
  puedeIrAtras: false,
  puedeIrAdelante: true,
}

describe('L2 · qué hace cada tecla', () => {
  it('flechas mueven, números y letras eligen', () => {
    expect(accionDeTecla({ key: 'ArrowDown' }, opcionMultiple)).toEqual({ tipo: 'mover', delta: 1 })
    expect(accionDeTecla({ key: 'ArrowUp' }, opcionMultiple)).toEqual({ tipo: 'mover', delta: -1 })
    expect(accionDeTecla({ key: '2' }, opcionMultiple)).toEqual({ tipo: 'elegir', indice: 1 })
    expect(accionDeTecla({ key: 'c' }, opcionMultiple)).toEqual({ tipo: 'elegir', indice: 2 })
    expect(accionDeTecla({ key: 'D' }, opcionMultiple)).toEqual({ tipo: 'elegir', indice: 3 })
    expect(accionDeTecla({ key: '5' }, opcionMultiple)).toBeNull()
  })

  it('Enter confirma si hay respuesta, y después pasa a la siguiente', () => {
    expect(accionDeTecla({ key: 'Enter' }, opcionMultiple)).toBeNull()
    expect(accionDeTecla({ key: 'Enter' }, { ...opcionMultiple, hayRespuesta: true })).toEqual({ tipo: 'confirmar' })
    expect(accionDeTecla({ key: 'Enter' }, { ...opcionMultiple, hayRespuesta: true, enviada: true })).toEqual({ tipo: 'siguiente' })
  })

  it('V y F en verdadero o falso', () => {
    const vf = { ...opcionMultiple, tipoDePregunta: 'true_false' as const, cantidadDeOpciones: 2 }
    expect(accionDeTecla({ key: 'v' }, vf)).toEqual({ tipo: 'verdaderoFalso', valor: true })
    expect(accionDeTecla({ key: 'F' }, vf)).toEqual({ tipo: 'verdaderoFalso', valor: false })
  })

  it('escribiendo en un campo, sólo Enter: "1" no elige la opción 1', () => {
    const escribiendo = { ...opcionMultiple, tipoDePregunta: 'numeric' as const, enCampoDeTexto: true, hayRespuesta: true }
    expect(accionDeTecla({ key: '1' }, escribiendo)).toBeNull()
    expect(accionDeTecla({ key: 'a' }, escribiendo)).toBeNull()
    expect(accionDeTecla({ key: 'ArrowLeft' }, { ...escribiendo, puedeIrAtras: true })).toBeNull()
    expect(accionDeTecla({ key: '?' }, escribiendo)).toBeNull()
    expect(accionDeTecla({ key: 'Enter' }, escribiendo)).toEqual({ tipo: 'confirmar' })
    expect(accionDeTecla({ key: 'Enter', shiftKey: true }, escribiendo)).toBeNull()
  })

  it('con un diálogo abierto no hay atajos', () => {
    const conDialogo = { ...opcionMultiple, dialogoAbierto: true, hayRespuesta: true }
    for (const key of ['ArrowDown', 'ArrowUp', 'Enter', '1', 'Escape', '?']) {
      expect(accionDeTecla({ key }, conDialogo)).toBeNull()
    }
  })

  it('← y → sólo donde la navegación ya lo permite', () => {
    expect(accionDeTecla({ key: 'ArrowRight' }, opcionMultiple)).toBeNull()
    expect(accionDeTecla({ key: 'ArrowRight' }, { ...opcionMultiple, enviada: true })).toEqual({ tipo: 'siguiente' })
    expect(accionDeTecla({ key: 'ArrowLeft' }, opcionMultiple)).toBeNull()
    expect(accionDeTecla({ key: 'ArrowLeft' }, { ...opcionMultiple, puedeIrAtras: true })).toEqual({ tipo: 'anterior' })
  })

  it('? y Esc', () => {
    expect(accionDeTecla({ key: '?' }, opcionMultiple)).toEqual({ tipo: 'ayuda' })
    expect(accionDeTecla({ key: 'Escape' }, opcionMultiple)).toEqual({ tipo: 'salir' })
  })

  it('con Ctrl o Cmd no se intercepta nada (copiar, recargar…)', () => {
    expect(accionDeTecla({ key: 'c', ctrlKey: true }, opcionMultiple)).toBeNull()
  })

  it('las flechas dan la vuelta', () => {
    expect(moverEnOpciones(null, 1, 4)).toBe(0)
    expect(moverEnOpciones(null, -1, 4)).toBe(3)
    expect(moverEnOpciones(3, 1, 4)).toBe(0)
    expect(moverEnOpciones(0, -1, 4)).toBe(3)
  })
})
