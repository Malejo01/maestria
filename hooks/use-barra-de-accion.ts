'use client'

import { useCallback, useLayoutEffect, useState } from 'react'

/**
 * P6 · La barra de acción fija de abajo (cuestionario y resultados) publica su
 * alto real en `--alto-barra-de-accion` (en <html>), y el botón de "Reportar
 * un problema" se apoya encima con esa variable.
 *
 * Antes el botón buscaba la barra con `querySelector` cuando cambiaba la
 * vista y la observaba. En la última pregunta la barra se vuelve a montar (otro
 * elemento: "Ver resultados" en lugar de "Siguiente"), el observador se quedaba
 * con el elemento viejo, ya fuera del DOM, que mide 0, y el botón bajaba encima
 * de "Ver resultados" (medido con `boundingBox` a 360 y 390 px). Con un ref de
 * callback, cada elemento nuevo de la barra se mide solo.
 *
 * Devuelve el ref para la barra.
 */
export function useBarraDeAccion() {
  const [barra, setBarra] = useState<HTMLElement | null>(null)
  const ref = useCallback((el: HTMLElement | null) => setBarra(el), [])

  useLayoutEffect(() => {
    if (!barra) return
    const raiz = document.documentElement
    // offsetHeight y no contentRect: el padding de abajo lleva el
    // env(safe-area-inset-bottom), justo lo que importa en un teléfono.
    const medir = () => {
      if (barra.isConnected) raiz.style.setProperty('--alto-barra-de-accion', `${barra.offsetHeight}px`)
    }
    medir()
    // Sin ResizeObserver (navegadores muy viejos, jsdom): queda la primera medida.
    if (typeof ResizeObserver === 'undefined') return () => raiz.style.removeProperty('--alto-barra-de-accion')
    const observador = new ResizeObserver(medir)
    observador.observe(barra)
    return () => {
      observador.disconnect()
      raiz.style.removeProperty('--alto-barra-de-accion')
    }
  }, [barra])

  return ref
}
