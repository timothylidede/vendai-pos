"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTierForScore = exports.defaultCreditEngineOptions = exports.CREDIT_TIERS = void 0;
exports.applyPaymentOutcomeToMetrics = applyPaymentOutcomeToMetrics;
exports.assessCredit = assessCredit;
exports.forecastCreditTrajectory = forecastCreditTrajectory;
exports.calculatePortfolioSummary = calculatePortfolioSummary;
exports.CREDIT_TIERS = [
    {
        id: 'starter',
        label: 'Starter',
        minScore: 0,
        reviewCadenceDays: 30,
        maxLimitMultiplier: 1.1,
        utilizationCeiling: 0.8,
        description: 'New retailers with limited history. Manual review each month.'
    },
    {
        id: 'growth',
        label: 'Growth',
        minScore: 55,
        reviewCadenceDays: 45,
        maxLimitMultiplier: 1.6,
        utilizationCeiling: 0.88,
        description: 'Consistent performance and growing volume. Semi-automated reviews.'
    },
    {
        id: 'scale',
        label: 'Scale',
        minScore: 70,
        reviewCadenceDays: 60,
        maxLimitMultiplier: 2.1,
        utilizationCeiling: 0.92,
        description: 'High-performing retailers with predictable repayment behaviour.'
    },
    {
        id: 'elite',
        label: 'Elite',
        minScore: 85,
        reviewCadenceDays: 90,
        maxLimitMultiplier: 2.6,
        utilizationCeiling: 0.95,
        description: 'Top tier partners eligible for extended payment terms and auto-limit hikes.'
    }
];
exports.defaultCreditEngineOptions = {
    baseLimit: 50000,
    maxLimit: 750000,
    volumeTarget: 200000,
    targetRepaymentLag: 2,
    volumeToCreditRatio: 0.32,
    scoreMultiplier: 600,
    outstandingWeight: 0.2,
    utilizationComfortThreshold: 0.65
};
function applyPaymentOutcomeToMetrics(metrics, amount, outcome) {
    const normalizedAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;
    const next = Object.assign(Object.assign({}, metrics), { totalAttempts: metrics.totalAttempts + 1 });
    switch (outcome) {
        case 'paid': {
            next.trailingVolume90d += normalizedAmount;
            next.orders90d += 1;
            next.successfulPayments += 1;
            next.consecutiveOnTimePayments = metrics.consecutiveOnTimePayments + 1;
            next.manualAdjustment += 1;
            next.currentOutstanding = Math.max(metrics.currentOutstanding - normalizedAmount, 0);
            break;
        }
        case 'partial': {
            next.trailingVolume90d += normalizedAmount;
            next.consecutiveOnTimePayments = metrics.consecutiveOnTimePayments + 1;
            next.manualAdjustment += 0.5;
            next.currentOutstanding = Math.max(metrics.currentOutstanding - normalizedAmount, 0);
            break;
        }
        case 'failed': {
            next.failedPayments += 1;
            next.consecutiveOnTimePayments = 0;
            next.manualAdjustment -= 5;
            next.currentOutstanding = metrics.currentOutstanding;
            break;
        }
        case 'refunded': {
            next.disputeCount += 1;
            next.consecutiveOnTimePayments = 0;
            next.manualAdjustment -= 3;
            next.trailingVolume90d = Math.max(metrics.trailingVolume90d - normalizedAmount, 0);
            next.orders90d = Math.max(metrics.orders90d - 1, 0);
            next.currentOutstanding = metrics.currentOutstanding + normalizedAmount;
            break;
        }
        default: {
            next.consecutiveOnTimePayments = 0;
            break;
        }
    }
    next.trailingVolume90d = Math.max(next.trailingVolume90d, 0);
    next.orders90d = Math.max(Math.floor(next.orders90d), 0);
    next.successfulPayments = Math.max(next.successfulPayments, 0);
    next.failedPayments = Math.max(next.failedPayments, 0);
    next.totalAttempts = Math.max(next.totalAttempts, 0);
    next.disputeCount = Math.max(next.disputeCount, 0);
    next.currentOutstanding = Math.max(next.currentOutstanding, 0);
    next.consecutiveOnTimePayments = Math.max(next.consecutiveOnTimePayments, 0);
    next.manualAdjustment = clampNumber(next.manualAdjustment, -30, 30);
    return next;
}
const clampNumber = (value, min, max) => {
    if (!Number.isFinite(value))
        return min;
    return Math.min(Math.max(value, min), max);
};
const roundToNearest = (value, nearest) => {
    if (nearest <= 0)
        return value;
    return Math.round(value / nearest) * nearest;
};
const getTierForScore = (score) => {
    const normalizedScore = clampNumber(score, 0, 100);
    let matched = exports.CREDIT_TIERS[0];
    for (const tier of exports.CREDIT_TIERS) {
        if (normalizedScore >= tier.minScore) {
            matched = tier;
        }
    }
    return matched;
};
exports.getTierForScore = getTierForScore;
function assessCredit(input, options = exports.defaultCreditEngineOptions) {
    const { trailingVolume90d, trailingGrowthRate, onTimePaymentRate, disputeRate, repaymentLagDays, creditUtilization, currentOutstanding, existingCreditLimit, consecutiveOnTimePayments, daysSinceSignup, sectorRisk, manualAdjustment = 0 } = input;
    const normalizedVolume = trailingVolume90d / Math.max(options.volumeTarget, 1);
    const volumeScore = clampNumber(normalizedVolume * 32 + clampNumber(trailingGrowthRate * 100, -10, 10), 0, 40);
    const repaymentLagPenalty = Math.max(repaymentLagDays - options.targetRepaymentLag, 0) * 2.2;
    const paymentScore = clampNumber(onTimePaymentRate * 30 - repaymentLagPenalty, 0, 30);
    const utilizationPenalty = creditUtilization > options.utilizationComfortThreshold
        ? (creditUtilization - options.utilizationComfortThreshold) * 40
        : 0;
    const disputePenalty = disputeRate * 120;
    const latePenalty = Math.max(1 - onTimePaymentRate, 0) * 60;
    const behaviourScore = clampNumber(20 - (utilizationPenalty + disputePenalty + latePenalty) / 3.5, -5, 20);
    const recencyBoost = clampNumber(Math.min(consecutiveOnTimePayments, 12) * 0.8, 0, 8);
    const tenureBoost = clampNumber(daysSinceSignup / 30, 0, 6);
    const sectorPenalty = sectorRisk === 'high' ? -8 : sectorRisk === 'medium' ? -3 : 0;
    const rawScore = volumeScore + paymentScore + behaviourScore + recencyBoost + tenureBoost + manualAdjustment + sectorPenalty;
    const score = Number(clampNumber(rawScore, 0, 100).toFixed(2));
    const tier = (0, exports.getTierForScore)(score);
    const monthlyVolume = trailingVolume90d / 3;
    const projectedLimit = options.baseLimit
        + trailingVolume90d * options.volumeToCreditRatio
        + score * options.scoreMultiplier
        - currentOutstanding * options.outstandingWeight;
    const tierCap = Math.max(monthlyVolume * tier.maxLimitMultiplier, options.baseLimit);
    const boundedLimit = clampNumber(Math.min(projectedLimit, tierCap), options.baseLimit, options.maxLimit);
    const recommendedLimit = Math.max(options.baseLimit, roundToNearest(boundedLimit, 1000));
    const limitDelta = Math.round(recommendedLimit - existingCreditLimit);
    const availableHeadroom = Math.max(recommendedLimit - currentOutstanding, 0);
    const breakdown = {
        volume: Number(volumeScore.toFixed(2)),
        payments: Number(paymentScore.toFixed(2)),
        behaviour: Number(behaviourScore.toFixed(2)),
        recency: Number(recencyBoost.toFixed(2)),
        tenure: Number(tenureBoost.toFixed(2)),
        manual: Number(manualAdjustment.toFixed(2)),
        riskAdjustment: Number(sectorPenalty.toFixed(2)),
        penalties: {
            utilization: Number(utilizationPenalty.toFixed(2)),
            disputes: Number(disputePenalty.toFixed(2)),
            repaymentLag: Number(repaymentLagPenalty.toFixed(2)),
            latePayments: Number(latePenalty.toFixed(2))
        }
    };
    const alerts = [];
    if (creditUtilization > tier.utilizationCeiling) {
        alerts.push('Utilization above comfort range — consider partial repayment or review limit exposure.');
    }
    if (onTimePaymentRate < 0.85) {
        alerts.push('On-time payment rate below 85% — enable reminders or auto-debit to improve collections.');
    }
    if (disputeRate > 0.03) {
        alerts.push('Dispute rate trending high — escalate to account manager for review.');
    }
    if (limitDelta > 0 && score >= tier.minScore + 5) {
        alerts.push(`Eligible for limit increase of ${limitDelta.toLocaleString()} pending final approval.`);
    }
    if (limitDelta < 0) {
        alerts.push('Recommend limit reduction to rebalance risk and exposure.');
    }
    const nextReviewDate = new Date(Date.now() + tier.reviewCadenceDays * 24 * 60 * 60 * 1000);
    return {
        retailerId: input.retailerId,
        score,
        tier,
        recommendedLimit,
        limitDelta,
        availableHeadroom: Math.round(availableHeadroom),
        creditUtilization: Number(creditUtilization.toFixed(2)),
        nextReviewDateIso: nextReviewDate.toISOString(),
        breakdown,
        alerts,
        inputSnapshot: Object.assign({}, input)
    };
}
function forecastCreditTrajectory(result, options = {}) {
    const { horizonWeeks = 16, limitGrowthRate = 0.07, scoreMomentum = 1.2, maxLimit = exports.defaultCreditEngineOptions.maxLimit } = options;
    const cadenceWeeks = Math.max(4, Math.round(result.tier.reviewCadenceDays / 7));
    const points = [];
    let projectedLimit = result.recommendedLimit;
    let projectedScore = result.score;
    let activeTier = result.tier;
    const baseMonthlyVolume = result.inputSnapshot.trailingVolume90d / 3;
    for (let week = 1; week <= horizonWeeks; week += 1) {
        const isReviewWeek = week % cadenceWeeks === 0;
        if (isReviewWeek) {
            projectedScore = clampNumber(projectedScore + scoreMomentum, 0, 100);
            activeTier = (0, exports.getTierForScore)(projectedScore);
            const growthFactor = 1 + limitGrowthRate;
            const volumeGrowth = baseMonthlyVolume * (1 + 0.1 * week / horizonWeeks);
            const tierCap = Math.max(volumeGrowth * activeTier.maxLimitMultiplier, exports.defaultCreditEngineOptions.baseLimit);
            const newLimit = clampNumber(projectedLimit * growthFactor, exports.defaultCreditEngineOptions.baseLimit, maxLimit);
            projectedLimit = Math.max(exports.defaultCreditEngineOptions.baseLimit, roundToNearest(Math.min(newLimit, tierCap), 1000));
        }
        points.push({
            week,
            projectedLimit,
            projectedScore: Number(projectedScore.toFixed(2)),
            tierId: activeTier.id,
            review: isReviewWeek
        });
    }
    return points;
}
function calculatePortfolioSummary(results) {
    var _a;
    if (results.length === 0) {
        return {
            totalRecommendedLimit: 0,
            totalOutstanding: 0,
            weightedOnTimeRate: 0,
            utilizationPercentile90: 0,
            upgradeCandidates: [],
            watchlist: []
        };
    }
    const totalRecommendedLimit = results.reduce((sum, item) => sum + item.recommendedLimit, 0);
    const totalOutstanding = results.reduce((sum, item) => sum + item.inputSnapshot.currentOutstanding, 0);
    const weightedOnTimeRate = totalOutstanding > 0
        ? results.reduce((sum, item) => sum + item.inputSnapshot.onTimePaymentRate * item.inputSnapshot.currentOutstanding, 0) / totalOutstanding
        : results.reduce((sum, item) => sum + item.inputSnapshot.onTimePaymentRate, 0) / results.length;
    const utilizations = results
        .map(item => item.inputSnapshot.creditUtilization)
        .sort((a, b) => a - b);
    const percentileIndex = Math.min(utilizations.length - 1, Math.floor(0.9 * utilizations.length));
    const utilizationPercentile90 = (_a = utilizations[percentileIndex]) !== null && _a !== void 0 ? _a : 0;
    const upgradeCandidates = results
        .filter(item => item.limitDelta > 0 && item.score >= item.tier.minScore + 5)
        .map(item => item.retailerId);
    const watchlist = results
        .filter(item => (item.creditUtilization > item.tier.utilizationCeiling ||
        item.inputSnapshot.onTimePaymentRate < 0.85 ||
        item.inputSnapshot.disputeRate > 0.03))
        .map(item => item.retailerId);
    return {
        totalRecommendedLimit: Math.round(totalRecommendedLimit),
        totalOutstanding: Math.round(totalOutstanding),
        weightedOnTimeRate: Number(weightedOnTimeRate.toFixed(4)),
        utilizationPercentile90: Number(utilizationPercentile90.toFixed(2)),
        upgradeCandidates,
        watchlist
    };
}
//# sourceMappingURL=credit-engine.js.map