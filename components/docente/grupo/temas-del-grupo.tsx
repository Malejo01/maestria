'use client'

import { AccuracyBar } from '@/components/classroom-report-parts'
import { PAGINA_DEL_GRUPO } from '@/lib/textos'
import type { TemaDelGrupo } from './use-informe-del-grupo'

const T = PAGINA_DEL_GRUPO.temas

/** M3: la pestaña Temas. Los temas del grupo de peor a mejor. */
export function TemasDelGrupo({ temas }: { temas: TemaDelGrupo[] }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-borde bg-superficie-tarjeta p-4">
      <h2 className="cuerpo font-bold text-texto">{T.titulo}</h2>
      {temas.length === 0 ? (
        <p className="cuerpo-s text-texto-suave">{T.vacio}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {temas.map((tema) => (
            <li key={tema.topicName} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="cuerpo-s min-w-0 break-words text-texto">{tema.topicName}</span>
                <span className="nota shrink-0 whitespace-nowrap text-texto-suave">
                  {T.detalle(tema.correct, tema.total, tema.studentCount)}
                </span>
              </div>
              <AccuracyBar accuracy={tema.accuracy} />
            </li>
          ))}
        </ul>
      )}
      <p className="nota text-texto-suave">{T.pie}</p>
    </section>
  )
}
