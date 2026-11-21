'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Check, ClipboardCheck, Copy, RefreshCw, Send } from 'lucide-react'
import { ArmarDiagnostico } from '@/components/docente/armar-diagnostico'
import { CargaFallida } from '@/components/carga-fallida'
import { formatScore } from '@/components/classroom-report-parts'
import { Boton } from '@/components/sistema/boton'
import { Cargando } from '@/components/sistema/cargando'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { PESTANAS_DEL_GRUPO, rutaDePestana, type PestanaDelGrupo } from '@/lib/grupo-del-docente'
import { pedirJson } from '@/lib/pedir-json'
import { MIS_GRUPOS, PAGINA_DEL_GRUPO as T } from '@/lib/textos'
import { cn } from '@/lib/utils'
import { AvisoDeInvitados } from './aviso-de-invitados'
import { DiagnosticosDelGrupo, useDiagnosticosDelGrupo } from './diagnosticos-del-grupo'
import { MandarTareaAlGrupo } from './mandar-tarea-al-grupo'
import { PlanillaDelGrupo, type OtroGrupo } from './planilla-del-grupo'
import { TareasDelGrupo } from './tareas-del-grupo'
import { TemasDelGrupo } from './temas-del-grupo'
import { useInformeDelGrupo } from './use-informe-del-grupo'

export interface GrupoDeLaPagina {
  id: number
  nombre: string
  codigo: string
  estado: 'open' | 'closed'
  materiaId: number
  materia: string
  nivel: string | null
  grado: string | null
}

/** Una fila de GET /api/teacher/classrooms (lo que hace falta acá). */
interface FilaDeGrupo extends OtroGrupo {
  join_code: string
  status: 'open' | 'closed'
  new_guests_today: number
  guest_join_limit: number
}

/**
 * M3: la página de un grupo. Arriba, lo que identifica al grupo y lo que se
 * hace con él (armar un diagnóstico o práctica, mandar una tarea, cerrar);
 * abajo, el seguimiento en pestañas que van en la URL. Reemplaza a la vista
 * vieja de un aula (components/teacher-classrooms.tsx) y a la gestión plegada
 * de *Mis grupos*: todo lo que tenían vive acá.
 */
export function PaginaDelGrupo({
  grupo: inicial,
  pestana,
  nuevo,
}: {
  grupo: GrupoDeLaPagina
  pestana: PestanaDelGrupo
  nuevo: boolean
}) {
  const router = useRouter()
  const consulta = useSearchParams()
  const [grupo, setGrupo] = useState(inicial)
  const [fila, setFila] = useState<FilaDeGrupo | null>(null)
  const [otros, setOtros] = useState<OtroGrupo[]>([])
  const [copiado, setCopiado] = useState(false)
  const [armando, setArmando] = useState(false)
  const [mandando, setMandando] = useState(false)
  const [regenerando, setRegenerando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [aviso, setAviso] = useState<string | null>(nuevo ? T.nuevo : null)

  const { informe, error, leer: leerInforme } = useInformeDelGrupo(grupo.id)
  const { datos: diagnosticos, leer: leerDiagnosticos } = useDiagnosticosDelGrupo(grupo.id)

  const leerGrupo = useCallback(async () => {
    const respuesta = await pedirJson<{ classrooms: FilaDeGrupo[] }>('/api/teacher/classrooms')
    if ('error' in respuesta) return
    const todos = respuesta.data.classrooms ?? []
    const este = todos.find((g) => Number(g.id) === grupo.id) ?? null
    setFila(este)
    if (este) setGrupo((g) => ({ ...g, codigo: este.join_code, estado: este.status, nombre: este.name }))
    setOtros(todos.filter((g) => Number(g.id) !== grupo.id))
  }, [grupo.id])

  useEffect(() => {
    void leerGrupo()
  }, [leerGrupo])

  const releerTodo = useCallback(() => {
    void leerInforme()
    void leerGrupo()
    void leerDiagnosticos()
  }, [leerInforme, leerGrupo, leerDiagnosticos])

  const link = typeof window === 'undefined' ? `/aula/${grupo.codigo}` : `${window.location.origin}/aula/${grupo.codigo}`
  const alumnos = informe?.students ?? []
  const tareasDelGrupo = (informe?.assignments ?? []).filter((t) => !t.individual)
  const listaDeDiagnosticos = diagnosticos?.diagnosticos ?? []

  async function cambiarEstado(estado: 'open' | 'closed') {
    setOcupado(true)
    const respuesta = await pedirJson(`/api/teacher/classrooms/${grupo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: estado }),
    })
    setOcupado(false)
    if ('error' in respuesta) return setAviso(respuesta.error)
    if (estado === 'closed') router.push('/teacher?vista=grupos')
    else releerTodo()
  }

  async function regenerarCodigo() {
    setOcupado(true)
    const respuesta = await pedirJson(`/api/teacher/classrooms/${grupo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ regenerateCode: true }),
    })
    setOcupado(false)
    setRegenerando(false)
    setAviso('error' in respuesta ? respuesta.error : T.codigoNuevo)
    setCopiado(false)
    void leerGrupo()
  }

  const cantidades: Record<PestanaDelGrupo, number> = {
    alumnos: alumnos.length,
    tareas: tareasDelGrupo.length,
    temas: informe?.topics.length ?? 0,
    diagnosticos: listaDeDiagnosticos.length,
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href="/teacher?vista=grupos" className="cuerpo-s inline-flex min-h-11 items-center gap-1 self-start text-texto-suave hover:text-texto">
        <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={TRAZO_ICONO} />
        {T.volver}
      </Link>

      <header className="flex flex-col gap-4 rounded-lg border border-borde bg-superficie-tarjeta p-4 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="nota text-texto-suave">{grupo.materia}</p>
            <h1 className="titulo-l break-words text-texto">{grupo.nombre}</h1>
            <p className="nota mt-1 text-texto-suave">
              {T.codigo(grupo.codigo)} · {T.alumnos(alumnos.length)}
            </p>
            {grupo.estado === 'closed' && <p className="nota mt-1 font-semibold text-flojo">{T.cerrado}</p>}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {diagnosticos?.disponible && diagnosticos.grupo && grupo.estado === 'open' && (
              <Boton onClick={() => setArmando(true)}>
                <ClipboardCheck aria-hidden="true" strokeWidth={TRAZO_ICONO} />
                {MIS_GRUPOS.armar}
              </Boton>
            )}
            {grupo.estado === 'open' && (
              <Boton variante="secundario" onClick={() => setMandando(true)}>
                <Send aria-hidden="true" strokeWidth={TRAZO_ICONO} />
                {T.mandarTarea}
              </Boton>
            )}
            <Boton
              variante="secundario"
              disabled={ocupado}
              onClick={() => void cambiarEstado(grupo.estado === 'open' ? 'closed' : 'open')}
            >
              {grupo.estado === 'open' ? MIS_GRUPOS.cerrar : T.reabrir}
            </Boton>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <code className="nota min-w-0 break-all rounded-sm bg-superficie-base px-2 py-1 text-texto">{link}</code>
          <Boton
            variante="secundario"
            aria-label={MIS_GRUPOS.copiarLink(grupo.nombre)}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link)
                setCopiado(true)
              } catch {
                setCopiado(false)
              }
            }}
          >
            {copiado ? <Check aria-hidden="true" strokeWidth={TRAZO_ICONO} /> : <Copy aria-hidden="true" strokeWidth={TRAZO_ICONO} />}
            <span aria-live="polite">{copiado ? MIS_GRUPOS.copiado : MIS_GRUPOS.copiar}</span>
          </Boton>
          <Boton variante="secundario" disabled={ocupado} onClick={() => setRegenerando(true)}>
            <RefreshCw aria-hidden="true" strokeWidth={TRAZO_ICONO} />
            {T.regenerarCodigo}
          </Boton>
        </div>

        {aviso && (
          <p className="cuerpo-s rounded-md border border-borde bg-superficie-suave p-3 text-texto" role="status">
            {aviso}
          </p>
        )}
        {fila && <AvisoDeInvitados nuevos={fila.new_guests_today} tope={fila.guest_join_limit} />}
      </header>

      {informe?.summary && (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            [String(informe.summary.studentCount), T.resumen.alumnos],
            [formatScore(informe.summary.groupAverage), T.resumen.promedio],
            [String(informe.summary.totalAttempts), T.resumen.resueltos],
            [String(informe.summary.inactiveCount), T.resumen.sinActividad],
          ].map(([valor, etiqueta], i) => (
            <div
              key={etiqueta}
              className={cn(
                'rounded-lg border border-borde bg-superficie-tarjeta p-3',
                i === 3 && informe.summary!.inactiveCount > 0 && 'border-flojo bg-flojo-fondo',
              )}
            >
              <dd className="titulo-m tabular-nums text-texto">{valor}</dd>
              <dt className="nota text-texto-suave">{etiqueta}</dt>
            </div>
          ))}
        </dl>
      )}

      <nav aria-label={T.pestanas.etiqueta} className="-mx-4 flex gap-1 overflow-x-auto border-b border-borde px-4 sm:mx-0 sm:px-0">
        {PESTANAS_DEL_GRUPO.map((p) => (
          <Link
            key={p}
            href={rutaDePestana(grupo.id, p, new URLSearchParams(consulta?.toString() ?? ''))}
            scroll={false}
            aria-current={pestana === p ? 'page' : undefined}
            className={cn(
              'cuerpo-s -mb-px flex min-h-11 shrink-0 items-center border-b-2 px-3 font-bold',
              pestana === p ? 'border-accion text-texto' : 'border-transparent text-texto-suave hover:text-texto',
            )}
          >
            {T.pestanas[p](cantidades[p])}
          </Link>
        ))}
      </nav>

      {error && !informe ? (
        <div className="rounded-lg border border-borde bg-superficie-tarjeta">
          <CargaFallida que={T.queCargamos} detalle={error} onReintentar={leerInforme} />
        </div>
      ) : !informe ? (
        <p className="cuerpo-s flex items-center gap-2 text-texto-suave" role="status">
          <Cargando /> {T.cargando}
        </p>
      ) : pestana === 'alumnos' ? (
        <PlanillaDelGrupo
          grupoId={grupo.id}
          nombreDelGrupo={grupo.nombre}
          codigo={grupo.codigo}
          alumnos={alumnos}
          otrosGrupos={otros}
          alCambiar={releerTodo}
        />
      ) : pestana === 'tareas' ? (
        <TareasDelGrupo grupoId={grupo.id} tareas={informe.assignments} alCambiar={releerTodo} />
      ) : pestana === 'temas' ? (
        <TemasDelGrupo temas={informe.topics} />
      ) : (
        <DiagnosticosDelGrupo grupoId={grupo.id} diagnosticos={listaDeDiagnosticos} />
      )}

      {diagnosticos?.grupo && (
        <ArmarDiagnostico
          abierto={armando}
          onCambiar={(abre) => {
            setArmando(abre)
            if (!abre) releerTodo()
          }}
          destino={{ grupo: grupo.id }}
          materia={diagnosticos.grupo.materia}
          unidades={diagnosticos.grupo.unidades}
          temasDificiles={[]}
          alTerminar={leerDiagnosticos}
        />
      )}

      <MandarTareaAlGrupo
        abierto={mandando}
        onCambiar={setMandando}
        grupoId={grupo.id}
        materiaId={grupo.materiaId}
        alMandar={releerTodo}
      />

      <Dialog open={regenerando} onOpenChange={setRegenerando}>
        <DialogContent className="rounded-lg border-borde sm:max-w-[440px]">
          <DialogTitle className="titulo-m text-texto">{T.regenerarDialogo.titulo}</DialogTitle>
          <DialogDescription className="cuerpo-s text-texto-suave">{T.regenerarDialogo.detalle}</DialogDescription>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Boton variante="secundario" onClick={() => setRegenerando(false)}>
              {T.regenerarDialogo.cancelar}
            </Boton>
            <Boton disabled={ocupado} onClick={() => void regenerarCodigo()}>
              {ocupado ? <Cargando /> : null}
              {T.regenerarDialogo.confirmar}
            </Boton>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
