import { describe, expect, it } from 'vitest'
import { gradeShortAnswerLocally } from './short-answer-autograde'

/**
 * Los casos de este archivo NO son inventados: salen de `quiz_answers` de
 * producción, del examen del 2026-08-10 con 30 alumnos, extraídos con
 * `scripts/report-short-answer-regrade.ts`. Ahí quedaron 225 de 238 respuestas
 * marcadas incorrectas porque `/api/quiz/grade-short-answer` falló ~224 veces y
 * el cliente escribía `false` ante cualquier fallo.
 *
 * El reporte sobre esos mismos datos dio 15 recuperables y **cero falsos
 * positivos** sobre las 210 restantes. Estos tests fijan las dos mitades: que
 * las 15 se resuelvan, y —más importante— que las que no deben resolverse
 * sigan sin resolverse. Un falso positivo acá le regala la nota a un alumno que
 * se equivocó, que es peor que el bug original.
 */
describe('gradeShortAnswerLocally — casos reales del examen del 2026-08-10', () => {
  describe('resuelve las que quedaron marcadas mal siendo correctas', () => {
    const recuperables: [string, string[], string][] = [
      // Coincidencia literal: la falla más absurda del examen. El alumno
      // escribió exactamente la respuesta esperada y quedó incorrecta.
      ['13', ['13'], 'alexpng15'],
      ['9', ['9'], 'GabrieL Flores'],
      ['7', ['7', 'siete'], 'Leandro Quispe'],
      ['5', ['5', 'x=5'], 'Rodrigo Medrano'],
      ['1/3', ['1/3', 'un tercio'], 'Jimena Fernanda Vilte'],
      // Tildes: el alumno las omite, la respuesta esperada las tiene.
      ['compas', ['Compás', 'El compás'], 'Agustín Torres'],
      ['Parabola', ['parábola', 'Parábola'], 'Enzo Barbito'],
      ['aritmetica', ['aritmética', 'aritmetica'], 'Guitian Lucas Mateo'],
      ['exponenciación', ['Exponenciación', 'Aplicar la función exponencial'], 'Rodrigo Medrano'],
      // Mayúsculas y plural ya contemplado en las aceptadas.
      ['Focos', ['focos', 'Focos'], 'Enzo Barbito'],
      ['focos', ['Foco', 'Focos'], 'Agustín Torres'],
      ['Eje X', ['eje x', 'eje X', 'horizontal'], 'Nicolas Cardozo'],
      ['Compás', ['compás', 'el compás'], 'Nicolas Cardozo'],
      ['parabola', ['Parábola', 'Parabola'], 'Nicolas Gavio'],
      ['el centro y el radio', ['Centro y radio', 'El centro y el radio'], 'Gaston Colque'],
    ]

    it.each(recuperables)('"%s" contra %j (era de %s)', (alumno, aceptadas) => {
      const grade = gradeShortAnswerLocally(alumno, aceptadas)
      expect(grade.resolved).toBe(true)
      expect(grade).toMatchObject({ isCorrect: true })
    })

    it('son 15, que es el número que dio el reporte contra producción', () => {
      expect(recuperables).toHaveLength(15)
    })
  })

  describe('NO resuelve las que necesitan criterio — van a la IA', () => {
    // Cada una de estas salió de las 210 no resueltas del reporte. Que den
    // `resolved: false` no es un defecto: es el módulo absteniéndose.
    const vanALaIa: [string, string[], string][] = [
      // Respuestas evasivas. No necesitan lista negra: no coinciden y listo.
      ['No lo sé', ['focos', 'Focos'], 'evasiva'],
      ['No se', ['4/3'], 'evasiva'],
      ['np', ['Hipérbola', 'Hiperbola'], 'evasiva'],
      // Puntuación sola: normaliza a vacío, y vacío nunca coincide.
      ['.', ['Composición de funciones', 'Composición'], 'sólo puntuación'],
      ['?', ['10'], 'sólo puntuación'],
      // Respuesta de más: contiene la esperada pero agrega otra cosa. Decidir
      // si vale es criterio semántico, no comparación de cadenas.
      ['Regla y compas', ['compás', 'el compás'], 'superconjunto'],
      // Numéricamente distintas. Enteros ⇒ tolerancia 0.
      ['4', ['0'], 'número distinto'],
      ['4', ['6', '6 unidades'], 'número distinto'],
      ['12', ['13'], 'número contiguo'],
      ['1', ['0', 'cero'], 'número distinto'],
      ['0.8', ['0.6', '6/10', '3/5'], 'decimal distinto'],
      ['25', ['120', '5!'], 'número distinto'],
      // Subcadena: "4" está dentro de "24" y no tiene que alcanzar.
      ['4', ['24', 'veinticuatro'], 'subcadena'],
      // Respuesta parcial: el alumno da un término de la expresión.
      ['3', ['3n+2', '2+3n'], 'parcial'],
      // Conceptualmente equivocada.
      ['Hiperbola', ['directriz', 'la directriz'], 'concepto distinto'],
      ['Ejes cartesianos', ['Focos', 'dos focos'], 'concepto distinto'],
      // Coordenada distinta: "-4,0" no es "-4, 2".
      ['-4,0', ['(-4, 2)', '-4, 2'], 'coordenada distinta'],
      ['(0,4)', ['(5, -3)', '5, -3'], 'coordenada distinta'],
    ]

    it.each(vanALaIa)('"%s" contra %j (%s)', (alumno, aceptadas) => {
      expect(gradeShortAnswerLocally(alumno, aceptadas)).toEqual({ resolved: false })
    })
  })

  describe('ruido de tipeo real del examen', () => {
    it.each([
      ['10\n', ['10']],
      ['4\n', ['4']],
      ['Adicion\n', ['adición']],
      ['3 a infinito ', ['3 a infinito']],
      ['  focos  ', ['Focos']],
    ])('normaliza %j', (alumno, aceptadas) => {
      expect(gradeShortAnswerLocally(alumno, aceptadas).resolved).toBe(true)
    })
  })

  describe('equivalencia numérica — el camino que el examen no ejercitó', () => {
    // Ninguna de las 15 recuperables se resolvió por acá: el `1/3` del examen
    // coincidía LITERALMENTE con la aceptada, así que entró por texto. Estos
    // casos son sintéticos a propósito, y están anotados como tales en
    // docs/deuda-tecnica.md.
    it('1/3 contra 0,33 — el redondeo a dos decimales entra en la tolerancia', () => {
      expect(gradeShortAnswerLocally('0,33', ['1/3'])).toEqual({
        resolved: true,
        isCorrect: true,
        via: 'numeric',
      })
    })

    it.each([
      ['0,6', ['3/5']],
      ['0.6', ['6/10']],
      ['3,5', ['7/2']],
      ['50%', ['0.5']],
    ])('%s equivale a %j', (alumno, aceptadas) => {
      expect(gradeShortAnswerLocally(alumno, aceptadas)).toMatchObject({ via: 'numeric' })
    })

    it('una aceptada no numérica no invalida el paso, sólo no participa', () => {
      // "5 km" y "5 kilómetros" no parsean; "5" sí, y es la que decide.
      expect(gradeShortAnswerLocally('5,0', ['5 km', '5 kilómetros', '5'])).toMatchObject({
        via: 'numeric',
      })
    })

    it('un entero no tolera al de al lado', () => {
      expect(gradeShortAnswerLocally('13', ['12'])).toEqual({ resolved: false })
    })

    it('no interpreta una expresión algebraica como número', () => {
      // Si `parseNumericAnswer` leyera el 3 de "3n+2", esto daría un falso
      // positivo. Es el caso que más caro sale de todos.
      expect(gradeShortAnswerLocally('3', ['3n+2'])).toEqual({ resolved: false })
    })
  })

  describe('entradas degeneradas', () => {
    it.each([
      ['', ['algo']],
      ['   ', ['algo']],
      ['algo', []],
    ])('%j / %j no resuelve', (alumno, aceptadas) => {
      expect(gradeShortAnswerLocally(alumno, aceptadas)).toEqual({ resolved: false })
    })

    it('aguanta basura vacía en las aceptadas, que la genera el LLM', () => {
      expect(gradeShortAnswerLocally('', ['', '  '])).toEqual({ resolved: false })
    })

    it('nunca afirma que algo es incorrecto', () => {
      // La propiedad estructural del módulo: no existe el caso resuelto+falso.
      const grade = gradeShortAnswerLocally('cualquier cosa', ['otra cosa'])
      expect(grade.resolved).toBe(false)
      expect(grade).not.toHaveProperty('isCorrect', false)
    })
  })
})
