import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { auth } from '@/auth'

export async function GET() {
  try {
    const session = await auth()
    const userId = session?.user?.id ?? null

    if (!userId) {
      return NextResponse.json({ tips: [] })
    }

    const rows = await sql`
      SELECT 
        id,
        user_id AS "userId",
        subject,
        topic_id AS "topicId",
        topic_name AS "topicName",
        misconception_type AS "misconceptionType",
        tip,
        resolved,
        created_at AS "createdAt"
      FROM student_misconceptions
      WHERE user_id = ${userId}
        AND tip <> ''
      ORDER BY created_at DESC
    `

    return NextResponse.json({ tips: rows })
  } catch (error) {
    console.error('[GET /api/user/tips] Error:', error)
    return NextResponse.json({ tips: [] })
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth()
    const userId = session?.user?.id ?? null

    const body = await req.json()
    const { subject, topicId, topicName, misconceptionType, tip } = body

    if (!subject || !topicName || !tip) {
      return NextResponse.json({ error: 'Campos obligatorios faltantes' }, { status: 400 })
    }

    if (!userId) {
      // For guest/offline mode, echo back payload for local Zustand store persistence
      return NextResponse.json({
        tip: {
          id: Date.now(),
          subject,
          topicId: topicId || topicName.toLowerCase().replace(/\s+/g, '-'),
          topicName,
          misconceptionType: misconceptionType || 'Confusión conceptual',
          tip,
          resolved: false,
          createdAt: new Date().toISOString(),
        }
      })
    }

    const safeTopicId = topicId || topicName.toLowerCase().replace(/\s+/g, '-')
    const safeMisconception = misconceptionType || 'Confusión conceptual detectada'

    const rows = await sql`
      INSERT INTO student_misconceptions (
        user_id, subject, topic_id, topic_name, misconception_type, tip
      ) VALUES (
        ${userId}, ${subject}, ${safeTopicId}, ${topicName}, ${safeMisconception}, ${tip}
      )
      RETURNING 
        id,
        user_id AS "userId",
        subject,
        topic_id AS "topicId",
        topic_name AS "topicName",
        misconception_type AS "misconceptionType",
        tip,
        resolved,
        created_at AS "createdAt"
    `

    return NextResponse.json({ tip: rows[0] })
  } catch (error: any) {
    console.error('[POST /api/user/tips] Error:', error)
    return NextResponse.json({ error: error?.message || 'Error al guardar apunte' }, { status: 500 })
  }
}
