export type CreditTierId = 'starter' | 'growth' | 'scale' | 'elite'

export interface CreditTierDefinition {
  id: CreditTierId
  label: string
  minScore: number
  reviewCadenceDays: number
  maxLimitMultiplier: number
  utilizationCeiling: number
  description: string
}

export const CREDIT_TIERS: CreditTierDefinition[] = [
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
]

export interface CreditAssessmentInput {
  retailerId: string
  trailingVolume90d: number
  trailingGrowthRate: number
  orders90d: number
  averageOrderValue: number
  onTimePaymentRate: number
  disputeRate: number
  repaymentLagDays: number
  creditUtilization: number
  currentOutstanding: number
  existingCreditLimit: number
  consecutiveOnTimePayments: number
  daysSinceSignup: number
  sectorRisk: 'low' | 'medium' | 'high'
  manualAdjustment?: number
}

export interface ScorePenalties {
  utilization: number
  disputes: number
  repaymentLag: number
  latePayments: number
}

export interface ScoreBreakdown {
  // New 6-component scoring (aligns with Pezesha integration)
  sales: number          // 30 points max - sales volume performance
  payments: number       // 30 points max - payment reliability
  consistency: number    // 15 points max - order frequency
  tenure: number         // 10 points max - business age
  growth: number         // 10 points max - volume growth trend
  utilization: number    // 5 points max - credit usage efficiency
  
  // Legacy fields for backward compatibility
  volume?: number
  behaviour?: number
  recency?: number
  manual: number
  riskAdjustment: number
  penalties: ScorePenalties
}

export interface CreditAssessmentResult {
  retailerId: string
  score: number
  tier: CreditTierDefinition
  recommendedLimit: number
  limitDelta: number
  availableHeadroom: number
  creditUtilization: number
  nextReviewDateIso: string
  breakdown: ScoreBreakdown
  alerts: string[]
  inputSnapshot: CreditAssessmentInput
}

export interface CreditEngineOptions {
  baseLimit: number
  maxLimit: number
  volumeTarget: number
  targetRepaymentLag: number
  volumeToCreditRatio: number
  scoreMultiplier: number
  outstandingWeight: number
  utilizationComfortThreshold: number
}

export const defaultCreditEngineOptions: CreditEngineOptions = {
  baseLimit: 50000,
  maxLimit: 750000,
  volumeTarget: 200000,
  targetRepaymentLag: 2,
  volumeToCreditRatio: 0.32,
  scoreMultiplier: 600,
  outstandingWeight: 0.2,
  utilizationComfortThreshold: 0.65
}

export type CreditPaymentOutcome = 'paid' | 'partial' | 'failed' | 'refunded'

export interface CreditMetricsSnapshot {
  trailingVolume90d: number
  orders90d: number
  successfulPayments: number
  failedPayments: number
  totalAttempts: number
  disputeCount: number
  currentOutstanding: number
  existingCreditLimit: number
  consecutiveOnTimePayments: number
  manualAdjustment: number
  repaymentLagDays: number
  sectorRisk: 'low' | 'medium' | 'high'
}

export function applyPaymentOutcomeToMetrics(
  metrics: CreditMetricsSnapshot,
  amount: number,
  outcome: CreditPaymentOutcome,
): CreditMetricsSnapshot {
  const normalizedAmount = Number.isFinite(amount) && amount > 0 ? amount : 0
  const next: CreditMetricsSnapshot = {
    ...metrics,
    totalAttempts: metrics.totalAttempts + 1,
  }

  switch (outcome) {
    case 'paid': {
      next.trailingVolume90d += normalizedAmount
      next.orders90d += 1
      next.successfulPayments += 1
      next.consecutiveOnTimePayments = metrics.consecutiveOnTimePayments + 1
      next.manualAdjustment += 1
      next.currentOutstanding = Math.max(metrics.currentOutstanding - normalizedAmount, 0)
      break
    }
    case 'partial': {
      next.trailingVolume90d += normalizedAmount
      next.consecutiveOnTimePayments = metrics.consecutiveOnTimePayments + 1
      next.manualAdjustment += 0.5
      next.currentOutstanding = Math.max(metrics.currentOutstanding - normalizedAmount, 0)
      break
    }
    case 'failed': {
      next.failedPayments += 1
      next.consecutiveOnTimePayments = 0
      next.manualAdjustment -= 5
      next.currentOutstanding = metrics.currentOutstanding
      break
    }
    case 'refunded': {
      next.disputeCount += 1
      next.consecutiveOnTimePayments = 0
      next.manualAdjustment -= 3
      next.trailingVolume90d = Math.max(metrics.trailingVolume90d - normalizedAmount, 0)
      next.orders90d = Math.max(metrics.orders90d - 1, 0)
      next.currentOutstanding = metrics.currentOutstanding + normalizedAmount
      break
    }
    default: {
      next.consecutiveOnTimePayments = 0
      break
    }
  }

  next.trailingVolume90d = Math.max(next.trailingVolume90d, 0)
  next.orders90d = Math.max(Math.floor(next.orders90d), 0)
  next.successfulPayments = Math.max(next.successfulPayments, 0)
  next.failedPayments = Math.max(next.failedPayments, 0)
  next.totalAttempts = Math.max(next.totalAttempts, 0)
  next.disputeCount = Math.max(next.disputeCount, 0)
  next.currentOutstanding = Math.max(next.currentOutstanding, 0)
  next.consecutiveOnTimePayments = Math.max(next.consecutiveOnTimePayments, 0)
  next.manualAdjustment = clampNumber(next.manualAdjustment, -30, 30)

  return next
}

const clampNumber = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) return min
  return Math.min(Math.max(value, min), max)
}

const roundToNearest = (value: number, nearest: number): number => {
  if (nearest <= 0) return value
  return Math.round(value / nearest) * nearest
}

export const getTierForScore = (score: number): CreditTierDefinition => {
  const normalizedScore = clampNumber(score, 0, 100)
  let matched = CREDIT_TIERS[0]
  for (const tier of CREDIT_TIERS) {
    if (normalizedScore >= tier.minScore) {
      matched = tier
    }
  }
  return matched
}

export function assessCredit(
  input: CreditAssessmentInput,
  options: CreditEngineOptions = defaultCreditEngineOptions
): CreditAssessmentResult {
  const {
    trailingVolume90d,
    trailingGrowthRate,
    onTimePaymentRate,
    disputeRate,
    repaymentLagDays,
    creditUtilization,
    currentOutstanding,
    existingCreditLimit,
    consecutiveOnTimePayments,
    daysSinceSignup,
    sectorRisk,
    manualAdjustment = 0
  } = input

  // ============================================================================
  // NEW 6-COMPONENT SCORING SYSTEM (Aligned with Pezesha Integration)
  // ============================================================================
  
  // 1. SALES SCORE (30 points max) - Based on sales volume performance
  const normalizedVolume = trailingVolume90d / Math.max(options.volumeTarget, 1)
  const salesScore = clampNumber(normalizedVolume * 30, 0, 30)
  
  // 2. PAYMENTS SCORE (30 points max) - Payment reliability and timeliness
  const repaymentLagPenalty = Math.max(repaymentLagDays - options.targetRepaymentLag, 0) * 0.5
  const latePaymentPenalty = Math.max(1 - onTimePaymentRate, 0) * 20
  const paymentsScore = clampNumber(onTimePaymentRate * 30 - repaymentLagPenalty - latePaymentPenalty, 0, 30)
  
  // 3. CONSISTENCY SCORE (15 points max) - Order frequency and pattern stability
  const ordersPerMonth = (input.orders90d / 3)
  const orderConsistency = Math.min(ordersPerMonth / 20, 1) // Target: 20 orders/month for max score
  const consistencyScore = clampNumber(orderConsistency * 15, 0, 15)
  
  // 4. TENURE SCORE (10 points max) - Business age on platform
  const tenureMonths = daysSinceSignup / 30
  const tenureScore = clampNumber((tenureMonths / 12) * 10, 0, 10) // Max at 12 months
  
  // 5. GROWTH SCORE (10 points max) - Volume growth trend
  const growthScore = clampNumber((trailingGrowthRate * 10) + 5, 0, 10) // Center at 5, +50% growth = 10 points
  
  // 6. UTILIZATION SCORE (5 points max) - Credit usage efficiency
  const optimalUtilization = 0.65 // Sweet spot: 65% utilization
  const utilizationDistance = Math.abs(creditUtilization - optimalUtilization)
  const utilizationScore = clampNumber(5 - (utilizationDistance * 10), 0, 5)
  
  // Penalties (deducted from total)
  const utilizationPenalty = creditUtilization > 0.85 ? (creditUtilization - 0.85) * 33 : 0
  const disputePenalty = disputeRate * 100
  const sectorPenalty = sectorRisk === 'high' ? 8 : sectorRisk === 'medium' ? 3 : 0
  const totalPenalties = utilizationPenalty + disputePenalty + sectorPenalty
  
  const rawScore = salesScore + paymentsScore + consistencyScore + tenureScore + growthScore + utilizationScore - totalPenalties + manualAdjustment
  const score = Number(clampNumber(rawScore, 0, 100).toFixed(2))
  const tier = getTierForScore(score)

  const monthlyVolume = trailingVolume90d / 3
  const projectedLimit = options.baseLimit
    + trailingVolume90d * options.volumeToCreditRatio
    + score * options.scoreMultiplier
    - currentOutstanding * options.outstandingWeight

  const tierCap = Math.max(monthlyVolume * tier.maxLimitMultiplier, options.baseLimit)
  const boundedLimit = clampNumber(Math.min(projectedLimit, tierCap), options.baseLimit, options.maxLimit)
  const recommendedLimit = Math.max(options.baseLimit, roundToNearest(boundedLimit, 1000))
  const limitDelta = Math.round(recommendedLimit - existingCreditLimit)
  const availableHeadroom = Math.max(recommendedLimit - currentOutstanding, 0)

  const breakdown: ScoreBreakdown = {
    // New 6-component system
    sales: Number(salesScore.toFixed(2)),
    payments: Number(paymentsScore.toFixed(2)),
    consistency: Number(consistencyScore.toFixed(2)),
    tenure: Number(tenureScore.toFixed(2)),
    growth: Number(growthScore.toFixed(2)),
    utilization: Number(utilizationScore.toFixed(2)),
    
    // Legacy fields (for backward compatibility)
    manual: Number(manualAdjustment.toFixed(2)),
    riskAdjustment: Number((-sectorPenalty).toFixed(2)),
    penalties: {
      utilization: Number(utilizationPenalty.toFixed(2)),
      disputes: Number(disputePenalty.toFixed(2)),
      repaymentLag: Number(repaymentLagPenalty.toFixed(2)),
      latePayments: Number(latePaymentPenalty.toFixed(2))
    }
  }

  const alerts: string[] = []
  if (creditUtilization > tier.utilizationCeiling) {
    alerts.push('Utilization above comfort range — consider partial repayment or review limit exposure.')
  }
  if (onTimePaymentRate < 0.85) {
    alerts.push('On-time payment rate below 85% — enable reminders or auto-debit to improve collections.')
  }
  if (disputeRate > 0.03) {
    alerts.push('Dispute rate trending high — escalate to account manager for review.')
  }
  if (limitDelta > 0 && score >= tier.minScore + 5) {
    alerts.push(`Eligible for limit increase of ${limitDelta.toLocaleString()} pending final approval.`)
  }
  if (limitDelta < 0) {
    alerts.push('Recommend limit reduction to rebalance risk and exposure.')
  }

  const nextReviewDate = new Date(Date.now() + tier.reviewCadenceDays * 24 * 60 * 60 * 1000)

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
    inputSnapshot: { ...input }
  }
}

export interface CreditForecastPoint {
  week: number
  projectedLimit: number
  projectedScore: number
  tierId: CreditTierId
  review: boolean
}

export interface CreditForecastOptions {
  horizonWeeks?: number
  limitGrowthRate?: number
  scoreMomentum?: number
  maxLimit?: number
}

export function forecastCreditTrajectory(
  result: CreditAssessmentResult,
  options: CreditForecastOptions = {}
): CreditForecastPoint[] {
  const {
    horizonWeeks = 16,
    limitGrowthRate = 0.07,
    scoreMomentum = 1.2,
    maxLimit = defaultCreditEngineOptions.maxLimit
  } = options

  const cadenceWeeks = Math.max(4, Math.round(result.tier.reviewCadenceDays / 7))
  const points: CreditForecastPoint[] = []
  let projectedLimit = result.recommendedLimit
  let projectedScore = result.score
  let activeTier = result.tier
  const baseMonthlyVolume = result.inputSnapshot.trailingVolume90d / 3

  for (let week = 1; week <= horizonWeeks; week += 1) {
    const isReviewWeek = week % cadenceWeeks === 0

    if (isReviewWeek) {
      projectedScore = clampNumber(projectedScore + scoreMomentum, 0, 100)
      activeTier = getTierForScore(projectedScore)

      const growthFactor = 1 + limitGrowthRate
      const volumeGrowth = baseMonthlyVolume * (1 + 0.1 * week / horizonWeeks)
      const tierCap = Math.max(volumeGrowth * activeTier.maxLimitMultiplier, defaultCreditEngineOptions.baseLimit)

      const newLimit = clampNumber(projectedLimit * growthFactor, defaultCreditEngineOptions.baseLimit, maxLimit)
      projectedLimit = Math.max(defaultCreditEngineOptions.baseLimit, roundToNearest(Math.min(newLimit, tierCap), 1000))
    }

    points.push({
      week,
      projectedLimit,
      projectedScore: Number(projectedScore.toFixed(2)),
      tierId: activeTier.id,
      review: isReviewWeek
    })
  }

  return points
}

export interface PortfolioSummary {
  totalRecommendedLimit: number
  totalOutstanding: number
  weightedOnTimeRate: number
  utilizationPercentile90: number
  upgradeCandidates: string[]
  watchlist: string[]
}

export function calculatePortfolioSummary(results: CreditAssessmentResult[]): PortfolioSummary {
  if (results.length === 0) {
    return {
      totalRecommendedLimit: 0,
      totalOutstanding: 0,
      weightedOnTimeRate: 0,
      utilizationPercentile90: 0,
      upgradeCandidates: [],
      watchlist: []
    }
  }

  const totalRecommendedLimit = results.reduce((sum, item) => sum + item.recommendedLimit, 0)
  const totalOutstanding = results.reduce((sum, item) => sum + item.inputSnapshot.currentOutstanding, 0)

  const weightedOnTimeRate = totalOutstanding > 0
    ? results.reduce((sum, item) => sum + item.inputSnapshot.onTimePaymentRate * item.inputSnapshot.currentOutstanding, 0) / totalOutstanding
    : results.reduce((sum, item) => sum + item.inputSnapshot.onTimePaymentRate, 0) / results.length

  const utilizations = results
    .map(item => item.inputSnapshot.creditUtilization)
    .sort((a, b) => a - b)

  const percentileIndex = Math.min(utilizations.length - 1, Math.floor(0.9 * utilizations.length))
  const utilizationPercentile90 = utilizations[percentileIndex] ?? 0

  const upgradeCandidates = results
    .filter(item => item.limitDelta > 0 && item.score >= item.tier.minScore + 5)
    .map(item => item.retailerId)

  const watchlist = results
    .filter(item => (
      item.creditUtilization > item.tier.utilizationCeiling ||
      item.inputSnapshot.onTimePaymentRate < 0.85 ||
      item.inputSnapshot.disputeRate > 0.03
    ))
    .map(item => item.retailerId)

  return {
    totalRecommendedLimit: Math.round(totalRecommendedLimit),
    totalOutstanding: Math.round(totalOutstanding),
    weightedOnTimeRate: Number(weightedOnTimeRate.toFixed(4)),
    utilizationPercentile90: Number(utilizationPercentile90.toFixed(2)),
    upgradeCandidates,
    watchlist
  }
}
