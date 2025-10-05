import { NextResponse } from 'next/server'
import {
  arrayUnion,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  Timestamp,
  updateDoc,
  query,
  where,
  limit as firestoreLimit,
} from 'firebase/firestore'
import { z } from 'zod'

import { db } from '@/lib/firebase'
import { checkRateLimit } from '@/lib/api-error-handler'
import { getAuthScopedRateLimitKey, getRateLimitKey } from '@/lib/rate-limit'
import {
  createLedgerEntry,
  invoiceDoc,
  ledgerEntriesCollection,
  paymentDoc,
  purchaseOrderDoc,
  salesOrderDoc,
  type LedgerEntryCreateInput,
} from '@/lib/b2b-order-store'
import { buildInvoiceStatusHistoryEntry } from '@/lib/b2b-invoice-utils'
import { buildStatusHistoryEntry } from '@/lib/b2b-order-utils'

const releaseSchema = z.object({
  paymentId: z.string().min(1, 'paymentId is required'),
  invoiceId: z.string().min(1).optional(),
  purchaseOrderId: z.string().min(1).optional(),
  salesOrderId: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  releaseNote: z.string().optional(),
  deliveryStatus: z.enum(['in_transit', 'delivered', 'cancelled', 'failed']).optional(),
  releasedBy: z.object({
    id: z.string().min(1, 'releasedBy.id is required'),
    name: z.string().optional(),
  }),
  driver: z
    .object({
      id: z.string().min(1),
      name: z.string().optional(),
    })
    .optional(),
  proofOfDelivery: z
    .object({
      url: z.string().url().optional(),
      signatureUrl: z.string().url().optional(),
      notes: z.string().optional(),
      capturedAt: z.coerce.date().optional(),
    })
    .optional(),
})

type ReleasePayload = z.infer<typeof releaseSchema>

type FirestorePayment = Record<string, unknown> & {
  status?: string
  releasedAt?: Timestamp | null
  invoiceId?: string
  purchaseOrderId?: string
  salesOrderId?: string
  retailerOrgId?: string
  supplierOrgId?: string
  retailerId?: string
  supplierId?: string
  amount?: number
  netAmount?: number
  currency?: string
  fees?: {
    processor?: number
    vendaiCommission?: number
    other?: number
  }
}

const resolveAmount = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim().length) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

const buildPaymentReleaseHistory = (payload: ReleasePayload) => ({
  status: 'paid',
  changedBy: payload.releasedBy.id,
  changedByName: payload.releasedBy.name,
  changedAt: serverTimestamp() as unknown as Timestamp,
  notes: payload.releaseNote ?? 'Escrow released after delivery confirmation',
})

const buildSalesOrderHistory = (payload: ReleasePayload, status: string) => ({
  status,
  changedBy: payload.releasedBy.id,
  changedByName: payload.releasedBy.name,
  changedAt: serverTimestamp() as unknown as Timestamp,
  notes: payload.releaseNote ?? 'Delivery confirmed',
})

export async function POST(request: Request) {
  try {
    const rateLimitKey = getRateLimitKey(request, 'payments-release', 'POST')
    checkRateLimit(rateLimitKey, 40, 60_000)

    const json = await request.json()
    const parsed = releaseSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid payload',
          details: parsed.error.flatten(),
        },
        { status: 400 },
      )
    }

    const payload = parsed.data
    checkRateLimit(getAuthScopedRateLimitKey(request, payload.releasedBy.id, 'payments-release'), 10, 60_000)

    const paymentRef = paymentDoc(payload.paymentId)
    const paymentSnapshot = await getDoc(paymentRef)

    if (!paymentSnapshot.exists()) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    const paymentData = paymentSnapshot.data() as FirestorePayment
    if (paymentData.status === 'paid' && paymentData.releasedAt) {
      return NextResponse.json(
        {
          status: 'already_released',
          releasedAt: paymentData.releasedAt?.toDate?.() ?? null,
        },
        { status: 200 },
      )
    }

    const invoiceId = payload.invoiceId ?? (paymentData.invoiceId as string | undefined)
    const purchaseOrderId = payload.purchaseOrderId ?? (paymentData.purchaseOrderId as string | undefined)
    const salesOrderId = payload.salesOrderId ?? (paymentData.salesOrderId as string | undefined)
    const releaseAmount =
      resolveAmount(payload.amount) ??
      resolveAmount(paymentData.netAmount) ??
      resolveAmount(paymentData.amount) ??
      0

    let invoiceAmountSummary: { total: number; tax: number; currency?: string } | null = null

    const releaseMetadata: Record<string, unknown> = {
      releasedById: payload.releasedBy.id,
      releasedByName: payload.releasedBy.name ?? null,
      releaseNote: payload.releaseNote ?? null,
    }

    if (payload.driver) {
      releaseMetadata.driverId = payload.driver.id
      releaseMetadata.driverName = payload.driver.name ?? null
    }

    if (payload.proofOfDelivery) {
      releaseMetadata.proofOfDeliveryUrl = payload.proofOfDelivery.url ?? null
      releaseMetadata.proofOfDeliverySignatureUrl = payload.proofOfDelivery.signatureUrl ?? null
      releaseMetadata.proofOfDeliveryNotes = payload.proofOfDelivery.notes ?? null
      releaseMetadata.proofOfDeliveryCapturedAt = payload.proofOfDelivery.capturedAt
        ? Timestamp.fromDate(payload.proofOfDelivery.capturedAt)
        : null
    }

    await updateDoc(paymentRef, {
      status: 'paid',
      releasedAt: serverTimestamp(),
      netAmount: releaseAmount,
      statusHistory: arrayUnion(buildPaymentReleaseHistory(payload)),
      releaseMetadata,
      updatedAt: serverTimestamp(),
    })

    if (invoiceId) {
      const invoiceRef = invoiceDoc(invoiceId)
      const invoiceSnapshot = await getDoc(invoiceRef)
      if (invoiceSnapshot.exists()) {
        const invoiceHistory = buildInvoiceStatusHistoryEntry(
          'paid',
          payload.releasedBy.id,
          payload.releasedBy.name,
          payload.releaseNote ?? 'Escrow release applied',
        )

        const invoiceData = invoiceSnapshot.data() as Record<string, unknown>
        const amountData = (invoiceData.amount as Record<string, unknown> | undefined) ?? undefined
        invoiceAmountSummary = {
          total: resolveAmount(amountData?.total) ?? 0,
          tax: resolveAmount(amountData?.tax) ?? 0,
          currency: typeof amountData?.currency === 'string' ? amountData.currency : undefined,
        }

        await updateDoc(invoiceRef, {
          paymentStatus: 'paid',
          status: 'paid',
          paymentIds: arrayUnion(payload.paymentId),
          statusHistory: arrayUnion(invoiceHistory),
          updatedAt: serverTimestamp(),
        })
      }
    }

    if (purchaseOrderId) {
      const purchaseOrderRef = purchaseOrderDoc(purchaseOrderId)
      await updateDoc(purchaseOrderRef, {
        status: 'fulfilled',
        statusHistory: arrayUnion(
          buildStatusHistoryEntry(
            'fulfilled',
            payload.releasedBy.id,
            payload.releasedBy.name,
            payload.releaseNote ?? 'Order fulfilled and payment released',
          ),
        ),
        updatedAt: serverTimestamp(),
      })
    }

    if (salesOrderId) {
      const salesOrderRef = salesOrderDoc(salesOrderId)
      const deliveryStatus = payload.deliveryStatus ?? 'delivered'
      const proof = payload.proofOfDelivery
      const proofPayload = proof
        ? {
            capturedAt: proof.capturedAt
              ? Timestamp.fromDate(proof.capturedAt)
              : serverTimestamp(),
            capturedBy: payload.releasedBy.id,
            capturedByName: payload.releasedBy.name ?? null,
            notes: proof.notes ?? null,
            assetUrl: proof.url ?? null,
            signatureUrl: proof.signatureUrl ?? null,
          }
        : undefined

      await updateDoc(salesOrderRef, {
        status: deliveryStatus,
        assignedDriverId: payload.driver?.id ?? null,
        assignedDriverName: payload.driver?.name ?? null,
        proofOfDelivery: proofPayload,
        statusHistory: arrayUnion(buildSalesOrderHistory(payload, deliveryStatus)),
        updatedAt: serverTimestamp(),
      })
    }

    if (payload.driver) {
      const driverRef = doc(db, 'drivers', payload.driver.id)
      try {
        await updateDoc(driverRef, {
          status: 'available',
          lastCompletedOrderId: salesOrderId ?? null,
          lastCompletedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      } catch (error) {
        console.warn('Unable to update driver record after release', error)
      }
    }

    let ledgerUpdate: 'created' | 'updated' | 'skipped' = 'skipped'
    try {
      const grossAmount = invoiceAmountSummary?.total ?? resolveAmount(paymentData.amount) ?? releaseAmount
      const taxAmount = invoiceAmountSummary?.tax ?? 0
      const fees = paymentData.fees ?? {}
      const vendaiCommissionAmount = Number(fees.vendaiCommission ?? 0) || 0
      const processorFeeAmount = Number(fees.processor ?? 0) || 0
      const currency = invoiceAmountSummary?.currency ?? (typeof paymentData.currency === 'string' ? paymentData.currency : 'KES')

      const ledgerQuery = query(
        ledgerEntriesCollection(),
        where('paymentId', '==', payload.paymentId),
        firestoreLimit(1),
      )
      const ledgerSnapshot = await getDocs(ledgerQuery)

      if (!ledgerSnapshot.empty) {
        await updateDoc(ledgerSnapshot.docs[0].ref, {
          payoutStatus: 'paid',
          payoutDate: serverTimestamp(),
          netPayoutAmount: releaseAmount,
          taxAmount,
          updatedAt: serverTimestamp(),
        })
        ledgerUpdate = 'updated'
      } else if (invoiceId && purchaseOrderId) {
        const ledgerPayload: LedgerEntryCreateInput = {
          retailerOrgId: (paymentData.retailerOrgId as string) ?? '',
          supplierOrgId: (paymentData.supplierOrgId as string) ?? undefined,
          purchaseOrderId,
          invoiceId,
          paymentId: payload.paymentId,
          supplierId: (paymentData.supplierId as string) ?? '',
          supplierName: undefined,
          retailerId: (paymentData.retailerId as string) ?? '',
          retailerName: undefined,
          grossAmount: Number(grossAmount) || 0,
          vendaiCommissionAmount,
          processorFeeAmount,
          taxAmount,
          netPayoutAmount: releaseAmount,
          currency,
          reconciliationStatus: 'matched',
          payoutStatus: 'paid',
          payoutDate: Timestamp.fromDate(new Date()),
          notes: payload.releaseNote ?? 'Escrow release payout recorded automatically',
        }

        await createLedgerEntry(ledgerPayload)
        ledgerUpdate = 'created'
      }
    } catch (error) {
      console.error('Failed to update ledger entry for payment release', error)
    }

    return NextResponse.json({
      status: 'released',
      paymentId: payload.paymentId,
      invoiceId: invoiceId ?? null,
      purchaseOrderId: purchaseOrderId ?? null,
      salesOrderId: salesOrderId ?? null,
      releaseAmount,
      ledgerUpdate,
    })
  } catch (error) {
    console.error('Unhandled error releasing payment escrow', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
