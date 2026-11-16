'use client'

import { signIn } from 'next-auth/react'
import { DEV_LOGIN_PROVIDER_ID } from '@/lib/dev-login-id'

export function EntrarComo({ usuarios }: { usuarios: { id: string; etiqueta: string; detalle: string }[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {usuarios.map((usuario) => (
        <li key={usuario.id}>
          <button
            type="button"
            className="block w-full rounded-lg border border-borde-fuerte bg-superficie-tarjeta p-3 text-left hover:border-texto"
            onClick={() => signIn(DEV_LOGIN_PROVIDER_ID, { userId: usuario.id, callbackUrl: '/' })}
          >
            <span className="cuerpo-s block font-bold text-texto">{usuario.etiqueta}</span>
            <span className="nota block text-texto-suave">{usuario.detalle}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
