'use client'

import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { Cargando } from '@/components/sistema/cargando'
import { Boton } from '@/components/sistema/boton'
import { esMenor, LARGO, type DatosFicha, type MateriaConTemas } from '@/lib/fichas'
import { FICHA_PEDAGOGICA as T } from '@/lib/textos'
import { cn } from '@/lib/utils'

const CAMPO =
  'h-11 w-full rounded-md border border-borde-fuerte bg-superficie-tarjeta px-3 text-[15px] text-texto placeholder:text-texto-suave placeholder:opacity-70'
const AREA =
  'min-h-24 w-full rounded-md border border-borde-fuerte bg-superficie-tarjeta px-3 py-2 text-[15px] text-texto placeholder:text-texto-suave placeholder:opacity-70'
const ETIQUETA = 'nota mb-2 block font-semibold text-texto-suave'
const TARJETA = 'rounded-lg border border-borde bg-superficie-tarjeta p-4 sm:p-6'

/**
 * J2: la ficha del alumno, por secciones. Reemplaza al campo único "Qué
 * prepara y para cuándo". Todo opcional salvo el nombre: un docente completa
 * lo que sabe y la ficha no lo frena. Un solo botón de guardar, al final.
 *
 * Sirve igual para un alumno que ya entró y para uno que todavía no (la
 * invitación): quien la usa pasa a qué dirección se guarda.
 */
export function FichaPedagogica({
  url,
  nombreInicial,
  inicial,
  materias,
  alGuardar,
}: {
  /** PUT /api/teacher/fichas?alumno=… o ?invitacion=… */
  url: string
  nombreInicial: string
  inicial: DatosFicha
  materias: MateriaConTemas[]
  alGuardar?: (nombre: string) => void
}) {
  const id = useId()
  const [nombre, setNombre] = useState(nombreInicial)
  const [ficha, setFicha] = useState<DatosFicha>(inicial)
  const [estado, setEstado] = useState<'quieto' | 'guardando' | 'guardado' | 'fallo' | 'sin_nombre'>('quieto')

  function cambiar<K extends keyof DatosFicha>(campo: K, valor: DatosFicha[K]) {
    setFicha((actual) => ({ ...actual, [campo]: valor }))
    setEstado('quieto')
  }

  const materia = materias.find((m) => m.id === ficha.materiaId) ?? null

  async function guardar(evento: FormEvent) {
    evento.preventDefault()
    if (!nombre.trim()) {
      setEstado('sin_nombre')
      return
    }
    setEstado('guardando')
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, ...ficha }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setEstado('guardado')
      alGuardar?.(nombre.trim())
    } catch {
      setEstado('fallo')
    }
  }

  const campoTexto = (campo: 'contacto' | 'responsable' | 'institucion' | 'anioCursa' | 'orientacion', ayuda?: string) => {
    const textos = T.campos[campo] as { etiqueta: string; ejemplo?: string }
    return (
      <div>
        <label htmlFor={`${id}-${campo}`} className={ETIQUETA}>
          {textos.etiqueta}
        </label>
        <input
          id={`${id}-${campo}`}
          value={ficha[campo]}
          onChange={(evento) => cambiar(campo, evento.target.value)}
          placeholder={textos.ejemplo}
          maxLength={LARGO.corto}
          autoComplete="off"
          aria-describedby={ayuda ? `${id}-${campo}-ayuda` : undefined}
          className={CAMPO}
        />
        {ayuda && (
          <p id={`${id}-${campo}-ayuda`} className="nota mt-2 text-texto-suave">
            {ayuda}
          </p>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={guardar} noValidate className="flex flex-col gap-3" aria-labelledby={`${id}-titulo`}>
      <div className={TARJETA}>
        <h2 id={`${id}-titulo`} className="titulo-m text-texto">
          {T.titulo}
        </h2>
        <p className="nota mt-1 text-texto-suave">{T.detalle}</p>
      </div>

      <Seccion titulo={T.secciones.alumno}>
        <div>
          <label htmlFor={`${id}-nombre`} className={ETIQUETA}>
            {T.campos.nombre.etiqueta}
          </label>
          <input
            id={`${id}-nombre`}
            value={nombre}
            onChange={(evento) => {
              setNombre(evento.target.value)
              setEstado('quieto')
            }}
            maxLength={LARGO.nombre}
            autoComplete="off"
            required
            aria-invalid={estado === 'sin_nombre'}
            aria-describedby={`${id}-nombre-ayuda`}
            className={CAMPO}
          />
          <p id={`${id}-nombre-ayuda`} className="nota mt-2 text-texto-suave">
            {T.campos.nombre.ayuda}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
          <div>
            <label htmlFor={`${id}-edad`} className={ETIQUETA}>
              {T.campos.edad.etiqueta}
            </label>
            <input
              id={`${id}-edad`}
              type="number"
              inputMode="numeric"
              min={1}
              max={119}
              value={ficha.edad ?? ''}
              onChange={(evento) => {
                const valor = Number.parseInt(evento.target.value, 10)
                cambiar('edad', Number.isFinite(valor) && valor > 0 && valor < 120 ? valor : null)
              }}
              className={CAMPO}
            />
          </div>
          {campoTexto('contacto')}
        </div>
        {esMenor(ficha.edad) && campoTexto('responsable', T.campos.responsable.ayuda)}
      </Seccion>

      <Seccion titulo={T.secciones.donde}>
        {campoTexto('institucion')}
        <div className="grid gap-4 sm:grid-cols-2">
          {campoTexto('anioCursa')}
          {campoTexto('orientacion')}
        </div>
      </Seccion>

      <Seccion titulo={T.secciones.rinde}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-materia`} className={ETIQUETA}>
              {T.campos.materia.etiqueta}
            </label>
            <select
              id={`${id}-materia`}
              value={ficha.materiaId ?? ''}
              onChange={(evento) => {
                const valor = Number(evento.target.value)
                setFicha((actual) => ({
                  ...actual,
                  materiaId: valor > 0 ? valor : null,
                  // Los temas son de una materia: si cambia, se vacían.
                  temasDificiles: valor === actual.materiaId ? actual.temasDificiles : [],
                }))
                setEstado('quieto')
              }}
              className={CAMPO}
            >
              <option value="">{T.campos.materia.ninguna}</option>
              {materias.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-fecha`} className={ETIQUETA}>
              {T.campos.fechaExamen.etiqueta}
            </label>
            <input
              id={`${id}-fecha`}
              type="date"
              value={ficha.fechaExamen ?? ''}
              onChange={(evento) => cambiar('fechaExamen', evento.target.value || null)}
              className={CAMPO}
            />
          </div>
        </div>
      </Seccion>

      <Seccion titulo={T.secciones.evalua}>
        <div>
          <label htmlFor={`${id}-evalua`} className={ETIQUETA}>
            {T.campos.comoEvalua.etiqueta}
          </label>
          <textarea
            id={`${id}-evalua`}
            value={ficha.comoEvalua}
            onChange={(evento) => cambiar('comoEvalua', evento.target.value)}
            placeholder={T.campos.comoEvalua.ejemplo}
            maxLength={LARGO.largo}
            className={AREA}
          />
        </div>
      </Seccion>

      <Seccion titulo={T.secciones.cuesta}>
        <TemasQueLeCuestan
          materia={materia}
          marcados={ficha.temasDificiles}
          onCambiar={(temas) => cambiar('temasDificiles', temas)}
        />
      </Seccion>

      <Seccion titulo={T.secciones.observaciones}>
        <div>
          <label htmlFor={`${id}-obs`} className="sr-only">
            {T.campos.observaciones.etiqueta}
          </label>
          <textarea
            id={`${id}-obs`}
            value={ficha.observaciones}
            onChange={(evento) => cambiar('observaciones', evento.target.value)}
            placeholder={T.campos.observaciones.ejemplo}
            maxLength={LARGO.largo}
            className={AREA}
          />
        </div>
      </Seccion>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Boton type="submit" disabled={estado === 'guardando'}>
          {estado === 'guardando' && <Cargando />}
          {estado === 'guardando' ? T.guardando : T.guardar}
        </Boton>
        <p
          role="status"
          className={cn('nota empty:hidden', estado === 'fallo' || estado === 'sin_nombre' ? 'text-flojo' : 'text-texto-suave')}
        >
          {estado === 'guardado' ? T.guardado : estado === 'fallo' ? T.fallo : estado === 'sin_nombre' ? T.sinNombre : ''}
        </p>
      </div>
      <p className="nota text-texto-suave">{T.privacidad}</p>
    </form>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <fieldset className={cn(TARJETA, 'flex min-w-0 flex-col gap-4')}>
      <legend className="sr-only">{titulo}</legend>
      <p aria-hidden="true" className="titulo-m text-texto">
        {titulo}
      </p>
      {children}
    </fieldset>
  )
}

/** Los temas de la materia elegida, por unidad, con un tilde cada uno. */
function TemasQueLeCuestan({
  materia,
  marcados,
  onCambiar,
}: {
  materia: MateriaConTemas | null
  marcados: string[]
  onCambiar: (temas: string[]) => void
}) {
  const id = useId()
  if (!materia) return <p className="cuerpo-s text-texto-suave">{T.cuesta.sinMateria}</p>
  const unidades = materia.unidades.filter((u) => u.topics.length > 0)
  if (unidades.length === 0) return <p className="cuerpo-s text-texto-suave">{T.cuesta.sinTemas}</p>

  const elegidos = new Set(marcados)
  function alternar(temaId: string) {
    const siguiente = new Set(elegidos)
    if (siguiente.has(temaId)) siguiente.delete(temaId)
    else siguiente.add(temaId)
    onCambiar([...siguiente])
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="nota text-texto-suave" aria-live="polite">
        {T.cuesta.marcados(elegidos.size)}
      </p>
      {unidades.map((unidad) => (
        <fieldset key={unidad.id} className="min-w-0">
          <legend className="cuerpo-s mb-2 font-bold text-texto">{unidad.name}</legend>
          <ul className="flex flex-col">
            {unidad.topics.map((tema) => (
              <li key={tema.id}>
                <label
                  htmlFor={`${id}-${tema.id}`}
                  className="cuerpo-s flex min-h-11 cursor-pointer items-start gap-3 py-2 text-texto"
                >
                  <input
                    id={`${id}-${tema.id}`}
                    type="checkbox"
                    checked={elegidos.has(tema.id)}
                    onChange={() => alternar(tema.id)}
                    className="mt-0.5 size-5 shrink-0 accent-accion"
                  />
                  <span className="min-w-0">{tema.name}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      ))}
    </div>
  )
}
