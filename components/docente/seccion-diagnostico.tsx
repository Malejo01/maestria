'use client'

import { useCallback, useEffect, useState } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { ArmarDiagnostico } from '@/components/docente/armar-diagnostico'
import { AccionesDeCuestionario } from '@/components/docente/acciones-de-cuestionario'
import { Cargando } from '@/components/sistema/cargando'
import { Boton } from '@/components/sistema/boton'
import { ChipTema } from '@/components/sistema/chip-tema'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { temasFallados, type EstadoDeTema } from '@/lib/diagnostico-resultados'
import type { DiagnosticoConResultado } from '@/lib/diagnostico-resultados-server'
import type { EstadoTema } from '@/lib/alumnos-docente'
import { DIAGNOSTICO as T } from '@/lib/textos'
import type { ProgramUnit } from '@/lib/types'
import { cn } from '@/lib/utils'

const R = T.resultado

export interface EstadoDiagnostico {
  disponible: boolean
  /** L0: false sin la migración 028; armar uno individual lo asignaría al grupo entero. */
  individualDisponible?: boolean
  grupo?: { classroomId: number; materiaId: number; materia: string; unidades: ProgramUnit[] }
  temasDificiles?: string[]
  diagnosticos?: DiagnosticoConResultado[]
}

/** El color del chip: acertó en verde, falló en naranja, sin respuesta en gris. El estado va escrito igual. */
const CHIP: Record<EstadoDeTema, EstadoTema> = { acerto: 'dominado', fallo: 'flojo', no_respondio: 'sin_datos' }

const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric' })

/**
 * La sección Diagnóstico de la ficha (J4 + J6): armar el diagnóstico y, cuando
 * lo rindió (en la app o en papel), su resultado por unidad y por tema. Sin la
 * 027 no se dibuja nada: la válvula.
 */
export function SeccionDiagnostico({
  destino,
  nombre = null,
  alMarcarTemas,
}: {
  destino: { alumno: string } | { invitacion: number }
  /** L1: para el "Listo. … asignados a {nombre}". */
  nombre?: string | null
  /** Para que la ficha vuelva a leer "Qué le cuesta" después de marcar. */
  alMarcarTemas?: () => void
}) {
  const consulta = 'alumno' in destino ? `alumno=${encodeURIComponent(destino.alumno)}` : `invitacion=${destino.invitacion}`
  const [estado, setEstado] = useState<EstadoDiagnostico | null>(null)
  const [armando, setArmando] = useState(false)

  const leer = useCallback(async () => {
    try {
      const res = await fetch(`/api/teacher/diagnosticos?${consulta}`)
      setEstado(res.ok ? await res.json() : { disponible: false })
    } catch {
      setEstado({ disponible: false })
    }
  }, [consulta])

  useEffect(() => {
    void leer()
  }, [leer])

  if (!estado?.disponible || !estado.grupo) return null
  const diagnosticos = estado.diagnosticos ?? []
  // Una respuesta de antes de la 028 no trae el campo: se trata como que falta.
  const puedeArmar = estado.individualDisponible === true

  return (
    <section className="rounded-lg border border-borde bg-superficie-tarjeta p-4 sm:p-6" aria-labelledby="ficha-diagnostico">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="ficha-diagnostico" className="titulo-m text-texto">
            {T.titulo}
          </h2>
          <p className="nota mt-1 max-w-prose text-texto-suave">{T.detalle}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-1 sm:items-end">
          <Boton
            variante={diagnosticos.length > 0 ? 'secundario' : 'principal'}
            disabled={!puedeArmar}
            aria-describedby={puedeArmar ? undefined : 'diagnostico-falta-028'}
            onClick={() => setArmando(true)}
          >
            <ClipboardCheck aria-hidden="true" strokeWidth={TRAZO_ICONO} />
            {diagnosticos.length > 0 ? T.armarOtro : T.armar}
          </Boton>
          {!puedeArmar && (
            <p id="diagnostico-falta-028" className="nota max-w-xs text-texto-suave">
              {T.faltaActualizacion}
            </p>
          )}
        </div>
      </div>

      {diagnosticos.length === 0 ? (
        <p className="cuerpo-s mt-4 text-texto-suave">{T.vacio}</p>
      ) : (
        <div className="mt-4 flex flex-col gap-6">
          {diagnosticos.map((d) => (
            <Resultado
              key={d.id}
              diagnostico={d}
              destino={destino}
              yaMarcados={estado.temasDificiles ?? []}
              alMarcar={() => {
                void leer()
                alMarcarTemas?.()
              }}
            />
          ))}
        </div>
      )}

      <ArmarDiagnostico
        abierto={armando}
        onCambiar={(abierto) => {
          setArmando(abierto)
          // K4: al cerrar el diálogo, siempre se vuelve a leer, se haya cerrado
          // como se haya cerrado; antes dependía del paso en que estaba.
          if (!abierto) void leer()
        }}
        destino={destino}
        materia={estado.grupo.materia}
        unidades={estado.grupo.unidades}
        temasDificiles={estado.temasDificiles ?? []}
        alTerminar={leer}
        nombre={nombre}
      />
    </section>
  )
}

function Resultado({
  diagnostico: d,
  destino,
  yaMarcados,
  alMarcar,
}: {
  diagnostico: DiagnosticoConResultado
  destino: { alumno: string } | { invitacion: number }
  /** Los que ya están en "Qué le cuesta": no se vuelven a ofrecer. */
  yaMarcados: string[]
  alMarcar: () => void
}) {
  const fallados = temasFallados(d.temas).filter((t) => !yaMarcados.includes(t.temaId))
  const consulta = 'alumno' in destino ? `alumno=${encodeURIComponent(destino.alumno)}` : `invitacion=${destino.invitacion}`

  return (
    <article className="flex flex-col gap-4 border-t border-borde pt-4 first:border-t-0 first:pt-0">
      <p className="nota font-semibold text-texto-suave">{T.armado(fechaCorta(d.creadoEl), d.modo)}</p>

      <ul className="flex flex-col">
        {d.cuestionarios.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-borde py-2 last:border-b-0">
            <span className="min-w-0 flex-1 basis-48">
              <span className="cuerpo-s block text-texto">{c.titulo}</span>
              <span className="nota block text-texto-suave">
                {T.preguntas(c.preguntas)} ·{' '}
                {c.fuente === 'app' && c.fecha ? R.enLaApp(fechaCorta(c.fecha)) : c.fuente === 'impreso' && c.fecha ? R.impreso(fechaCorta(c.fecha)) : R.noRindio}
              </span>
            </span>
            {/* J7 + L1: revisar y editar, verlo como alumno, la versión en papel y la carga a mano. */}
            <AccionesDeCuestionario
              quizId={c.id}
              titulo={c.titulo}
              consulta={consulta}
              acciones={['revisar', 'verComoAlumno', 'imprimir', 'cargar']}
            />
          </li>
        ))}
      </ul>

      {d.temas.length === 0 ? (
        <p className="cuerpo-s text-texto-suave">{R.sinResultados}</p>
      ) : (
        <>
          <div>
            <h3 className="cuerpo-s font-bold text-texto">{R.porUnidad}</h3>
            <ul className="mt-2 flex flex-col gap-3">
              {d.unidades.map((u) => {
                const porcentaje = u.total > 0 ? Math.round((u.bien / u.total) * 100) : 0
                return (
                  <li key={u.unidadId ?? u.nombre}>
                    <p className="cuerpo-s text-texto">{R.unidad(u.nombre, u.bien, u.total)}</p>
                    <div aria-hidden="true" className="mt-1 h-2 overflow-hidden rounded-full bg-superficie-base">
                      <div className="h-full rounded-full bg-accion" style={{ width: `${porcentaje}%` }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          <div>
            <h3 className="cuerpo-s font-bold text-texto">{R.porTema}</h3>
            <ul className="mt-2 flex flex-col">
              {d.temas.map((t) => (
                <li key={t.temaId} className="border-b border-borde py-2 last:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    <span className="cuerpo-s min-w-0 text-texto">{t.nombre}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      {R.deTema(t.bien, t.total) && <span className="nota tabular-nums text-texto-suave">{R.deTema(t.bien, t.total)}</span>}
                      {/* K7: anuncia sólo lo que muestra ("Acertó"), no "Dominado". */}
                      <ChipTema tema={R.estado[t.estado]} estado={CHIP[t.estado]} anuncio={null} />
                    </span>
                  </div>
                  {t.error && (
                    <p className="nota mt-1 border-l-2 border-flojo pl-2 text-texto-suave">
                      <span className="font-semibold">{R.errorDetectado}</span> {t.error}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <p className="nota mt-2 text-texto-suave">{R.nota}</p>
          </div>

          {fallados.length > 0 && <MarcarFallados destino={destino} temas={fallados.map((t) => t.temaId)} alMarcar={alMarcar} />}
        </>
      )}
    </article>
  )
}

/** El docente confirma; los temas no se marcan solos. */
function MarcarFallados({
  destino,
  temas,
  alMarcar,
}: {
  destino: { alumno: string } | { invitacion: number }
  temas: string[]
  alMarcar: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [estado, setEstado] = useState<'quieto' | 'enviando' | 'listo' | 'fallo'>('quieto')

  async function confirmar() {
    setEstado('enviando')
    try {
      const res = await fetch('/api/teacher/diagnosticos/marcar-temas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...destino, temas }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setEstado('listo')
      setAbierto(false)
      alMarcar()
    } catch {
      setEstado('fallo')
    }
  }

  return (
    <div>
      {/* Texto largo: a 390 px tiene que poder partirse en dos renglones. */}
      <Boton variante="secundario" className="whitespace-normal text-left" onClick={() => setAbierto(true)}>
        {R.marcar(temas.length)}
      </Boton>
      <p role="status" className={cn('nota mt-2 empty:hidden', estado === 'fallo' ? 'text-flojo' : 'text-texto-suave')}>
        {estado === 'listo' ? R.marcados : ''}
      </p>
      <Dialog open={abierto} onOpenChange={(siguiente) => estado !== 'enviando' && setAbierto(siguiente)}>
        <DialogContent className="rounded-lg border-borde sm:max-w-[440px]">
          <DialogTitle className="titulo-m text-texto">{R.marcarTitulo}</DialogTitle>
          <DialogDescription className="cuerpo-s text-texto-suave">{R.marcarDetalle}</DialogDescription>
          {estado === 'fallo' && (
            <p className="nota text-flojo" role="alert">
              {R.marcarFallo}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Boton variante="secundario" onClick={() => setAbierto(false)} disabled={estado === 'enviando'}>
              {R.cancelar}
            </Boton>
            <Boton onClick={confirmar} disabled={estado === 'enviando'}>
              {estado === 'enviando' && <Cargando />}
              {estado === 'enviando' ? R.marcando : R.marcarConfirmar}
            </Boton>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
