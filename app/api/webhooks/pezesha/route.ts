/**
 * POST /api/webhooks/pezesha
 * Handle webhook notifications from Pezesha
 * Events: application.approved, application.rejected, disbursement.completed, repayment.received
 */

import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { pezeshaClient, type PezeshaWebhookPayload } from '@/lib/pezesha-api'
import { getFirebaseAdminDb } from '@/lib/firebase-admin'

const db = getFirebaseAdminDb()

// ============================================================================
// Webhook Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text()
    const signature = request.headers.get('x-pezesha-signature') || ''

    // Verify webhook signature
    const webhookPayload = pezeshaClient.parseWebhook(rawBody, signature)
    
    if (!webhookPayload) {
      console.error('Invalid webhook signature')
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 401 }
      )
    }

    console.log('Pezesha webhook received:', {
      event: webhookPayload.event,
      timestamp: webhookPayload.timestamp,
      retailerId: webhookPayload.data.retailerId,
    })

    // Route to appropriate handler
    switch (webhookPayload.event) {
      case 'application.approved':
        await handleApplicationApproved(webhookPayload)
        break
      case 'application.rejected':
        await handleApplicationRejected(webhookPayload)
        break
      case 'disbursement.completed':
        await handleDisbursementCompleted(webhookPayload)
        break
      case 'disbursement.failed':
        await handleDisbursementFailed(webhookPayload)
        break
      case 'repayment.received':
        await handleRepaymentReceived(webhookPayload)
        break
      case 'repayment.overdue':
        await handleRepaymentOverdue(webhookPayload)
        break
      default:
        console.warn('Unknown webhook event:', webhookPayload.event)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Webhook processing error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * Handle application approved event
 */
async function handleApplicationApproved(payload: PezeshaWebhookPayload) {
  const { applicationId, retailerId, amount, status } = payload.data

  console.log('Processing application approval:', { applicationId, retailerId, amount })

  // Find application in Firestore
  const applicationsQuery = await db
    .collectionGroup('credit_applications')
    .where('applicationId', '==', applicationId)
    .limit(1)
    .get()

  if (applicationsQuery.empty) {
    console.error('Application not found:', applicationId)
    return
  }

  const applicationDoc = applicationsQuery.docs[0]
  const applicationData = applicationDoc.data()
  const orgId = applicationData.organizationId

  // Update application status
  await applicationDoc.ref.update({
    status: 'approved',
    approvedAt: FieldValue.serverTimestamp(),
    'pezeshaResponse.approvedAmount': amount,
    'pezeshaResponse.creditLimit': amount,
    'pezeshaResponse.status': status,
    updatedAt: FieldValue.serverTimestamp(),
  })

  // Create credit facility
  const facilityRef = db
    .collection('organizations')
    .doc(orgId)
    .collection('credit_facilities')
    .doc()

  await facilityRef.set({
    id: facilityRef.id,
    facilityId: facilityRef.id,
    retailerId,
    organizationId: orgId,
    applicationId,
    approvedAmount: amount,
    currency: 'KES',
    interestRate: payload.data.interestRate || 12,
    tenorDays: payload.data.tenorDays || 30,
    totalDisbursed: 0,
    totalRepaid: 0,
    outstandingBalance: 0,
    availableCredit: amount,
    creditUtilization: 0,
    status: 'active',
    activatedAt: FieldValue.serverTimestamp(),
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
    lastDisbursementAt: null,
    lastRepaymentAt: null,
    pezeshaFacilityId: applicationId,
    pezeshaStatus: 'active',
    limitHistory: [],
    metrics: {
      totalDisbursements: 0,
      successfulRepayments: 0,
      lateRepayments: 0,
      averageRepaymentLagDays: 0,
      currentStreak: 0,
      longestStreak: 0,
    },
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })

  console.log('Credit facility created:', facilityRef.id)

  // TODO: Send notification to retailer (email/SMS)
}

/**
 * Handle application rejected event
 */
async function handleApplicationRejected(payload: PezeshaWebhookPayload) {
  const { applicationId, retailerId } = payload.data

  console.log('Processing application rejection:', { applicationId, retailerId })

  // Find application
  const applicationsQuery = await db
    .collectionGroup('credit_applications')
    .where('applicationId', '==', applicationId)
    .limit(1)
    .get()

  if (applicationsQuery.empty) {
    console.error('Application not found:', applicationId)
    return
  }

  const applicationDoc = applicationsQuery.docs[0]

  // Update application status
  await applicationDoc.ref.update({
    status: 'rejected',
    reviewedAt: FieldValue.serverTimestamp(),
    'pezeshaResponse.rejectionReason': payload.data.message || 'Application rejected by Pezesha',
    'pezeshaResponse.status': 'rejected',
    updatedAt: FieldValue.serverTimestamp(),
  })

  console.log('Application marked as rejected:', applicationId)

  // TODO: Send notification to retailer
}

/**
 * Handle disbursement completed event
 */
async function handleDisbursementCompleted(payload: PezeshaWebhookPayload) {
  const { disbursementId, retailerId, amount } = payload.data

  console.log('Processing disbursement completion:', { disbursementId, retailerId, amount })

  // Find disbursement
  const disbursementsQuery = await db
    .collectionGroup('credit_disbursements')
    .where('pezeshaDisbursementId', '==', disbursementId)
    .limit(1)
    .get()

  if (disbursementsQuery.empty) {
    console.error('Disbursement not found:', disbursementId)
    return
  }

  const disbursementDoc = disbursementsQuery.docs[0]
  const disbursementData = disbursementDoc.data()
  const orgId = disbursementData.organizationId
  const facilityId = disbursementData.facilityId

  // Validate required fields
  if (!amount || !disbursementData.repaymentAmount) {
    console.error('Missing required amount fields in disbursement data')
    return
  }

  // Update disbursement status
  await disbursementDoc.ref.update({
    status: 'completed',
    completedAt: FieldValue.serverTimestamp(),
    pezeshaTransactionRef: payload.data.transactionReference || null,
    pezeshaStatus: 'completed',
    updatedAt: FieldValue.serverTimestamp(),
  })

  // Update facility balances
  const facilityRef = db
    .collection('organizations')
    .doc(orgId)
    .collection('credit_facilities')
    .doc(facilityId)

  await facilityRef.update({
    totalDisbursed: FieldValue.increment(amount),
    outstandingBalance: FieldValue.increment(disbursementData.repaymentAmount),
    availableCredit: FieldValue.increment(-amount),
    creditUtilization: 0, // Will be recalculated
    lastDisbursementAt: FieldValue.serverTimestamp(),
    'metrics.totalDisbursements': FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  })

  // Recalculate credit utilization
  const facilitySnap = await facilityRef.get()
  const facilityData = facilitySnap.data()
  if (facilityData) {
    const utilization = (facilityData.outstandingBalance / facilityData.approvedAmount) * 100
    await facilityRef.update({ creditUtilization: utilization })
  }

  // Create repayment schedule
  const scheduleRef = db
    .collection('organizations')
    .doc(orgId)
    .collection('repayment_schedules')
    .doc()

  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now

  await scheduleRef.set({
    id: scheduleRef.id,
    scheduleId: scheduleRef.id,
    facilityId,
    disbursementId: disbursementDoc.id,
    retailerId,
    organizationId: orgId,
    totalAmount: disbursementData.repaymentAmount,
    principalAmount: disbursementData.principalAmount,
    interestAmount: disbursementData.interestAmount,
    currency: 'KES',
    dueDate,
    remindersSent: 0,
    lastReminderAt: null,
    status: 'pending',
    amountPaid: 0,
    amountOutstanding: disbursementData.repaymentAmount,
    payments: [],
    daysOverdue: 0,
    overdueAt: null,
    lateFees: 0,
    pezeshaScheduleId: null,
    pezeshaRepaymentIds: [],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    paidAt: null,
  })

  console.log('Disbursement completed and repayment schedule created:', scheduleRef.id)

  // TODO: Send disbursement confirmation notification
}

/**
 * Handle disbursement failed event
 */
async function handleDisbursementFailed(payload: PezeshaWebhookPayload) {
  const { disbursementId, retailerId } = payload.data

  console.log('Processing disbursement failure:', { disbursementId, retailerId })

  // Find disbursement
  const disbursementsQuery = await db
    .collectionGroup('credit_disbursements')
    .where('pezeshaDisbursementId', '==', disbursementId)
    .limit(1)
    .get()

  if (disbursementsQuery.empty) {
    console.error('Disbursement not found:', disbursementId)
    return
  }

  const disbursementDoc = disbursementsQuery.docs[0]

  // Update disbursement status
  await disbursementDoc.ref.update({
    status: 'failed',
    failedAt: FieldValue.serverTimestamp(),
    pezeshaStatus: 'failed',
    error: {
      code: payload.data.errorCode || 'unknown',
      message: payload.data.message || 'Disbursement failed',
      timestamp: FieldValue.serverTimestamp(),
    },
    updatedAt: FieldValue.serverTimestamp(),
  })

  console.log('Disbursement marked as failed:', disbursementId)

  // TODO: Send failure notification and allow retry
}

/**
 * Handle repayment received event
 */
async function handleRepaymentReceived(payload: PezeshaWebhookPayload) {
  const { repaymentId, disbursementId, retailerId, amount } = payload.data

  console.log('Processing repayment:', { repaymentId, disbursementId, retailerId, amount })

  // Find repayment schedule
  const schedulesQuery = await db
    .collectionGroup('repayment_schedules')
    .where('retailerId', '==', retailerId)
    .where('status', '==', 'pending')
    .orderBy('dueDate', 'asc')
    .limit(1)
    .get()

  if (schedulesQuery.empty) {
    console.error('No pending repayment schedule found for retailer:', retailerId)
    return
  }

  const scheduleDoc = schedulesQuery.docs[0]
  const scheduleData = scheduleDoc.data()
  const orgId = scheduleData.organizationId
  const facilityId = scheduleData.facilityId

  // Validate required fields
  if (!amount) {
    console.error('Missing required amount field in repayment data')
    return
  }

  // Update schedule
  const newAmountPaid = scheduleData.amountPaid + amount
  const newAmountOutstanding = Math.max(scheduleData.totalAmount - newAmountPaid, 0)
  const isPaid = newAmountOutstanding === 0

  await scheduleDoc.ref.update({
    amountPaid: newAmountPaid,
    amountOutstanding: newAmountOutstanding,
    status: isPaid ? 'paid' : 'partially_paid',
    payments: FieldValue.arrayUnion({
      paymentId: repaymentId,
      amount,
      method: payload.data.paymentMethod || 'mpesa',
      transactionRef: payload.data.transactionReference || '',
      paidAt: FieldValue.serverTimestamp(),
      notes: null,
    }),
    pezeshaRepaymentIds: FieldValue.arrayUnion(repaymentId),
    paidAt: isPaid ? FieldValue.serverTimestamp() : null,
    updatedAt: FieldValue.serverTimestamp(),
  })

  // Update facility
  const facilityRef = db
    .collection('organizations')
    .doc(orgId)
    .collection('credit_facilities')
    .doc(facilityId)

  await facilityRef.update({
    totalRepaid: FieldValue.increment(amount),
    outstandingBalance: FieldValue.increment(-amount),
    availableCredit: FieldValue.increment(amount),
    lastRepaymentAt: FieldValue.serverTimestamp(),
    'metrics.successfulRepayments': FieldValue.increment(1),
    'metrics.currentStreak': FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  })

  // Recalculate credit utilization
  const facilitySnap = await facilityRef.get()
  const facilityData = facilitySnap.data()
  if (facilityData) {
    const utilization = (facilityData.outstandingBalance / facilityData.approvedAmount) * 100
    const longestStreak = Math.max(facilityData.metrics.longestStreak, facilityData.metrics.currentStreak)
    await facilityRef.update({
      creditUtilization: utilization,
      'metrics.longestStreak': longestStreak,
    })
  }

  console.log('Repayment processed successfully:', repaymentId)

  // TODO: Recalculate credit score
  // TODO: Check for auto-limit increase eligibility
  // TODO: Send payment confirmation
}

/**
 * Handle repayment overdue event
 */
async function handleRepaymentOverdue(payload: PezeshaWebhookPayload) {
  const { retailerId, disbursementId, daysOverdue } = payload.data

  console.log('Processing overdue payment:', { retailerId, disbursementId, daysOverdue })

  // Find repayment schedule
  const schedulesQuery = await db
    .collectionGroup('repayment_schedules')
    .where('retailerId', '==', retailerId)
    .where('status', 'in', ['pending', 'partially_paid'])
    .get()

  for (const scheduleDoc of schedulesQuery.docs) {
    const scheduleData = scheduleDoc.data()
    const dueDate = new Date(scheduleData.dueDate.seconds * 1000)
    const now = new Date()
    const overdueDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))

    if (overdueDays > 0) {
      await scheduleDoc.ref.update({
        status: 'overdue',
        daysOverdue: overdueDays,
        overdueAt: scheduleData.overdueAt || FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })

      // Calculate late fees (2% per week overdue)
      const weeksOverdue = Math.ceil(overdueDays / 7)
      const lateFees = scheduleData.totalAmount * 0.02 * weeksOverdue

      await scheduleDoc.ref.update({
        lateFees,
        amountOutstanding: scheduleData.amountOutstanding + lateFees,
      })

      console.log('Late fees applied:', { scheduleId: scheduleDoc.id, lateFees, overdueDays })
    }
  }

  // Update facility - break payment streak
  const facilitiesQuery = await db
    .collectionGroup('credit_facilities')
    .where('retailerId', '==', retailerId)
    .where('status', '==', 'active')
    .limit(1)
    .get()

  if (!facilitiesQuery.empty) {
    const facilityDoc = facilitiesQuery.docs[0]
    await facilityDoc.ref.update({
      'metrics.currentStreak': 0,
      'metrics.lateRepayments': FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    })
  }

  // TODO: Send overdue payment reminder
  // TODO: Recalculate credit score (penalty)
}

// ============================================================================
// GET Method (Webhook Health Check)
// ============================================================================

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'pezesha-webhook',
    timestamp: new Date().toISOString(),
  })
}
