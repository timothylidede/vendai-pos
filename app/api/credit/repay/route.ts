/**
 * Credit Repayment API
 * Handles credit repayment submissions via M-Pesa STK push or manual recording
 */

import { NextRequest, NextResponse } from 'next/server'
import { Timestamp, FieldValue } from 'firebase-admin/firestore'
import { initiateSTKPush, parseMpesaCallback } from '@/lib/mpesa-stk'
import { getFirebaseAdminDb } from '@/lib/firebase-admin'

const db = getFirebaseAdminDb()

// ============================================================================
// POST: Initiate Repayment (M-Pesa STK Push or Manual)
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      repaymentScheduleId,
      retailerId,
      organizationId,
      amount,
      paymentMethod, // 'mpesa' or 'manual'
      phoneNumber, // Required for M-Pesa
      paymentReference, // Optional for manual
      notes,
    } = body

    // Validate required fields
    if (!repaymentScheduleId || !retailerId || !organizationId || !amount || !paymentMethod) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate amount
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      )
    }

    // Fetch repayment schedule
    const scheduleRef = db
      .collection('organizations')
      .doc(organizationId)
      .collection('repayment_schedules')
      .doc(repaymentScheduleId)

    const scheduleDoc = await scheduleRef.get()

    if (!scheduleDoc.exists) {
      return NextResponse.json(
        { error: 'Repayment schedule not found' },
        { status: 404 }
      )
    }

    const schedule = scheduleDoc.data()

    // Verify ownership
    if (schedule?.retailerId !== retailerId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Check if already paid
    if (schedule?.status === 'paid') {
      return NextResponse.json(
        { error: 'This repayment has already been completed' },
        { status: 400 }
      )
    }

    // Calculate remaining amount
    const totalAmount = schedule?.totalAmount || 0
    const paidAmount = schedule?.paidAmount || 0
    const remainingAmount = totalAmount - paidAmount

    if (amount > remainingAmount) {
      return NextResponse.json(
        {
          error: 'Payment amount exceeds remaining balance',
          remainingAmount,
        },
        { status: 400 }
      )
    }

    // Handle M-Pesa STK Push
    if (paymentMethod === 'mpesa') {
      if (!phoneNumber) {
        return NextResponse.json(
          { error: 'Phone number required for M-Pesa payment' },
          { status: 400 }
        )
      }

      // Initiate STK push
      const stkResponse = await initiateSTKPush({
        phoneNumber,
        amount,
        accountReference: `REPAY-${repaymentScheduleId.substring(0, 8)}`,
        transactionDesc: `Credit Repayment - Installment #${schedule?.installmentNumber || 1}`,
      })

      if (!stkResponse.success) {
        return NextResponse.json(
          {
            error: 'Failed to initiate M-Pesa payment',
            details: stkResponse.error || stkResponse.responseDescription,
          },
          { status: 500 }
        )
      }

      // Create payment transaction record (pending)
      const transactionRef = db
        .collection('organizations')
        .doc(organizationId)
        .collection('payment_transactions')
        .doc()

      await transactionRef.set({
        repaymentScheduleId,
        facilityId: schedule?.facilityId,
        disbursementId: schedule?.disbursementId,
        retailerId,
        organizationId,
        amount,
        paymentMethod: 'mpesa',
        phoneNumber,
        status: 'pending',
        merchantRequestID: stkResponse.merchantRequestID,
        checkoutRequestID: stkResponse.checkoutRequestID,
        mpesaResponse: stkResponse.responseDescription,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })

      return NextResponse.json({
        success: true,
        message: 'M-Pesa payment initiated. Please complete on your phone.',
        transactionId: transactionRef.id,
        checkoutRequestID: stkResponse.checkoutRequestID,
        customerMessage: stkResponse.customerMessage,
      })
    }

    // Handle Manual Payment Recording
    if (paymentMethod === 'manual') {
      if (!paymentReference) {
        return NextResponse.json(
          { error: 'Payment reference required for manual recording' },
          { status: 400 }
        )
      }

      // Create payment transaction record (completed)
      const transactionRef = db
        .collection('organizations')
        .doc(organizationId)
        .collection('payment_transactions')
        .doc()

      await transactionRef.set({
        repaymentScheduleId,
        facilityId: schedule?.facilityId,
        disbursementId: schedule?.disbursementId,
        retailerId,
        organizationId,
        amount,
        paymentMethod: 'manual',
        paymentReference,
        status: 'completed',
        notes: notes || '',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })

      // Update repayment schedule
      const newPaidAmount = paidAmount + amount
      const isFullyPaid = newPaidAmount >= totalAmount

      await scheduleRef.update({
        paidAmount: newPaidAmount,
        status: isFullyPaid ? 'paid' : 'partially_paid',
        paidAt: isFullyPaid ? FieldValue.serverTimestamp() : schedule?.paidAt,
        lastPaymentAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })

      // Update credit facility (reduce outstanding balance)
      const facilityRef = db
        .collection('organizations')
        .doc(organizationId)
        .collection('credit_facilities')
        .doc(schedule?.facilityId)

      const facilityDoc = await facilityRef.get()
      if (facilityDoc.exists) {
        const facility = facilityDoc.data()
        const currentOutstanding = facility?.outstandingBalance || 0
        const approvedAmount = facility?.approvedAmount || 0
        const newOutstanding = Math.max(0, currentOutstanding - amount)
        const newAvailable = approvedAmount - newOutstanding

        await facilityRef.update({
          outstandingBalance: newOutstanding,
          availableCredit: newAvailable,
          creditUtilization: approvedAmount > 0 ? newOutstanding / approvedAmount : 0,
          totalRepaid: (facility?.totalRepaid || 0) + amount,
          lastRepaymentAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        })
      }

      return NextResponse.json({
        success: true,
        message: 'Payment recorded successfully',
        transactionId: transactionRef.id,
        paidAmount: newPaidAmount,
        remainingAmount: totalAmount - newPaidAmount,
        fullyPaid: isFullyPaid,
      })
    }

    return NextResponse.json(
      { error: 'Invalid payment method. Use "mpesa" or "manual"' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('Error processing repayment:', error)
    return NextResponse.json(
      { error: 'Failed to process repayment', details: error.message },
      { status: 500 }
    )
  }
}

// ============================================================================
// GET: Query Payment Transaction Status
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const transactionId = searchParams.get('transactionId')
    const organizationId = searchParams.get('organizationId')
    const retailerId = searchParams.get('retailerId')

    if (!transactionId || !organizationId || !retailerId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Fetch transaction
    const transactionRef = db
      .collection('organizations')
      .doc(organizationId)
      .collection('payment_transactions')
      .doc(transactionId)

    const transactionDoc = await transactionRef.get()

    if (!transactionDoc.exists) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      )
    }

    const transaction = transactionDoc.data()

    // Verify ownership
    if (transaction?.retailerId !== retailerId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      transaction: {
        id: transactionDoc.id,
        ...transaction,
      },
    })
  } catch (error: any) {
    console.error('Error fetching transaction:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transaction', details: error.message },
      { status: 500 }
    )
  }
}

// ============================================================================
// M-Pesa Callback Handler (Separate endpoint: /api/credit/mpesa-callback)
// ============================================================================

export async function handleMpesaCallback(callbackBody: any) {
  try {
    console.log('Received M-Pesa callback:', JSON.stringify(callbackBody, null, 2))

    // Parse callback data
    const callbackData = parseMpesaCallback(callbackBody)

    // Find transaction by checkoutRequestID
    const transactionsRef = db.collectionGroup('payment_transactions')
    const q = transactionsRef.where('checkoutRequestID', '==', callbackData.checkoutRequestID).limit(1)
    const snapshot = await q.get()

    if (snapshot.empty) {
      console.error('Transaction not found for checkoutRequestID:', callbackData.checkoutRequestID)
      return {
        success: false,
        error: 'Transaction not found',
      }
    }

    const transactionDoc = snapshot.docs[0]
    const transaction = transactionDoc.data()
    const transactionRef = transactionDoc.ref

    // Check result code
    if (callbackData.resultCode === 0) {
      // Payment successful
      console.log('M-Pesa payment successful:', callbackData.mpesaReceiptNumber)

      // Update transaction
      await transactionRef.update({
        status: 'completed',
        mpesaReceiptNumber: callbackData.mpesaReceiptNumber,
        transactionDate: callbackData.transactionDate,
        resultCode: callbackData.resultCode,
        resultDesc: callbackData.resultDesc,
        updatedAt: FieldValue.serverTimestamp(),
      })

      // Update repayment schedule
      const scheduleRef = db
        .collection('organizations')
        .doc(transaction.organizationId)
        .collection('repayment_schedules')
        .doc(transaction.repaymentScheduleId)

      const scheduleDoc = await scheduleRef.get()
      if (scheduleDoc.exists) {
        const schedule = scheduleDoc.data()
        const currentPaid = schedule?.paidAmount || 0
        const totalAmount = schedule?.totalAmount || 0
        const newPaidAmount = currentPaid + transaction.amount
        const isFullyPaid = newPaidAmount >= totalAmount

        await scheduleRef.update({
          paidAmount: newPaidAmount,
          status: isFullyPaid ? 'paid' : 'partially_paid',
          paidAt: isFullyPaid ? FieldValue.serverTimestamp() : schedule?.paidAt,
          paymentMethod: 'mpesa',
          paymentReference: callbackData.mpesaReceiptNumber,
          lastPaymentAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        })

        // Update credit facility
        const facilityRef = db
          .collection('organizations')
          .doc(transaction.organizationId)
          .collection('credit_facilities')
          .doc(schedule?.facilityId)

        const facilityDoc = await facilityRef.get()
        if (facilityDoc.exists) {
          const facility = facilityDoc.data()
          const currentOutstanding = facility?.outstandingBalance || 0
          const approvedAmount = facility?.approvedAmount || 0
          const newOutstanding = Math.max(0, currentOutstanding - transaction.amount)
          const newAvailable = approvedAmount - newOutstanding

          await facilityRef.update({
            outstandingBalance: newOutstanding,
            availableCredit: newAvailable,
            creditUtilization: approvedAmount > 0 ? newOutstanding / approvedAmount : 0,
            totalRepaid: (facility?.totalRepaid || 0) + transaction.amount,
            lastRepaymentAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          })

          // Update facility metrics (successful repayment)
          const metrics = facility?.metrics || {}
          await facilityRef.update({
            'metrics.successfulRepayments': (metrics.successfulRepayments || 0) + 1,
            'metrics.currentStreak': (metrics.currentStreak || 0) + 1,
            'metrics.longestStreak': Math.max(
              metrics.longestStreak || 0,
              (metrics.currentStreak || 0) + 1
            ),
          })
        }
      }

      return {
        success: true,
        message: 'Payment processed successfully',
      }
    } else {
      // Payment failed
      console.log('M-Pesa payment failed:', callbackData.resultDesc)

      await transactionRef.update({
        status: 'failed',
        resultCode: callbackData.resultCode,
        resultDesc: callbackData.resultDesc,
        updatedAt: FieldValue.serverTimestamp(),
      })

      return {
        success: false,
        error: callbackData.resultDesc,
      }
    }
  } catch (error: any) {
    console.error('Error processing M-Pesa callback:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}
