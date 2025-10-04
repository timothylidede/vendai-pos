import { NextRequest, NextResponse } from 'next/server'
import { addDoc, collection, doc, serverTimestamp, setDoc } from 'firebase/firestore'

import { db } from '@/lib/firebase'
import { assessCredit, defaultCreditEngineOptions, type CreditAssessmentInput, type CreditAssessmentResult } from '@/lib/credit-engine'
import { sanitizeInput, schemas } from '@/lib/validation'

interface CreditAssessmentPayload extends CreditAssessmentInput {
  options?: Partial<typeof defaultCreditEngineOptions>
}

const historyCollection = (retailerId: string) => collection(doc(db, 'credit_profiles', retailerId), 'assessments')

export async function POST(request: NextRequest) {
  let body: CreditAssessmentPayload
  try {
    body = await request.json()
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 })
  }

  let parsed: CreditAssessmentPayload
  try {
    parsed = sanitizeInput(body, schemas.creditAssessmentInput)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid credit assessment payload'
    return NextResponse.json({ success: false, error: message }, { status: 422 })
  }

  const { options: overrides, ...input } = parsed
  const options = overrides
    ? { ...defaultCreditEngineOptions, ...overrides }
    : defaultCreditEngineOptions

  const assessment: CreditAssessmentResult = assessCredit(input as CreditAssessmentInput, options)

  const profileRef = doc(db, 'credit_profiles', input.retailerId)

  await setDoc(
    profileRef,
    {
      retailerId: input.retailerId,
      metrics: {
        trailingVolume90d: input.trailingVolume90d,
        orders90d: input.orders90d,
        currentOutstanding: input.currentOutstanding,
        existingCreditLimit: input.existingCreditLimit,
        creditUtilization: assessment.creditUtilization,
        consecutiveOnTimePayments: input.consecutiveOnTimePayments,
        daysSinceSignup: input.daysSinceSignup,
        manualAdjustment: input.manualAdjustment ?? 0,
        repaymentLagDays: input.repaymentLagDays,
        sectorRisk: input.sectorRisk,
        onTimePaymentRate: input.onTimePaymentRate,
        disputeRate: input.disputeRate,
        updatedAt: serverTimestamp(),
      },
      lastAssessment: assessment,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )

  await addDoc(historyCollection(input.retailerId), {
    result: assessment,
    input,
    options,
    createdAt: serverTimestamp(),
  })

  return NextResponse.json({ success: true, assessment })
}
