import { auth } from '@/auth'
import { NextResponse } from 'next/server'
import { resolveSubjectMetaBatch } from '@/lib/subjects'
import { captureRouteFailure } from '@/lib/observability'

const MAX_NAMES = 20

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const namesParam = searchParams.get('names') || ''
  const names = namesParam
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
    .slice(0, MAX_NAMES)

  if (names.length === 0) {
    return NextResponse.json({ subjects: {} })
  }

  try {
    const subjects = await resolveSubjectMetaBatch(names)
    return NextResponse.json({ subjects })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/subjects/meta', operation: 'GET' })
    return NextResponse.json(
      { error: 'No se pudo resolver metadata de materias', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
