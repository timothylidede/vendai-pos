/**
 * POST /api/credit/disburse
 * Request credit disbursement to supplier
 */

import { NextRequest, NextResponse } from 'next/server'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { pezeshaClient, generateDisbursementReference } from '@/lib/pezesha-api'
import { getFirebaseAdminDb } from '@/lib/firebase-admin'

const db = getFirebaseAdminDb()

// ============================================================================
// Request/Response Types
// ============================================================================

interface DisbursementRequest {
  retailerId: string
  organizationId: string
  orderId: string
  supplierId: string
  supplierName: string
  supplierPhone: string
  supplierBankAccount?: {
    accountNumber: string
    bankCode: string
    accountName: string
  }
  amount: number
  purpose: string
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: DisbursementRequest = await request.json()
    const {
      retailerId,
      organizationId,
      orderId,
      supplierId,
      supplierName,
      supplierPhone,
      supplierBankAccount,
      amount,
      purpose,
    } = body

    // Validate required fields
    if (!retailerId || !organizationId || !amount || !supplierName) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Amount must be greater than zero' },
        { status: 400 }
      )
    }

    // Get active credit facility
    const facilitiesRef = db
      .collection('organizations')
      .doc(organizationId)
      .collection('credit_facilities')

    const facilitiesQuery = await facilitiesRef
      .where('retailerId', '==', retailerId)
      .where('status', '==', 'active')
      .limit(1)
      .get()

    if (facilitiesQuery.empty) {
      return NextResponse.json(
        {
          success: false,
          error: 'No active credit facility found. Please apply for credit first.',
        },
        { status: 404 }
      )
    }

    const facilityDoc = facilitiesQuery.docs[0]
    const facilityId = facilityDoc.id
    const facilityData = facilityDoc.data()

    // Check available credit
    const availableCredit = facilityData.approvedAmount - facilityData.outstandingBalance

    if (amount > availableCredit) {
      return NextResponse.json(
        {
          success: false,
          error: `Insufficient credit. You need KES ${amount.toLocaleString()} but have KES ${availableCredit.toLocaleString()} available.`,
          availableCredit,
          requestedAmount: amount,
        },
        { status: 400 }
      )
    }

    // Generate reference number
    const referenceNumber = generateDisbursementReference(retailerId)

    // Calculate repayment terms
    const interestRate = facilityData.interestRate || 12 // 12% annual
    const tenorDays = facilityData.tenorDays || 30
    const interestAmount = amount * (interestRate / 100) * (tenorDays / 365)
    const repaymentAmount = amount + interestAmount

    // Create disbursement record in Firestore
    const disbursementRef = db
      .collection('organizations')
      .doc(organizationId)
      .collection('credit_disbursements')
      .doc()

    await disbursementRef.set({
      id: disbursementRef.id,
      disbursementId: disbursementRef.id,
      facilityId,
      retailerId,
      organizationId,
      amount,
      currency: 'KES',
      purpose: purpose || `Supplier Payment - Order #${orderId}`,
      referenceNumber,
      recipient: {
        type: 'supplier',
        id: supplierId || null,
        name: supplierName,
        phone: supplierPhone,
        bankAccount: supplierBankAccount || null,
      },
      relatedOrder: orderId ? {
        orderId,
        orderNumber: referenceNumber,
        supplierId: supplierId || '',
      } : null,
      status: 'pending',
      requestedAt: FieldValue.serverTimestamp(),
      processedAt: null,
      completedAt: null,
      failedAt: null,
      pezeshaDisbursementId: null,
      pezeshaTransactionRef: null,
      pezeshaStatus: null,
      repaymentDueDate: new Date(Date.now() + tenorDays * 24 * 60 * 60 * 1000),
      repaymentAmount,
      interestAmount,
      principalAmount: amount,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: retailerId,
      error: null,
    })

    console.log('Disbursement record created:', disbursementRef.id)

    // Request disbursement from Pezesha
    let pezeshaResponse
    try {
      pezeshaResponse = await pezeshaClient.requestDisbursement({
        applicationId: facilityData.pezeshaFacilityId,
        retailerId,
        amount,
        recipientName: supplierName,
        recipientPhone: supplierPhone,
        recipientBankAccount: supplierBankAccount,
        purpose: purpose || `Supplier Payment - Order #${orderId}`,
        referenceNumber,
        metadata: {
          orderId: orderId || '',
          supplierId: supplierId || '',
          organizationId,
          facilityId,
        },
      })

      // Update disbursement with Pezesha ID
      await disbursementRef.update({
        pezeshaDisbursementId: pezeshaResponse.disbursementId,
        pezeshaStatus: pezeshaResponse.status,
        status: pezeshaResponse.status === 'completed' ? 'completed' : 'processing',
        processedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })

      console.log('Pezesha disbursement requested:', pezeshaResponse.disbursementId)

      // If disbursement is immediately completed, update facility
      if (pezeshaResponse.status === 'completed') {
        await facilityDoc.ref.update({
          totalDisbursed: FieldValue.increment(amount),
          outstandingBalance: FieldValue.increment(repaymentAmount),
          availableCredit: FieldValue.increment(-amount),
          lastDisbursementAt: FieldValue.serverTimestamp(),
          'metrics.totalDisbursements': FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        })

        // Recalculate credit utilization
        const updatedFacilitySnap = await facilityDoc.ref.get()
        const updatedFacilityData = updatedFacilitySnap.data()
        if (updatedFacilityData) {
          const utilization = (updatedFacilityData.outstandingBalance / updatedFacilityData.approvedAmount) * 100
          await facilityDoc.ref.update({ creditUtilization: utilization })
        }

        // Create repayment schedule
        const scheduleRef = db
          .collection('organizations')
          .doc(organizationId)
          .collection('repayment_schedules')
          .doc()

        const dueDate = new Date(Date.now() + tenorDays * 24 * 60 * 60 * 1000)

        await scheduleRef.set({
          id: scheduleRef.id,
          scheduleId: scheduleRef.id,
          facilityId,
          disbursementId: disbursementRef.id,
          retailerId,
          organizationId,
          totalAmount: repaymentAmount,
          principalAmount: amount,
          interestAmount,
          currency: 'KES',
          dueDate,
          remindersSent: 0,
          lastReminderAt: null,
          status: 'pending',
          amountPaid: 0,
          amountOutstanding: repaymentAmount,
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

        console.log('Repayment schedule created:', scheduleRef.id)
      }

    } catch (pezeshaError: any) {
      console.error('Pezesha disbursement request failed:', pezeshaError)

      // Update disbursement status to failed
      await disbursementRef.update({
        status: 'failed',
        failedAt: FieldValue.serverTimestamp(),
        error: {
          code: pezeshaError.code || 'pezesha_error',
          message: pezeshaError.message || 'Failed to request disbursement from Pezesha',
          timestamp: FieldValue.serverTimestamp(),
        },
        updatedAt: FieldValue.serverTimestamp(),
      })

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to request disbursement from Pezesha. Please try again.',
          disbursementId: disbursementRef.id,
          details: pezeshaError.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      disbursementId: disbursementRef.id,
      pezeshaDisbursementId: pezeshaResponse.disbursementId,
      status: pezeshaResponse.status,
      amount,
      repaymentAmount,
      interestAmount,
      dueDate: new Date(Date.now() + tenorDays * 24 * 60 * 60 * 1000).toISOString(),
      message: pezeshaResponse.message || 'Disbursement request successful',
    })
  } catch (error: any) {
    console.error('Disbursement request failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    )
  }
}

// ============================================================================
// GET Method (Get Disbursement Status)
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const disbursementId = searchParams.get('disbursementId')
    const retailerId = searchParams.get('retailerId')
    const organizationId = searchParams.get('organizationId')

    if (!disbursementId || !retailerId || !organizationId) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    const disbursementRef = db
      .collection('organizations')
      .doc(organizationId)
      .collection('credit_disbursements')
      .doc(disbursementId)

    const disbursementSnap = await disbursementRef.get()

    if (!disbursementSnap.exists) {
      return NextResponse.json(
        { success: false, error: 'Disbursement not found' },
        { status: 404 }
      )
    }

    const disbursement = disbursementSnap.data()

    // Verify retailer ownership
    if (disbursement?.retailerId !== retailerId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      disbursement: {
        id: disbursementSnap.id,
        ...disbursement,
      },
    })
  } catch (error: any) {
    console.error('Get disbursement status failed:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
