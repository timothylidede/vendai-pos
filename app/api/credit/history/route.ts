import { NextRequest, NextResponse } from 'next/server'
import { collection, doc, getDocs, limit, orderBy, query } from 'firebase/firestore'

import { db } from '@/lib/firebase'
import { sanitizeInput, schemas } from '@/lib/validation'

const historyCollection = (retailerId: string) => collection(doc(db, 'credit_profiles', retailerId), 'assessments')

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const retailerId = searchParams.get('retailerId') ?? ''
  const rawLimit = searchParams.get('limit')

  const parsedLimit = rawLimit ? Number(rawLimit) : undefined
  const payload = {
    retailerId,
    limit: Number.isFinite(parsedLimit ?? NaN) ? parsedLimit : undefined,
  }

  let validated: { retailerId: string; limit?: number }
  try {
    validated = sanitizeInput(payload, schemas.creditHistoryQuery)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid query parameters'
    return NextResponse.json({ success: false, error: message }, { status: 422 })
  }

  const maxItems = validated.limit ?? 25

  const historyQuery = query(historyCollection(validated.retailerId), orderBy('createdAt', 'desc'), limit(maxItems))
  const snapshot = await getDocs(historyQuery)

  const history = snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Record<string, any>
    const createdAt = data.createdAt
    const createdIso = createdAt?.toDate?.() ? createdAt.toDate().toISOString() : null

    return {
      id: docSnap.id,
      createdAt: createdIso,
      input: data.input ?? null,
      options: data.options ?? null,
      result: data.result ?? null,
    }
  })

  return NextResponse.json({ success: true, history })
}
