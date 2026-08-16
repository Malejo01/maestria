'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { KeyRound, ChevronRight } from 'lucide-react'
import { JOIN_CODE_LENGTH, isValidJoinCode, normalizeJoinCode } from '@/lib/classrooms'

/**
 * Entrada de código de aula en el inicio.
 *
 * Por qué acá y no sólo en "Mis Aulas": el alumno que recibe un código por
 * WhatsApp llega al panel principal y no tiene dónde ponerlo — tiene que
 * descubrir que la puerta está en otra pantalla.
 *
 * Deliberadamente NO reimplementa el join. Normaliza, valida la longitud y
 * navega a `/aula/<code>`, que es la pantalla que ya resuelve los tres casos
 * (alumno con Google, invitado con cookie, invitado nuevo) y que ya vive fuera
 * del shell de `(app)` para saltear el gate de onboarding. Tener un segundo
 * camino de ingreso sería tener dos lugares donde arreglar el mismo bug.
 */
export function JoinClassroomField() {
  const router = useRouter()
  const [code, setCode] = useState('')

  const isComplete = isValidJoinCode(code)

  function submit() {
    if (!isComplete) return
    router.push(`/aula/${normalizeJoinCode(code)}`)
  }

  return (
    <Card className="p-4 border-2 border-border/80 bg-card rounded-2xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <KeyRound className="w-5 h-5" />
        </div>

        <div className="min-w-0 flex-1">
          <h4 className="font-bold text-foreground text-sm">¿Tenés un código de aula?</h4>
          <p className="text-xs text-muted-foreground font-medium">
            Ingresá los {JOIN_CODE_LENGTH} caracteres que te pasó tu docente.
          </p>
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        <Input
          value={code}
          // Se normaliza en cada tecla, así que el alumno puede pegar "ab3-ffl"
          // o escribir en minúscula y ve exactamente lo que se va a buscar.
          onChange={(event) => setCode(normalizeJoinCode(event.target.value).slice(0, JOIN_CODE_LENGTH))}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit()
          }}
          placeholder="ABC234"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-label="Código de aula"
          maxLength={JOIN_CODE_LENGTH}
          className="font-mono tracking-[0.3em] uppercase text-center text-base h-11"
        />

        <Button
          onClick={submit}
          disabled={!isComplete}
          className="h-11 px-4 font-bold rounded-xl shrink-0 gap-1"
        >
          <span>Entrar</span>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  )
}
