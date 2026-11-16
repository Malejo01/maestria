'use client'

import { useId, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { JOIN_CODE_LENGTH, isValidJoinCode, normalizeJoinCode } from '@/lib/classrooms'
import { ENTRADA } from '@/lib/textos'

/**
 * La puerta del alumno que ya recibió una invitación: escribe el código y va
 * a la pantalla de su grupo.
 *
 * Deliberadamente NO reimplementa el ingreso al grupo. Normaliza, valida el
 * largo y navega a `/aula/<código>`, que es la pantalla que ya resuelve los
 * tres casos (con cuenta, invitado que vuelve, invitado nuevo). Un segundo
 * camino sería tener dos lugares donde arreglar el mismo bug.
 *
 * Acepta minúsculas, guiones y espacios y los normaliza al escribir
 * (accesibilidad.md, "Formularios"): la persona puede pegar "7k4-p2m" y ve
 * exactamente lo que se va a buscar.
 */
export function CampoCodigo() {
  const router = useRouter()
  const id = useId()
  const [codigo, setCodigo] = useState('')
  const [incompleto, setIncompleto] = useState(false)

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (!isValidJoinCode(codigo)) {
      setIncompleto(true)
      return
    }
    router.push(`/aula/${normalizeJoinCode(codigo)}`)
  }

  return (
    <form onSubmit={enviar} noValidate>
      <label htmlFor={id} className="nota mb-2 block font-semibold text-texto-suave">
        {ENTRADA.codigo.etiqueta}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          type="text"
          value={codigo}
          onChange={(evento) => {
            setCodigo(normalizeJoinCode(evento.target.value).slice(0, JOIN_CODE_LENGTH))
            setIncompleto(false)
          }}
          placeholder={ENTRADA.codigo.ejemplo}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={incompleto}
          aria-describedby={incompleto ? `${id}-error` : undefined}
          className="h-12 min-w-0 flex-1 rounded-md border border-borde-fuerte bg-superficie-tarjeta px-3 text-[15px] uppercase tracking-[0.14em] text-texto placeholder:text-texto-suave placeholder:opacity-70"
        />
        <button
          type="submit"
          aria-label={ENTRADA.codigo.irAccesible}
          className="cuerpo-s h-12 min-w-12 rounded-md bg-texto px-4 font-bold text-superficie-tarjeta"
        >
          {ENTRADA.codigo.ir}
        </button>
      </div>
      <p id={`${id}-error`} role="status" className="nota mt-2 text-flojo empty:hidden">
        {incompleto ? ENTRADA.codigo.incompleto(JOIN_CODE_LENGTH) : ''}
      </p>
    </form>
  )
}
