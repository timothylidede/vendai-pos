import { NextRequest, NextResponse } from 'next/server'
import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { z } from 'zod'

import { db } from '@/lib/firebase'
import { sanitizeInput, schemas } from '@/lib/validation'

export async function PATCH(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 })
  }

  type CreditLimitUpdatePayload = z.infer<typeof schemas.creditLimitUpdate>
  let parsed: CreditLimitUpdatePayload
  try {
    parsed = sanitizeInput(body as CreditLimitUpdatePayload, schemas.creditLimitUpdate)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid credit limit payload'
    return NextResponse.json({ success: false, error: message }, { status: 422 })
  }

  const profileRef = doc(db, 'credit_profiles', parsed.retailerId)
  const snapshot = await getDoc(profileRef)
  type CreditMetrics = {
    existingCreditLimit?: number
    manualAdjustment?: number
    [key: string]: unknown
  }
  const existingMetrics: CreditMetrics = snapshot.exists()
    ? ((snapshot.data()?.metrics as CreditMetrics | undefined) ?? {})
    : {}
  const previousLimit = typeof existingMetrics.existingCreditLimit === 'number' ? existingMetrics.existingCreditLimit : null

  const nextMetrics: CreditMetrics = {
    ...existingMetrics,
    existingCreditLimit: parsed.newLimit,
    updatedAt: serverTimestamp(),
  }

  if (parsed.manualAdjustment !== undefined) {
    nextMetrics.manualAdjustment = parsed.manualAdjustment
  }

  await setDoc(
    profileRef,
    {
      retailerId: parsed.retailerId,
      metrics: nextMetrics,
      lastManualLimitUpdate: serverTimestamp(),
      lastManualUpdater: {
        userId: parsed.updatedByUserId,
        name: parsed.updatedByName ?? null,
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )

  await addDoc(collection(profileRef, 'limit_adjustments'), {
    newLimit: parsed.newLimit,
    previousLimit,
    manualAdjustment: parsed.manualAdjustment ?? null,
    reason: parsed.reason ?? null,
    updatedByUserId: parsed.updatedByUserId,
    updatedByName: parsed.updatedByName ?? null,
    createdAt: serverTimestamp(),
  })

  return NextResponse.json({ success: true, previousLimit, newLimit: parsed.newLimit })
}
