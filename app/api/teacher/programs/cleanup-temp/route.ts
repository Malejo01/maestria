import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { captureRouteFailure } from '@/lib/observability'

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization')
  const expected = `Bearer ${process.env.CRON_SECRET}`

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const deleted = await sql`
      DELETE FROM teacher_program_uploads
      WHERE expires_at <= NOW()
      RETURNING id
    `

    return NextResponse.json({ deleted: deleted.length })
  } catch (error) {
    captureRouteFailure(error, { endpoint: '/api/teacher/programs/cleanup-temp', operation: 'POST' })
    return NextResponse.json(
      { error: 'Cleanup failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
