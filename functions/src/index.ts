/**
 * VendAI Cloud Functions
 * Background jobs for credit scoring, reconciliation, auto-replenishment, and notifications
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

import {
  assessCredit,
  defaultCreditEngineOptions,
  type CreditAssessmentInput,
  type CreditAssessmentResult,
  type CreditMetricsSnapshot,
} from './credit-engine';

admin.initializeApp();

const db = admin.firestore();

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const PAYMENT_LOOKBACK_DAYS = 180;
const MAX_PAYMENTS_TO_LOAD = 500;
const WATCHLIST_SCORE_THRESHOLD = 520;
const WATCHLIST_DISPUTE_RATE = 0.05;
const DEFAULT_EXISTING_LIMIT = 150000;
const DEFAULT_DAYS_SINCE_SIGNUP = 180;
const ACTIVE_DISPUTE_STATUSES = ['open', 'under_review', 'escalated', 'appeal', 'pending_resolution'];
const COMMUNICATION_COLLECTION = 'communication_jobs';

type RecalculateReason = 'scheduled_cron' | 'payment_received' | 'dispute_created' | 'dispute_resolved';

interface RecalculateOptions {
  reason: RecalculateReason;
  triggerId?: string;
}

interface RetailerContactInfo {
  retailerName?: string | null;
  retailerEmail?: string | null;
  retailerPhone?: string | null;
  retailerUserId?: string | null;
}

interface CreditComputationStats {
  totalPayments90d: number;
  paymentVolume90d: number;
  paymentVolumePrior90d: number;
  disputeCount90d: number;
  activeDisputes: number;
  onTimePayments: number;
  latePayments: number;
  overdueInvoices: number;
}

interface CreditComputationResult {
  input: CreditAssessmentInput;
  metricsSnapshot: CreditMetricsSnapshot;
  stats: CreditComputationStats;
  context: RetailerContactInfo;
}

const clamp = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
};

const safeNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

const asDate = (value: unknown): Date | null => {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  if ((value as admin.firestore.Timestamp)?.toDate) {
    return (value as admin.firestore.Timestamp).toDate();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value);
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed);
    }
  }
  return null;
};

const uniqueReminderKey = (invoiceId: string, channel: 'email' | 'sms', dayKey: string) =>
  `invoice_overdue:${invoiceId}:${channel}:${dayKey}`;

const contactCache = new Map<string, RetailerContactInfo>();

async function fetchRetailerContact(retailerId: string, fallbackUserId?: string | null): Promise<RetailerContactInfo> {
  if (contactCache.has(retailerId)) {
    return contactCache.get(retailerId)!;
  }

  let snapshot = await db.collection('users').doc(retailerId).get();
  if (!snapshot.exists && fallbackUserId && fallbackUserId !== retailerId) {
    snapshot = await db.collection('users').doc(fallbackUserId).get();
  }

  const data = snapshot.exists ? snapshot.data() ?? {} : {};

  const contact: RetailerContactInfo = {
    retailerName:
      typeof data?.displayName === 'string'
        ? data.displayName
        : typeof data?.businessName === 'string'
        ? data.businessName
        : typeof data?.name === 'string'
        ? data.name
        : null,
    retailerEmail:
      typeof data?.billingEmail === 'string'
        ? data.billingEmail
        : typeof data?.email === 'string'
        ? data.email
        : typeof data?.primaryEmail === 'string'
        ? data.primaryEmail
        : null,
    retailerPhone:
      typeof data?.phoneNumber === 'string'
        ? data.phoneNumber
        : typeof data?.contactPhone === 'string'
        ? data.contactPhone
        : null,
    retailerUserId: snapshot.exists ? snapshot.id : fallbackUserId ?? null,
  };

  contactCache.set(retailerId, contact);

  return contact;
}

async function ensureCommunicationJob(channel: 'email' | 'sms', uniqueKey: string, payload: Record<string, unknown>) {
  const existing = await db
    .collection(COMMUNICATION_COLLECTION)
    .where('uniqueKey', '==', uniqueKey)
    .limit(1)
    .get();

  if (!existing.empty) {
    return;
  }

  await db.collection(COMMUNICATION_COLLECTION).add({
    uniqueKey,
    channel,
    status: 'pending',
    priority: channel === 'sms' ? 'urgent' : 'high',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    scheduledFor: admin.firestore.FieldValue.serverTimestamp(),
    ...payload,
  });
}

async function buildCreditAssessmentInput(retailerId: string): Promise<CreditComputationResult | null> {
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * DAY_IN_MS);
  const paymentsLookbackDate = new Date(now.getTime() - PAYMENT_LOOKBACK_DAYS * DAY_IN_MS);

  const retailerRef = db.collection('users').doc(retailerId);
  const creditProfileRef = db.collection('credit_profiles').doc(retailerId);

  const [retailerSnap, creditProfileSnap] = await Promise.all([retailerRef.get(), creditProfileRef.get()]);

  if (!creditProfileSnap.exists) {
    return null;
  }

  const creditProfile = creditProfileSnap.data() ?? {};
  const metrics = (creditProfile.metrics ?? {}) as Record<string, unknown>;

  const existingCreditLimit = safeNumber(metrics.existingCreditLimit) ?? DEFAULT_EXISTING_LIMIT;
  const manualAdjustment = clamp(safeNumber(metrics.manualAdjustment) ?? 0, -30, 30);
  const storedDaysSinceSignup = safeNumber(metrics.daysSinceSignup) ?? DEFAULT_DAYS_SINCE_SIGNUP;

  const retailerData = retailerSnap.exists ? retailerSnap.data() ?? {} : {};
  const createdDate =
    asDate(retailerData.createdAt) ??
    asDate(retailerData.signupDate) ??
    asDate((creditProfile as Record<string, unknown>).createdAt) ??
    null;

  const daysSinceSignup = createdDate
    ? Math.max(1, Math.round((now.getTime() - createdDate.getTime()) / DAY_IN_MS))
    : storedDaysSinceSignup;

  const storedSectorRisk = (metrics.sectorRisk as string) ?? retailerData.sectorRisk ?? retailerData.industryRisk;
  const sectorRisk: 'low' | 'medium' | 'high' =
    storedSectorRisk === 'low' || storedSectorRisk === 'high' || storedSectorRisk === 'medium'
      ? storedSectorRisk
      : 'medium';

  const paymentsQuery = db
    .collection('payments')
    .where('retailerId', '==', retailerId)
    .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(paymentsLookbackDate))
    .orderBy('createdAt', 'desc')
    .limit(MAX_PAYMENTS_TO_LOAD);

  const [paymentsSnapshot, purchaseOrdersSnapshot, outstandingInvoicesSnapshot, disputesSnapshot, activeDisputesSnapshot] =
    await Promise.all([
      paymentsQuery.get(),
      db
        .collection('purchase_orders')
        .where('retailerId', '==', retailerId)
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(ninetyDaysAgo))
        .get(),
      db
        .collection('invoices')
        .where('retailerId', '==', retailerId)
        .where('paymentStatus', 'in', ['pending', 'partial', 'overdue'])
        .get(),
      db
        .collection('disputes')
        .where('retailerId', '==', retailerId)
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(ninetyDaysAgo))
        .get(),
      db
        .collection('disputes')
        .where('retailerId', '==', retailerId)
        .where('status', 'in', ACTIVE_DISPUTE_STATUSES)
        .get(),
    ]);

  let paymentVolume90d = 0;
  let paymentVolumePrior90d = 0;
  let totalPayments90d = 0;
  let successfulPayments = 0;
  let failedPayments = 0;
  let totalAttempts = 0;
  let onTimePayments = 0;
  let latePayments = 0;
  let consecutiveOnTimePayments = 0;
  let consecutiveBroken = false;

  const invoiceLagMap = new Map<string, Date[]>();

  paymentsSnapshot.forEach((docSnap) => {
    const payment = docSnap.data() ?? {};
    const createdAt = asDate(payment.receivedAt) ?? asDate(payment.createdAt) ?? now;
    if (!createdAt) {
      return;
    }

    const amount = Math.max(safeNumber(payment.amount) ?? 0, 0);
    const statusRaw = typeof payment.status === 'string' ? payment.status.toLowerCase() : 'pending';
    const isSuccessStatus = statusRaw === 'paid' || statusRaw === 'success' || statusRaw === 'partial';

    if (createdAt >= ninetyDaysAgo) {
      paymentVolume90d += amount;
      totalAttempts += 1;

      if (isSuccessStatus) {
        successfulPayments += 1;
        totalPayments90d += 1;
      } else if (statusRaw === 'failed') {
        failedPayments += 1;
      }

      const paidOnTime = payment.paidOnTime === true;
      if (!consecutiveBroken && isSuccessStatus) {
        if (paidOnTime) {
          consecutiveOnTimePayments += 1;
        } else {
          consecutiveBroken = true;
        }
      }

      if (paidOnTime) {
        onTimePayments += 1;
      } else if (payment.paidOnTime === false) {
        latePayments += 1;
      }

      if (typeof payment.invoiceId === 'string') {
        const paidAt = asDate(payment.receivedAt) ?? createdAt;
        if (paidAt) {
          const existing = invoiceLagMap.get(payment.invoiceId) ?? [];
          existing.push(paidAt);
          invoiceLagMap.set(payment.invoiceId, existing);
        }
      }
    } else {
      paymentVolumePrior90d += amount;
    }
  });

    const filteredPurchaseOrders = purchaseOrdersSnapshot.docs.filter((docSnap) => {
      const status = (docSnap.data() ?? {}).status;
      return status !== 'cancelled';
    });

    const orders90d = filteredPurchaseOrders.length;
    const totalOrderValue90d = filteredPurchaseOrders.reduce((sum, docSnap) => {
      const total = safeNumber((docSnap.data()?.amount as Record<string, unknown>)?.total) ?? 0;
      return sum + Math.max(total, 0);
    }, 0);

    const averageOrderValue =
      orders90d > 0 ? totalOrderValue90d / orders90d : paymentVolume90d > 0 ? paymentVolume90d : totalOrderValue90d;

    let currentOutstanding = 0;
    let overdueInvoices = 0;

    outstandingInvoicesSnapshot.forEach((docSnap) => {
      const invoice = docSnap.data() ?? {};
      const total = safeNumber((invoice.amount as Record<string, unknown>)?.total) ?? 0;
      const paid = safeNumber(invoice.totalPaidAmount) ?? 0;
      currentOutstanding += Math.max(total - paid, 0);

      const dueDate = asDate(invoice.dueDate);
      if (dueDate && dueDate < now) {
        overdueInvoices += 1;
      }
    });

    let repaymentLagDays = safeNumber(metrics.repaymentLagDays) ?? 0;
    if (invoiceLagMap.size > 0) {
      const invoiceRefs = Array.from(invoiceLagMap.keys()).map((invoiceId) => db.collection('invoices').doc(invoiceId));
      const invoiceSnapshots = invoiceRefs.length > 0 ? await db.getAll(...invoiceRefs) : [];
      let lagSum = 0;
      let lagCount = 0;

      invoiceSnapshots.forEach((invoiceSnap) => {
        if (!invoiceSnap || !invoiceSnap.exists) {
          return;
        }
        const dueDate = asDate((invoiceSnap.data() ?? {}).dueDate);
        if (!dueDate) {
          return;
        }
        const paidDates = invoiceLagMap.get(invoiceSnap.id) ?? [];
        paidDates.forEach((paidAt) => {
          const diff = (paidAt.getTime() - dueDate.getTime()) / DAY_IN_MS;
          if (Number.isFinite(diff)) {
            lagSum += diff;
            lagCount += 1;
          }
        });
      });

      if (lagCount > 0) {
        repaymentLagDays = Math.max(0, lagSum / lagCount);
      }
    }

    const disputeCount90d = disputesSnapshot.size;
    const activeDisputes = activeDisputesSnapshot.size;

    const onTimePaymentRate =
      totalPayments90d > 0
        ? clamp(onTimePayments / totalPayments90d, 0, 1)
        : clamp(safeNumber(metrics.onTimePaymentRate) ?? 1, 0, 1);

    const disputeRateBase = totalPayments90d > 0 ? disputeCount90d / totalPayments90d : 0;
    const disputeRate = clamp(disputeRateBase + activeDisputes * 0.05, 0, 1);

    const creditUtilization = existingCreditLimit > 0 ? currentOutstanding / existingCreditLimit : 0;
    const trailingGrowthRate =
      paymentVolumePrior90d > 0
        ? (paymentVolume90d - paymentVolumePrior90d) / paymentVolumePrior90d
        : paymentVolume90d > 0
        ? 1
        : 0;

    const metricsSnapshot: CreditMetricsSnapshot = {
      trailingVolume90d: paymentVolume90d,
      orders90d,
      successfulPayments,
      failedPayments,
      totalAttempts: Math.max(totalAttempts, successfulPayments + failedPayments),
      disputeCount: disputeCount90d,
      currentOutstanding,
      existingCreditLimit,
      consecutiveOnTimePayments,
      manualAdjustment,
      repaymentLagDays: Math.max(0, repaymentLagDays),
      sectorRisk,
    };

    const input: CreditAssessmentInput = {
      retailerId,
      trailingVolume90d: paymentVolume90d,
      trailingGrowthRate: clamp(trailingGrowthRate, -1, 3),
      orders90d,
      averageOrderValue: Math.max(averageOrderValue, 0),
      onTimePaymentRate,
      disputeRate,
      repaymentLagDays: Math.max(0, repaymentLagDays),
      creditUtilization: Math.max(0, creditUtilization),
      currentOutstanding,
      existingCreditLimit,
      consecutiveOnTimePayments,
      daysSinceSignup: Math.max(1, daysSinceSignup),
      sectorRisk,
      manualAdjustment,
    };

    const stats: CreditComputationStats = {
      totalPayments90d,
      paymentVolume90d,
      paymentVolumePrior90d,
      disputeCount90d,
      activeDisputes,
      onTimePayments,
      latePayments,
      overdueInvoices,
    };

    const context: RetailerContactInfo = {
      retailerName:
        typeof retailerData.displayName === 'string'
          ? retailerData.displayName
          : typeof retailerData.businessName === 'string'
          ? retailerData.businessName
          : typeof retailerData.name === 'string'
          ? retailerData.name
          : null,
      retailerEmail:
        typeof retailerData.billingEmail === 'string'
          ? retailerData.billingEmail
          : typeof retailerData.email === 'string'
          ? retailerData.email
          : typeof retailerData.primaryEmail === 'string'
          ? retailerData.primaryEmail
          : null,
      retailerPhone:
        typeof retailerData.phoneNumber === 'string'
          ? retailerData.phoneNumber
          : typeof retailerData.contactPhone === 'string'
          ? retailerData.contactPhone
          : null,
      retailerUserId: retailerSnap.exists ? retailerSnap.id : null,
    };

    return { input, metricsSnapshot, stats, context };
    }

    async function updateWatchlistForRetailer(
      retailerId: string,
      assessment: CreditAssessmentResult,
      input: CreditAssessmentInput,
      stats: CreditComputationStats,
      reason: RecalculateReason,
    ) {
      const shouldWatch =
        assessment.score < WATCHLIST_SCORE_THRESHOLD ||
        input.disputeRate >= WATCHLIST_DISPUTE_RATE ||
        stats.activeDisputes > 0 ||
        assessment.creditUtilization > assessment.tier.utilizationCeiling;

      const watchlistRef = db.collection('watchlist').doc(retailerId);

      if (shouldWatch) {
        await watchlistRef.set(
          {
            retailerId,
            status: 'watching',
            score: assessment.score,
            tier: assessment.tier.id,
            disputeRate: input.disputeRate,
            activeDisputes: stats.activeDisputes,
            creditUtilization: assessment.creditUtilization,
            reason,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      } else {
        await watchlistRef.set(
          {
            retailerId,
            status: 'cleared',
            clearedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }
    }

    async function recalculateRetailerCredit(
      retailerId: string,
      options: RecalculateOptions,
    ): Promise<{ assessment: CreditAssessmentResult; stats: CreditComputationStats } | null> {
      const computation = await buildCreditAssessmentInput(retailerId);
      if (!computation) {
        functions.logger.warn('Skipped credit recalculation because credit profile is missing', { retailerId });
        return null;
      }

      const { input, metricsSnapshot, stats } = computation;
      const assessment = assessCredit(input, defaultCreditEngineOptions);

      const creditProfileRef = db.collection('credit_profiles').doc(retailerId);

      await creditProfileRef.set(
        {
          retailerId,
          metrics: {
            ...metricsSnapshot,
            onTimePaymentRate: input.onTimePaymentRate,
            disputeRate: input.disputeRate,
            creditUtilization: input.creditUtilization,
            trailingGrowthRate: input.trailingGrowthRate,
            averageOrderValue: input.averageOrderValue,
            daysSinceSignup: input.daysSinceSignup,
            manualAdjustment: input.manualAdjustment ?? 0,
            activeDisputes: stats.activeDisputes,
            totalPayments90d: stats.totalPayments90d,
            paymentVolumePrior90d: stats.paymentVolumePrior90d,
            overdueInvoiceCount: stats.overdueInvoices,
            lastRecalculated: admin.firestore.FieldValue.serverTimestamp(),
          },
          lastAssessment: assessment,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      await creditProfileRef.collection('credit_history').add({
        assessment,
        input,
        metricsSnapshot,
        stats,
        reason: options.reason,
        triggerId: options.triggerId ?? null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await updateWatchlistForRetailer(retailerId, assessment, input, stats, options.reason);

      return { assessment, stats };
    }

    /**
     * Credit Score Recalculation Job
     * Runs every 6 hours to recalculate credit scores for active retailers
     */
    export const recalculateCreditScores = functions
      .runWith({
        timeoutSeconds: 540,
        memory: '1GB',
      })
      .pubsub.schedule('every 6 hours')
      .timeZone('Africa/Nairobi')
      .onRun(async () => {
        const startTime = Date.now();
        let processed = 0;
        let skipped = 0;
        let failures = 0;

        const retailersSnapshot = await db
          .collection('users')
          .where('role', '==', 'retailer')
          .where('status', '==', 'active')
          .get();

        for (const retailerDoc of retailersSnapshot.docs) {
          const retailerId = retailerDoc.id;
          try {
            const result = await recalculateRetailerCredit(retailerId, {
              reason: 'scheduled_cron',
            });

            if (result) {
              processed += 1;
            } else {
              skipped += 1;
            }
          } catch (error) {
            failures += 1;
            functions.logger.error('Failed to recalculate credit for retailer', { retailerId, error });
          }
        }

        const duration = Date.now() - startTime;
        functions.logger.info('Credit recalculation finished', { processed, skipped, failures, duration });

        return { processed, skipped, failures, duration };
      });

    /**
     * Payment-Triggered Credit Update
     * Immediately recalculates credit score when a payment is received
     */
    export const onPaymentReceived = functions.firestore
      .document('payments/{paymentId}')
      .onCreate(async (snap) => {
        const payment = snap.data() ?? {};
        const retailerId = payment.retailerId;

        if (typeof retailerId !== 'string' || retailerId.length === 0) {
          functions.logger.warn('Payment created without retailerId', { paymentId: snap.id });
          return;
        }

        try {
          await recalculateRetailerCredit(retailerId, {
            reason: 'payment_received',
            triggerId: snap.id,
          });
        } catch (error) {
          functions.logger.error('Failed to recalculate credit after payment', { retailerId, paymentId: snap.id, error });
        }
      });

    /**
     * Reconciliation Worker
     * Matches PO ↔ Invoice ↔ Payment and flags mismatches
     * Also backfills missing ledger entries
     */
    export const reconciliationWorker = functions
      .runWith({
        timeoutSeconds: 540,
        memory: '2GB',
      })
      .pubsub.schedule('every day 02:00')
      .timeZone('Africa/Nairobi')
      .onRun(async () => {
        const startTime = Date.now();
        let processed = 0;
        let mismatches = 0;
        let backfilled = 0;
        let issuesResolved = 0;

        const thirtyDaysAgo = new Date(Date.now() - 30 * DAY_IN_MS);

        const purchaseOrdersSnapshot = await db
          .collection('purchase_orders')
          .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
          .where('status', 'in', ['approved', 'fulfilled'])
          .get();

        for (const poDoc of purchaseOrdersSnapshot.docs) {
          processed += 1;
          const purchaseOrderId = poDoc.id;
          const po = poDoc.data() ?? {};

          try {
            const invoiceSnapshot = await db
              .collection('invoices')
              .where('purchaseOrderId', '==', purchaseOrderId)
              .limit(1)
              .get();

            if (invoiceSnapshot.empty) {
              mismatches += 1;
              await db.collection('reconciliation_issues').add({
                type: 'missing_invoice',
                purchaseOrderId,
                description: `Purchase order ${purchaseOrderId} has no related invoice`,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                status: 'open',
              });
              continue;
            }

            const invoiceDoc = invoiceSnapshot.docs[0];
            const invoice = invoiceDoc.data() ?? {};
            const invoiceId = invoiceDoc.id;

            const poTotal = safeNumber((po.amount as Record<string, unknown>)?.total) ?? 0;
            const invoiceTotal = safeNumber((invoice.amount as Record<string, unknown>)?.total) ?? 0;
            const amountDiff = Math.abs(poTotal - invoiceTotal);

            if (amountDiff > 1) {
              mismatches += 1;
              await db.collection('reconciliation_issues').add({
                type: 'amount_mismatch',
                purchaseOrderId,
                invoiceId,
                poAmount: poTotal,
                invoiceAmount: invoiceTotal,
                difference: amountDiff,
                description: `Amount mismatch between PO and Invoice: ${amountDiff} KES`,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                status: 'open',
              });
            }

            const paymentsSnapshot = await db
              .collection('payments')
              .where('invoiceId', '==', invoiceId)
              .where('status', 'in', ['paid', 'success', 'partial'])
              .get();

            let totalPaid = 0;
            let totalCommission = 0;
            let totalProcessorFees = 0;

            paymentsSnapshot.forEach((paymentDoc) => {
              const payment = paymentDoc.data() ?? {};
              totalPaid += Math.max(safeNumber(payment.amount) ?? 0, 0);

              const fees = (payment.fees ?? {}) as Record<string, unknown>;
              totalCommission += Math.max(safeNumber(fees.vendaiCommission) ?? 0, 0);
              totalProcessorFees += Math.max(safeNumber(fees.processor) ?? 0, 0);
            });

            const paymentDiff = Math.abs(totalPaid - invoiceTotal);
            if (paymentDiff > 1) {
              mismatches += 1;
              await db.collection('reconciliation_issues').add({
                type: 'payment_mismatch',
                invoiceId,
                purchaseOrderId,
                invoiceAmount: invoiceTotal,
                paymentAmount: totalPaid,
                difference: paymentDiff,
                description: `Payment total (${totalPaid}) doesn't match invoice (${invoiceTotal})`,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                status: 'open',
              });
            }

            const ledgerSnapshot = await db
              .collection('ledger_entries')
              .where('invoiceId', '==', invoiceId)
              .limit(1)
              .get();

            if (ledgerSnapshot.empty && invoice.paymentStatus === 'paid') {
              const amountData = (invoice.amount as { tax?: number; total?: number } | undefined) ?? undefined;
              const taxAmount = typeof amountData?.tax === 'number' ? amountData.tax : 0;
              const netPayoutAmount = Math.max(invoiceTotal - totalCommission - totalProcessorFees, 0);

              const ledgerRef = db.collection('ledger_entries').doc();
              await ledgerRef.set({
                retailerOrgId: invoice.retailerOrgId ?? po.retailerOrgId ?? null,
                supplierOrgId: invoice.supplierOrgId ?? po.supplierOrgId ?? null,
                purchaseOrderId,
                invoiceId,
                paymentId: paymentsSnapshot.docs[0]?.id ?? null,
                supplierId: invoice.supplierId ?? po.supplierId ?? null,
                supplierName: invoice.supplierName ?? po.supplierName ?? null,
                retailerId: invoice.retailerId ?? po.retailerId ?? null,
                retailerName: invoice.retailerName ?? po.retailerName ?? null,
                grossAmount: invoiceTotal,
                vendaiCommissionAmount: totalCommission,
                processorFeeAmount: totalProcessorFees,
                taxAmount,
                netPayoutAmount,
                currency: (invoice.amount as Record<string, unknown>)?.currency ?? 'KES',
                reconciliationStatus: paymentDiff <= 1 ? 'matched' : 'partial',
                payoutStatus: 'pending',
                notes: 'Auto-generated by reconciliation worker',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });

              backfilled += 1;

              await db.collection('reconciliation_events').add({
                type: 'ledger_backfill',
                invoiceId,
                purchaseOrderId,
                ledgerEntryId: ledgerRef.id,
                difference: paymentDiff,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                autoResolved: paymentDiff <= 1,
              });

              const issuesSnapshot = await db
                .collection('reconciliation_issues')
                .where('invoiceId', '==', invoiceId)
                .where('status', '==', 'open')
                .get();

              for (const issue of issuesSnapshot.docs) {
                await issue.ref.update({
                  status: 'resolved',
                  resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
                  resolution: 'Ledger entry auto-generated by reconciliation worker',
                });
                issuesResolved += 1;
              }
            }
          } catch (error) {
            mismatches += 1;
            functions.logger.error('Error reconciling purchase order', { purchaseOrderId, error });
          }
        }

        const duration = Date.now() - startTime;
        functions.logger.info('Reconciliation completed', { processed, mismatches, backfilled, issuesResolved, duration });

        return { processed, mismatches, backfilled, issuesResolved, duration };
      });

    /**
     * Overdue Invoice Reminder
     * Sends notifications for invoices that are past due
     */
    export const overdueInvoiceReminders = functions
      .runWith({
        timeoutSeconds: 300,
        memory: '512MB',
      })
      .pubsub.schedule('every day 09:00')
      .timeZone('Africa/Nairobi')
      .onRun(async () => {
        const startTime = Date.now();
        let notificationsSent = 0;
        let emailsQueued = 0;
        let smsQueued = 0;

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayTimestamp = admin.firestore.Timestamp.fromDate(todayStart);
        const dayKey = todayStart.toISOString().slice(0, 10);

        const overdueSnapshot = await db
          .collection('invoices')
          .where('paymentStatus', 'in', ['pending', 'partial'])
          .where('dueDate', '<', todayTimestamp)
          .get();

        for (const invoiceDoc of overdueSnapshot.docs) {
          const invoice = invoiceDoc.data() ?? {};
          const invoiceId = invoiceDoc.id;

          try {
            const lastReminderSent = asDate(invoice.lastReminderSent);
            if (lastReminderSent && todayStart.getTime() - lastReminderSent.getTime() < DAY_IN_MS) {
              continue;
            }

            const dueDate = asDate(invoice.dueDate) ?? todayStart;
            const daysOverdue = Math.max(
              1,
              Math.floor((todayStart.getTime() - dueDate.getTime()) / DAY_IN_MS),
            );

            await db.collection('notifications').add({
              type: 'invoice_overdue',
              userId: invoice.retailerUserId ?? invoice.retailerId ?? null,
              organizationId: invoice.retailerOrgId ?? invoice.retailerId ?? null,
              title: 'Invoice Overdue',
              message: `Invoice #${invoice.number ?? invoiceId} is ${daysOverdue} days overdue. Amount: KSh ${(
                safeNumber((invoice.amount as Record<string, unknown>)?.total) ?? 0
              ).toLocaleString()}`,
              data: {
                invoiceId,
                daysOverdue,
                amount: safeNumber((invoice.amount as Record<string, unknown>)?.total) ?? 0,
                supplierId: invoice.supplierId ?? null,
                supplierName: invoice.supplierName ?? null,
              },
              read: false,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            notificationsSent += 1;

            const contact = await fetchRetailerContact(invoice.retailerId, invoice.retailerUserId);
            const amountTotal = safeNumber((invoice.amount as Record<string, unknown>)?.total) ?? 0;

            if (contact.retailerEmail) {
              await ensureCommunicationJob('email', uniqueReminderKey(invoiceId, 'email', dayKey), {
                to: contact.retailerEmail,
                template: 'invoice_overdue',
                invoiceId,
                retailerId: invoice.retailerId ?? null,
                payload: {
                  invoiceNumber: invoice.number ?? invoiceId,
                  amount: amountTotal,
                  daysOverdue,
                  dueDate: dueDate.toISOString(),
                  supplierName: invoice.supplierName ?? '',
                  retailerName: contact.retailerName ?? '',
                },
              });
              emailsQueued += 1;
            }

            if (contact.retailerPhone) {
              await ensureCommunicationJob('sms', uniqueReminderKey(invoiceId, 'sms', dayKey), {
                to: contact.retailerPhone,
                invoiceId,
                retailerId: invoice.retailerId ?? null,
                message: `Invoice ${invoice.number ?? invoiceId} is ${daysOverdue} days overdue. Amount KSh ${amountTotal.toLocaleString()}. Please arrange payment.`,
              });
              smsQueued += 1;
            }

            await invoiceDoc.ref.update({
              lastReminderSent: admin.firestore.FieldValue.serverTimestamp(),
              reminderCount: admin.firestore.FieldValue.increment(1),
              lastReminderChannels: {
                inApp: true,
                email: Boolean(contact.retailerEmail),
                sms: Boolean(contact.retailerPhone),
              },
            });
          } catch (error) {
            functions.logger.error('Failed to send overdue reminder', { invoiceId, error });
          }
        }

        const duration = Date.now() - startTime;
        functions.logger.info('Overdue reminders completed', { notificationsSent, emailsQueued, smsQueued, duration });

        return { notificationsSent, emailsQueued, smsQueued, duration };
      });

    /**
     * Dispute Handler
     * Downgrades credit scores when disputes are raised
     */
    export const onDisputeCreated = functions.firestore
      .document('disputes/{disputeId}')
      .onCreate(async (snap) => {
        const dispute = snap.data() ?? {};
        const retailerId = dispute.retailerId;

        if (typeof retailerId !== 'string' || retailerId.length === 0) {
          functions.logger.warn('Dispute created without retailerId', { disputeId: snap.id });
          return;
        }

        try {
          await recalculateRetailerCredit(retailerId, {
            reason: 'dispute_created',
            triggerId: snap.id,
          });
        } catch (error) {
          functions.logger.error('Failed to recalculate credit after dispute creation', {
            retailerId,
            disputeId: snap.id,
            error,
          });
        }
      });

    /**
     * Dispute Resolution Handler
     * Restores credit scores when disputes are resolved in retailer's favor
     */
    export const onDisputeResolved = functions.firestore
      .document('disputes/{disputeId}')
      .onUpdate(async (change, context) => {
        const before = change.before.data() ?? {};
        const after = change.after.data() ?? {};

        if (before.status === after.status) {
          return;
        }

        if (after.status !== 'resolved') {
          return;
        }

        const retailerId = after.retailerId;
        if (typeof retailerId !== 'string' || retailerId.length === 0) {
          return;
        }

        try {
          await recalculateRetailerCredit(retailerId, {
            reason: 'dispute_resolved',
            triggerId: context.params.disputeId,
          });
        } catch (error) {
          functions.logger.error('Failed to recalculate credit after dispute resolution', {
            retailerId,
            disputeId: context.params.disputeId,
            error,
          });
        }
      });

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AUTO-REPLENISHMENT BACKGROUND JOB
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Daily scheduled job to generate replenishment suggestions for all organizations
 * Runs at 2:00 AM IST (20:30 UTC previous day) every day
 * 
 * This automates the replenishment process by:
 * 1. Fetching all organizations
 * 2. For each org, checking inventory levels against reorder points
 * 3. Generating suggestions for low-stock items
 * 4. Selecting best suppliers based on lead time and cost
 */
export const dailyReplenishmentCheck = functions.pubsub
  .schedule('30 20 * * *') // 2:00 AM IST = 20:30 UTC previous day
  .timeZone('Asia/Kolkata')
  .onRun(async (context) => {
    functions.logger.info('Starting daily replenishment check job');

    try {
      // Track job execution
      const jobStartTime = admin.firestore.Timestamp.now();
      const jobRef = await db.collection('replenishment_jobs').add({
        type: 'daily_check',
        status: 'running',
        startedAt: jobStartTime,
        triggeredBy: 'cron',
      });

      let processedOrgs = 0;
      let totalSuggestions = 0;
      const errors: Array<{ orgId: string; error: string }> = [];

      // Get all organizations
      const orgsSnapshot = await db.collection('organizations').get();
      functions.logger.info(`Found ${orgsSnapshot.size} organizations to process`);

      // Process each organization
      for (const orgDoc of orgsSnapshot.docs) {
        const orgId = orgDoc.id;
        const orgData = orgDoc.data();

        try {
          functions.logger.info(`Processing organization: ${orgId} (${orgData.name || 'Unknown'})`);

          // Generate replenishment suggestions for this org
          const suggestionsCount = await generateReplenishmentSuggestionsForOrg(orgId);
          
          totalSuggestions += suggestionsCount;
          processedOrgs++;

          functions.logger.info(`Generated ${suggestionsCount} suggestions for org: ${orgId}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          functions.logger.error(`Failed to process org ${orgId}:`, error);
          errors.push({ orgId, error: errorMessage });
        }
      }

      // Update job status
      await jobRef.update({
        status: 'completed',
        completedAt: admin.firestore.Timestamp.now(),
        processedOrgs,
        totalSuggestions,
        errors: errors.length > 0 ? errors : undefined,
      });

      functions.logger.info('Daily replenishment check completed', {
        processedOrgs,
        totalSuggestions,
        errorCount: errors.length,
      });

      return {
        success: true,
        processedOrgs,
        totalSuggestions,
        errorCount: errors.length,
      };
    } catch (error) {
      functions.logger.error('Daily replenishment check failed:', error);
      throw error;
    }
  });

/**
 * Generate replenishment suggestions for a single organization
 * This is the core logic that checks inventory and creates suggestions
 */
async function generateReplenishmentSuggestionsForOrg(orgId: string): Promise<number> {
  const REORDER_QTY_MULTIPLIER = 1.5; // Safety stock multiplier
  let suggestionsCreated = 0;

  // 1. Get all inventory items for this org
  const inventorySnapshot = await db
    .collection('inventory')
    .where('orgId', '==', orgId)
    .get();

  functions.logger.info(`Found ${inventorySnapshot.size} inventory items for org: ${orgId}`);

  // 2. Get all products to check reorder points
  const productsSnapshot = await db
    .collection('pos_products')
    .where('orgId', '==', orgId)
    .get();

  const productsMap = new Map<string, any>();
  productsSnapshot.docs.forEach(doc => {
    productsMap.set(doc.id, { id: doc.id, ...doc.data() });
  });

  // 3. Check each inventory item
  for (const invDoc of inventorySnapshot.docs) {
    const inventory = invDoc.data();
    const productId = inventory.productId;

    if (!productId) continue;

    const product = productsMap.get(productId);
    if (!product) continue;

    // Skip if no reorder point set
    const reorderPoint = product.reorderPoint || 0;
    if (reorderPoint <= 0) continue;

    // Calculate total stock
    const totalStock = 
      (inventory.qtyBase || 0) * (inventory.unitsPerBase || 1) + 
      (inventory.qtyLoose || 0);

    // Check if below reorder point
    if (totalStock >= reorderPoint) continue;

    // 4. Find best supplier for this product
    const supplierSkusSnapshot = await db
      .collection('supplier_skus')
      .where('orgId', '==', orgId)
      .where('productId', '==', productId)
      .orderBy('leadTimeDays', 'asc')
      .orderBy('costPrice', 'asc')
      .limit(1)
      .get();

    if (supplierSkusSnapshot.empty) {
      functions.logger.warn(`No supplier found for product ${productId} in org ${orgId}`);
      continue;
    }

    const supplierSku = supplierSkusSnapshot.docs[0].data();

    // 5. Get supplier details
    const supplierDoc = await db
      .collection('suppliers')
      .doc(supplierSku.supplierId)
      .get();

    if (!supplierDoc.exists) {
      functions.logger.warn(`Supplier ${supplierSku.supplierId} not found`);
      continue;
    }

    const supplier = supplierDoc.data();

    // 6. Calculate suggested quantity
    const reorderQty = product.reorderQty || reorderPoint;
    const suggestedQty = Math.ceil(reorderQty * REORDER_QTY_MULTIPLIER);
    const stockPercentage = (totalStock / reorderPoint) * 100;

    // Determine priority
    let priority: 'low' | 'medium' | 'high' | 'critical';
    if (stockPercentage <= 0) priority = 'critical';
    else if (stockPercentage <= 25) priority = 'critical';
    else if (stockPercentage <= 50) priority = 'high';
    else if (stockPercentage <= 75) priority = 'medium';
    else priority = 'low';

    // Determine reason
    let reason: string;
    if (totalStock <= 0) {
      reason = 'Out of stock - urgent replenishment required';
    } else if (stockPercentage <= 25) {
      reason = `Critical: Only ${Math.round(stockPercentage)}% of reorder point remaining`;
    } else {
      reason = `Below reorder point (${Math.round(stockPercentage)}% remaining)`;
    }

    // 7. Check if suggestion already exists
    const existingSuggestionSnapshot = await db
      .collection('replenishment_suggestions')
      .where('orgId', '==', orgId)
      .where('productId', '==', productId)
      .where('status', 'in', ['pending', 'approved'])
      .limit(1)
      .get();

    if (!existingSuggestionSnapshot.empty) {
      functions.logger.info(`Suggestion already exists for product ${productId}`);
      continue;
    }

    // 8. Create suggestion
    const suggestion = {
      orgId,
      productId,
      productName: product.name || 'Unknown Product',
      currentStock: totalStock,
      reorderPoint,
      suggestedQty,
      preferredSupplierId: supplierSku.supplierId,
      preferredSupplierName: supplier?.name || 'Unknown Supplier',
      supplierLeadTime: supplierSku.leadTimeDays || 7,
      unitCost: supplierSku.costPrice || 0,
      totalCost: suggestedQty * (supplierSku.costPrice || 0),
      status: 'pending',
      createdAt: admin.firestore.Timestamp.now(),
      reason,
      priority,
    };

    await db.collection('replenishment_suggestions').add(suggestion);
    suggestionsCreated++;

    functions.logger.info(
      `Created ${priority} priority suggestion for ${product.name} (${productId}) in org ${orgId}`
    );
  }

  return suggestionsCreated;
}
