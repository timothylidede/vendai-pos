"use strict";
/**
 * VendAI Cloud Functions
 * Background jobs for credit scoring, reconciliation, and notifications
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onDisputeResolved = exports.onDisputeCreated = exports.overdueInvoiceReminders = exports.reconciliationWorker = exports.onPaymentReceived = exports.recalculateCreditScores = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const credit_engine_1 = require("./credit-engine");
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
const clamp = (value, min, max) => {
    if (!Number.isFinite(value)) {
        return min;
    }
    return Math.min(Math.max(value, min), max);
};
const safeNumber = (value) => {
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
const asDate = (value) => {
    if (!value) {
        return null;
    }
    if (value instanceof Date) {
        return value;
    }
    if (value === null || value === void 0 ? void 0 : value.toDate) {
        return value.toDate();
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
const uniqueReminderKey = (invoiceId, channel, dayKey) => `invoice_overdue:${invoiceId}:${channel}:${dayKey}`;
const contactCache = new Map();
async function fetchRetailerContact(retailerId, fallbackUserId) {
    var _a;
    if (contactCache.has(retailerId)) {
        return contactCache.get(retailerId);
    }
    let snapshot = await db.collection('users').doc(retailerId).get();
    if (!snapshot.exists && fallbackUserId && fallbackUserId !== retailerId) {
        snapshot = await db.collection('users').doc(fallbackUserId).get();
    }
    const data = snapshot.exists ? (_a = snapshot.data()) !== null && _a !== void 0 ? _a : {} : {};
    const contact = {
        retailerName: typeof (data === null || data === void 0 ? void 0 : data.displayName) === 'string'
            ? data.displayName
            : typeof (data === null || data === void 0 ? void 0 : data.businessName) === 'string'
                ? data.businessName
                : typeof (data === null || data === void 0 ? void 0 : data.name) === 'string'
                    ? data.name
                    : null,
        retailerEmail: typeof (data === null || data === void 0 ? void 0 : data.billingEmail) === 'string'
            ? data.billingEmail
            : typeof (data === null || data === void 0 ? void 0 : data.email) === 'string'
                ? data.email
                : typeof (data === null || data === void 0 ? void 0 : data.primaryEmail) === 'string'
                    ? data.primaryEmail
                    : null,
        retailerPhone: typeof (data === null || data === void 0 ? void 0 : data.phoneNumber) === 'string'
            ? data.phoneNumber
            : typeof (data === null || data === void 0 ? void 0 : data.contactPhone) === 'string'
                ? data.contactPhone
                : null,
        retailerUserId: snapshot.exists ? snapshot.id : fallbackUserId !== null && fallbackUserId !== void 0 ? fallbackUserId : null,
    };
    contactCache.set(retailerId, contact);
    return contact;
}
async function ensureCommunicationJob(channel, uniqueKey, payload) {
    const existing = await db
        .collection(COMMUNICATION_COLLECTION)
        .where('uniqueKey', '==', uniqueKey)
        .limit(1)
        .get();
    if (!existing.empty) {
        return;
    }
    await db.collection(COMMUNICATION_COLLECTION).add(Object.assign({ uniqueKey,
        channel, status: 'pending', priority: channel === 'sms' ? 'urgent' : 'high', createdAt: admin.firestore.FieldValue.serverTimestamp(), scheduledFor: admin.firestore.FieldValue.serverTimestamp() }, payload));
}
async function buildCreditAssessmentInput(retailerId) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * DAY_IN_MS);
    const paymentsLookbackDate = new Date(now.getTime() - PAYMENT_LOOKBACK_DAYS * DAY_IN_MS);
    const retailerRef = db.collection('users').doc(retailerId);
    const creditProfileRef = db.collection('credit_profiles').doc(retailerId);
    const [retailerSnap, creditProfileSnap] = await Promise.all([retailerRef.get(), creditProfileRef.get()]);
    if (!creditProfileSnap.exists) {
        return null;
    }
    const creditProfile = (_a = creditProfileSnap.data()) !== null && _a !== void 0 ? _a : {};
    const metrics = ((_b = creditProfile.metrics) !== null && _b !== void 0 ? _b : {});
    const existingCreditLimit = (_c = safeNumber(metrics.existingCreditLimit)) !== null && _c !== void 0 ? _c : DEFAULT_EXISTING_LIMIT;
    const manualAdjustment = clamp((_d = safeNumber(metrics.manualAdjustment)) !== null && _d !== void 0 ? _d : 0, -30, 30);
    const storedDaysSinceSignup = (_e = safeNumber(metrics.daysSinceSignup)) !== null && _e !== void 0 ? _e : DEFAULT_DAYS_SINCE_SIGNUP;
    const retailerData = retailerSnap.exists ? (_f = retailerSnap.data()) !== null && _f !== void 0 ? _f : {} : {};
    const createdDate = (_j = (_h = (_g = asDate(retailerData.createdAt)) !== null && _g !== void 0 ? _g : asDate(retailerData.signupDate)) !== null && _h !== void 0 ? _h : asDate(creditProfile.createdAt)) !== null && _j !== void 0 ? _j : null;
    const daysSinceSignup = createdDate
        ? Math.max(1, Math.round((now.getTime() - createdDate.getTime()) / DAY_IN_MS))
        : storedDaysSinceSignup;
    const storedSectorRisk = (_l = (_k = metrics.sectorRisk) !== null && _k !== void 0 ? _k : retailerData.sectorRisk) !== null && _l !== void 0 ? _l : retailerData.industryRisk;
    const sectorRisk = storedSectorRisk === 'low' || storedSectorRisk === 'high' || storedSectorRisk === 'medium'
        ? storedSectorRisk
        : 'medium';
    const paymentsQuery = db
        .collection('payments')
        .where('retailerId', '==', retailerId)
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(paymentsLookbackDate))
        .orderBy('createdAt', 'desc')
        .limit(MAX_PAYMENTS_TO_LOAD);
    const [paymentsSnapshot, purchaseOrdersSnapshot, outstandingInvoicesSnapshot, disputesSnapshot, activeDisputesSnapshot] = await Promise.all([
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
    const invoiceLagMap = new Map();
    paymentsSnapshot.forEach((docSnap) => {
        var _a, _b, _c, _d, _e, _f;
        const payment = (_a = docSnap.data()) !== null && _a !== void 0 ? _a : {};
        const createdAt = (_c = (_b = asDate(payment.receivedAt)) !== null && _b !== void 0 ? _b : asDate(payment.createdAt)) !== null && _c !== void 0 ? _c : now;
        if (!createdAt) {
            return;
        }
        const amount = Math.max((_d = safeNumber(payment.amount)) !== null && _d !== void 0 ? _d : 0, 0);
        const statusRaw = typeof payment.status === 'string' ? payment.status.toLowerCase() : 'pending';
        const isSuccessStatus = statusRaw === 'paid' || statusRaw === 'success' || statusRaw === 'partial';
        if (createdAt >= ninetyDaysAgo) {
            paymentVolume90d += amount;
            totalAttempts += 1;
            if (isSuccessStatus) {
                successfulPayments += 1;
                totalPayments90d += 1;
            }
            else if (statusRaw === 'failed') {
                failedPayments += 1;
            }
            const paidOnTime = payment.paidOnTime === true;
            if (!consecutiveBroken && isSuccessStatus) {
                if (paidOnTime) {
                    consecutiveOnTimePayments += 1;
                }
                else {
                    consecutiveBroken = true;
                }
            }
            if (paidOnTime) {
                onTimePayments += 1;
            }
            else if (payment.paidOnTime === false) {
                latePayments += 1;
            }
            if (typeof payment.invoiceId === 'string') {
                const paidAt = (_e = asDate(payment.receivedAt)) !== null && _e !== void 0 ? _e : createdAt;
                if (paidAt) {
                    const existing = (_f = invoiceLagMap.get(payment.invoiceId)) !== null && _f !== void 0 ? _f : [];
                    existing.push(paidAt);
                    invoiceLagMap.set(payment.invoiceId, existing);
                }
            }
        }
        else {
            paymentVolumePrior90d += amount;
        }
    });
    const filteredPurchaseOrders = purchaseOrdersSnapshot.docs.filter((docSnap) => {
        var _a;
        const status = ((_a = docSnap.data()) !== null && _a !== void 0 ? _a : {}).status;
        return status !== 'cancelled';
    });
    const orders90d = filteredPurchaseOrders.length;
    const totalOrderValue90d = filteredPurchaseOrders.reduce((sum, docSnap) => {
        var _a, _b, _c;
        const total = (_c = safeNumber((_b = (_a = docSnap.data()) === null || _a === void 0 ? void 0 : _a.amount) === null || _b === void 0 ? void 0 : _b.total)) !== null && _c !== void 0 ? _c : 0;
        return sum + Math.max(total, 0);
    }, 0);
    const averageOrderValue = orders90d > 0 ? totalOrderValue90d / orders90d : paymentVolume90d > 0 ? paymentVolume90d : totalOrderValue90d;
    let currentOutstanding = 0;
    let overdueInvoices = 0;
    outstandingInvoicesSnapshot.forEach((docSnap) => {
        var _a, _b, _c, _d;
        const invoice = (_a = docSnap.data()) !== null && _a !== void 0 ? _a : {};
        const total = (_c = safeNumber((_b = invoice.amount) === null || _b === void 0 ? void 0 : _b.total)) !== null && _c !== void 0 ? _c : 0;
        const paid = (_d = safeNumber(invoice.totalPaidAmount)) !== null && _d !== void 0 ? _d : 0;
        currentOutstanding += Math.max(total - paid, 0);
        const dueDate = asDate(invoice.dueDate);
        if (dueDate && dueDate < now) {
            overdueInvoices += 1;
        }
    });
    let repaymentLagDays = (_m = safeNumber(metrics.repaymentLagDays)) !== null && _m !== void 0 ? _m : 0;
    if (invoiceLagMap.size > 0) {
        const invoiceRefs = Array.from(invoiceLagMap.keys()).map((invoiceId) => db.collection('invoices').doc(invoiceId));
        const invoiceSnapshots = invoiceRefs.length > 0 ? await db.getAll(...invoiceRefs) : [];
        let lagSum = 0;
        let lagCount = 0;
        invoiceSnapshots.forEach((invoiceSnap) => {
            var _a, _b;
            if (!invoiceSnap || !invoiceSnap.exists) {
                return;
            }
            const dueDate = asDate(((_a = invoiceSnap.data()) !== null && _a !== void 0 ? _a : {}).dueDate);
            if (!dueDate) {
                return;
            }
            const paidDates = (_b = invoiceLagMap.get(invoiceSnap.id)) !== null && _b !== void 0 ? _b : [];
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
    const onTimePaymentRate = totalPayments90d > 0
        ? clamp(onTimePayments / totalPayments90d, 0, 1)
        : clamp((_o = safeNumber(metrics.onTimePaymentRate)) !== null && _o !== void 0 ? _o : 1, 0, 1);
    const disputeRateBase = totalPayments90d > 0 ? disputeCount90d / totalPayments90d : 0;
    const disputeRate = clamp(disputeRateBase + activeDisputes * 0.05, 0, 1);
    const creditUtilization = existingCreditLimit > 0 ? currentOutstanding / existingCreditLimit : 0;
    const trailingGrowthRate = paymentVolumePrior90d > 0
        ? (paymentVolume90d - paymentVolumePrior90d) / paymentVolumePrior90d
        : paymentVolume90d > 0
            ? 1
            : 0;
    const metricsSnapshot = {
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
    const input = {
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
    const stats = {
        totalPayments90d,
        paymentVolume90d,
        paymentVolumePrior90d,
        disputeCount90d,
        activeDisputes,
        onTimePayments,
        latePayments,
        overdueInvoices,
    };
    const context = {
        retailerName: typeof retailerData.displayName === 'string'
            ? retailerData.displayName
            : typeof retailerData.businessName === 'string'
                ? retailerData.businessName
                : typeof retailerData.name === 'string'
                    ? retailerData.name
                    : null,
        retailerEmail: typeof retailerData.billingEmail === 'string'
            ? retailerData.billingEmail
            : typeof retailerData.email === 'string'
                ? retailerData.email
                : typeof retailerData.primaryEmail === 'string'
                    ? retailerData.primaryEmail
                    : null,
        retailerPhone: typeof retailerData.phoneNumber === 'string'
            ? retailerData.phoneNumber
            : typeof retailerData.contactPhone === 'string'
                ? retailerData.contactPhone
                : null,
        retailerUserId: retailerSnap.exists ? retailerSnap.id : null,
    };
    return { input, metricsSnapshot, stats, context };
}
async function updateWatchlistForRetailer(retailerId, assessment, input, stats, reason) {
    const shouldWatch = assessment.score < WATCHLIST_SCORE_THRESHOLD ||
        input.disputeRate >= WATCHLIST_DISPUTE_RATE ||
        stats.activeDisputes > 0 ||
        assessment.creditUtilization > assessment.tier.utilizationCeiling;
    const watchlistRef = db.collection('watchlist').doc(retailerId);
    if (shouldWatch) {
        await watchlistRef.set({
            retailerId,
            status: 'watching',
            score: assessment.score,
            tier: assessment.tier.id,
            disputeRate: input.disputeRate,
            activeDisputes: stats.activeDisputes,
            creditUtilization: assessment.creditUtilization,
            reason,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    else {
        await watchlistRef.set({
            retailerId,
            status: 'cleared',
            clearedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
}
async function recalculateRetailerCredit(retailerId, options) {
    var _a, _b;
    const computation = await buildCreditAssessmentInput(retailerId);
    if (!computation) {
        functions.logger.warn('Skipped credit recalculation because credit profile is missing', { retailerId });
        return null;
    }
    const { input, metricsSnapshot, stats } = computation;
    const assessment = (0, credit_engine_1.assessCredit)(input, credit_engine_1.defaultCreditEngineOptions);
    const creditProfileRef = db.collection('credit_profiles').doc(retailerId);
    await creditProfileRef.set({
        retailerId,
        metrics: Object.assign(Object.assign({}, metricsSnapshot), { onTimePaymentRate: input.onTimePaymentRate, disputeRate: input.disputeRate, creditUtilization: input.creditUtilization, trailingGrowthRate: input.trailingGrowthRate, averageOrderValue: input.averageOrderValue, daysSinceSignup: input.daysSinceSignup, manualAdjustment: (_a = input.manualAdjustment) !== null && _a !== void 0 ? _a : 0, activeDisputes: stats.activeDisputes, totalPayments90d: stats.totalPayments90d, paymentVolumePrior90d: stats.paymentVolumePrior90d, overdueInvoiceCount: stats.overdueInvoices, lastRecalculated: admin.firestore.FieldValue.serverTimestamp() }),
        lastAssessment: assessment,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    await creditProfileRef.collection('credit_history').add({
        assessment,
        input,
        metricsSnapshot,
        stats,
        reason: options.reason,
        triggerId: (_b = options.triggerId) !== null && _b !== void 0 ? _b : null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await updateWatchlistForRetailer(retailerId, assessment, input, stats, options.reason);
    return { assessment, stats };
}
/**
 * Credit Score Recalculation Job
 * Runs every 6 hours to recalculate credit scores for active retailers
 */
exports.recalculateCreditScores = functions
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
            }
            else {
                skipped += 1;
            }
        }
        catch (error) {
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
exports.onPaymentReceived = functions.firestore
    .document('payments/{paymentId}')
    .onCreate(async (snap) => {
    var _a;
    const payment = (_a = snap.data()) !== null && _a !== void 0 ? _a : {};
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
    }
    catch (error) {
        functions.logger.error('Failed to recalculate credit after payment', { retailerId, paymentId: snap.id, error });
    }
});
/**
 * Reconciliation Worker
 * Matches PO ↔ Invoice ↔ Payment and flags mismatches
 * Also backfills missing ledger entries
 */
exports.reconciliationWorker = functions
    .runWith({
    timeoutSeconds: 540,
    memory: '2GB',
})
    .pubsub.schedule('every day 02:00')
    .timeZone('Africa/Nairobi')
    .onRun(async () => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
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
        const po = (_a = poDoc.data()) !== null && _a !== void 0 ? _a : {};
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
            const invoice = (_b = invoiceDoc.data()) !== null && _b !== void 0 ? _b : {};
            const invoiceId = invoiceDoc.id;
            const poTotal = (_d = safeNumber((_c = po.amount) === null || _c === void 0 ? void 0 : _c.total)) !== null && _d !== void 0 ? _d : 0;
            const invoiceTotal = (_f = safeNumber((_e = invoice.amount) === null || _e === void 0 ? void 0 : _e.total)) !== null && _f !== void 0 ? _f : 0;
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
                var _a, _b, _c, _d, _e;
                const payment = (_a = paymentDoc.data()) !== null && _a !== void 0 ? _a : {};
                totalPaid += Math.max((_b = safeNumber(payment.amount)) !== null && _b !== void 0 ? _b : 0, 0);
                const fees = ((_c = payment.fees) !== null && _c !== void 0 ? _c : {});
                totalCommission += Math.max((_d = safeNumber(fees.vendaiCommission)) !== null && _d !== void 0 ? _d : 0, 0);
                totalProcessorFees += Math.max((_e = safeNumber(fees.processor)) !== null && _e !== void 0 ? _e : 0, 0);
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
                const netPayoutAmount = Math.max(invoiceTotal - totalCommission - totalProcessorFees, 0);
                const ledgerRef = db.collection('ledger_entries').doc();
                await ledgerRef.set({
                    retailerOrgId: (_h = (_g = invoice.retailerOrgId) !== null && _g !== void 0 ? _g : po.retailerOrgId) !== null && _h !== void 0 ? _h : null,
                    supplierOrgId: (_k = (_j = invoice.supplierOrgId) !== null && _j !== void 0 ? _j : po.supplierOrgId) !== null && _k !== void 0 ? _k : null,
                    purchaseOrderId,
                    invoiceId,
                    paymentId: (_m = (_l = paymentsSnapshot.docs[0]) === null || _l === void 0 ? void 0 : _l.id) !== null && _m !== void 0 ? _m : null,
                    supplierId: (_p = (_o = invoice.supplierId) !== null && _o !== void 0 ? _o : po.supplierId) !== null && _p !== void 0 ? _p : null,
                    supplierName: (_r = (_q = invoice.supplierName) !== null && _q !== void 0 ? _q : po.supplierName) !== null && _r !== void 0 ? _r : null,
                    retailerId: (_t = (_s = invoice.retailerId) !== null && _s !== void 0 ? _s : po.retailerId) !== null && _t !== void 0 ? _t : null,
                    retailerName: (_v = (_u = invoice.retailerName) !== null && _u !== void 0 ? _u : po.retailerName) !== null && _v !== void 0 ? _v : null,
                    grossAmount: invoiceTotal,
                    vendaiCommissionAmount: totalCommission,
                    processorFeeAmount: totalProcessorFees,
                    netPayoutAmount,
                    currency: (_x = (_w = invoice.amount) === null || _w === void 0 ? void 0 : _w.currency) !== null && _x !== void 0 ? _x : 'KES',
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
        }
        catch (error) {
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
exports.overdueInvoiceReminders = functions
    .runWith({
    timeoutSeconds: 300,
    memory: '512MB',
})
    .pubsub.schedule('every day 09:00')
    .timeZone('Africa/Nairobi')
    .onRun(async () => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w;
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
        const invoice = (_a = invoiceDoc.data()) !== null && _a !== void 0 ? _a : {};
        const invoiceId = invoiceDoc.id;
        try {
            const lastReminderSent = asDate(invoice.lastReminderSent);
            if (lastReminderSent && todayStart.getTime() - lastReminderSent.getTime() < DAY_IN_MS) {
                continue;
            }
            const dueDate = (_b = asDate(invoice.dueDate)) !== null && _b !== void 0 ? _b : todayStart;
            const daysOverdue = Math.max(1, Math.floor((todayStart.getTime() - dueDate.getTime()) / DAY_IN_MS));
            await db.collection('notifications').add({
                type: 'invoice_overdue',
                userId: (_d = (_c = invoice.retailerUserId) !== null && _c !== void 0 ? _c : invoice.retailerId) !== null && _d !== void 0 ? _d : null,
                organizationId: (_f = (_e = invoice.retailerOrgId) !== null && _e !== void 0 ? _e : invoice.retailerId) !== null && _f !== void 0 ? _f : null,
                title: 'Invoice Overdue',
                message: `Invoice #${(_g = invoice.number) !== null && _g !== void 0 ? _g : invoiceId} is ${daysOverdue} days overdue. Amount: KSh ${((_j = safeNumber((_h = invoice.amount) === null || _h === void 0 ? void 0 : _h.total)) !== null && _j !== void 0 ? _j : 0).toLocaleString()}`,
                data: {
                    invoiceId,
                    daysOverdue,
                    amount: (_l = safeNumber((_k = invoice.amount) === null || _k === void 0 ? void 0 : _k.total)) !== null && _l !== void 0 ? _l : 0,
                    supplierId: (_m = invoice.supplierId) !== null && _m !== void 0 ? _m : null,
                    supplierName: (_o = invoice.supplierName) !== null && _o !== void 0 ? _o : null,
                },
                read: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            notificationsSent += 1;
            const contact = await fetchRetailerContact(invoice.retailerId, invoice.retailerUserId);
            const amountTotal = (_q = safeNumber((_p = invoice.amount) === null || _p === void 0 ? void 0 : _p.total)) !== null && _q !== void 0 ? _q : 0;
            if (contact.retailerEmail) {
                await ensureCommunicationJob('email', uniqueReminderKey(invoiceId, 'email', dayKey), {
                    to: contact.retailerEmail,
                    template: 'invoice_overdue',
                    invoiceId,
                    retailerId: (_r = invoice.retailerId) !== null && _r !== void 0 ? _r : null,
                    payload: {
                        invoiceNumber: (_s = invoice.number) !== null && _s !== void 0 ? _s : invoiceId,
                        amount: amountTotal,
                        daysOverdue,
                        dueDate: dueDate.toISOString(),
                        supplierName: (_t = invoice.supplierName) !== null && _t !== void 0 ? _t : '',
                        retailerName: (_u = contact.retailerName) !== null && _u !== void 0 ? _u : '',
                    },
                });
                emailsQueued += 1;
            }
            if (contact.retailerPhone) {
                await ensureCommunicationJob('sms', uniqueReminderKey(invoiceId, 'sms', dayKey), {
                    to: contact.retailerPhone,
                    invoiceId,
                    retailerId: (_v = invoice.retailerId) !== null && _v !== void 0 ? _v : null,
                    message: `Invoice ${(_w = invoice.number) !== null && _w !== void 0 ? _w : invoiceId} is ${daysOverdue} days overdue. Amount KSh ${amountTotal.toLocaleString()}. Please arrange payment.`,
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
        }
        catch (error) {
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
exports.onDisputeCreated = functions.firestore
    .document('disputes/{disputeId}')
    .onCreate(async (snap) => {
    var _a;
    const dispute = (_a = snap.data()) !== null && _a !== void 0 ? _a : {};
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
    }
    catch (error) {
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
exports.onDisputeResolved = functions.firestore
    .document('disputes/{disputeId}')
    .onUpdate(async (change, context) => {
    var _a, _b;
    const before = (_a = change.before.data()) !== null && _a !== void 0 ? _a : {};
    const after = (_b = change.after.data()) !== null && _b !== void 0 ? _b : {};
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
    }
    catch (error) {
        functions.logger.error('Failed to recalculate credit after dispute resolution', {
            retailerId,
            disputeId: context.params.disputeId,
            error,
        });
    }
});
//# sourceMappingURL=index.js.map