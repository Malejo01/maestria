'use client'

import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Download } from 'lucide-react'
import { Boton } from '@/components/sistema/boton'
import { TRAZO_ICONO } from '@/components/sistema/iconos'
import { debeOfrecerInstalar } from '@/lib/pwa'
import { contarPractica, esIOS, estaInstalada, marcarOfrecido, pedirInstalacion, sePuedeInstalar, yaSeOfrecio } from '@/lib/instalar-cliente'
import { PWA } from '@/lib/textos'

const T = PWA.instalar

/**
 * Ronda X · X4 — "Instalá MaestrIA", en los resultados de una práctica: una
 * sola vez, después de la segunda, y sólo si el navegador permite instalar
 * (en el iPhone, con la explicación de cómo).
 */
export function OfrecerInstalar({ intento }: { intento: string }) {
  const sinMovimiento = useReducedMotion()
  // Se decide al montar (esta pantalla sólo existe en el navegador). Contar es
  // idempotente por intento; marcarlo como ofrecido va en el efecto, para que
  // el doble render de StrictMode no lo marque antes de mostrarlo.
  const [visible, setVisible] = useState(
    () =>
      typeof window !== 'undefined' &&
      debeOfrecerInstalar({ practicas: contarPractica(intento), yaOfrecido: yaSeOfrecio(), instalable: sePuedeInstalar(), instalada: estaInstalada() }),
  )

  useEffect(() => {
    if (visible) marcarOfrecido()
  }, [visible])

  if (!visible) return null
  const ios = esIOS()
  return (
    <motion.section
      initial={sinMovimiento ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: sinMovimiento ? 0 : 0.2 }}
      className="space-y-3 rounded-lg border border-borde bg-superficie-suave p-4"
      aria-labelledby="instalar-maestria"
      data-instalar
    >
      <div className="space-y-1">
        <h2 id="instalar-maestria" className="titulo-s text-texto">
          {T.titulo}
        </h2>
        <p className="cuerpo-s text-texto-suave">{ios ? T.ios : T.detalle}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {!ios && (
          <Boton
            variante="secundario"
            onClick={async () => {
              await pedirInstalacion()
              setVisible(false)
            }}
          >
            <Download className="size-4" aria-hidden="true" strokeWidth={TRAZO_ICONO} />
            {T.boton}
          </Boton>
        )}
        <Boton variante="secundario" onClick={() => setVisible(false)}>
          {T.ahoraNo}
        </Boton>
      </div>
    </motion.section>
  )
}
