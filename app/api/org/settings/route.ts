import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { ORG_SETTINGS_COL } from '@/lib/org-operations'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('orgId') || ''
  if (!orgId) return NextResponse.json({ ok: false, error: 'orgId required' }, { status: 400 })
  const ref = doc(db, ORG_SETTINGS_COL, orgId)
  const snap = await getDoc(ref)
  return NextResponse.json({ ok: true, settings: snap.exists() ? snap.data() : null })
}

export async function PATCH(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('orgId') || ''
  if (!orgId) return NextResponse.json({ ok: false, error: 'orgId required' }, { status: 400 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }) }

  const ref = doc(db, ORG_SETTINGS_COL, orgId)
  await setDoc(ref, { ...body, updatedAt: new Date().toISOString() }, { merge: true })
  return NextResponse.json({ ok: true })
}
