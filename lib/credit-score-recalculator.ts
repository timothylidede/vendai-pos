/**
 * Credit Score Recalculator
 * Fetches retailer metrics after payment and recalculates credit score
 * Integrates with existing credit-engine.ts for score calculation
 */

import { collection, query, where, getDocs, doc, getDoc, updateDoc, setDoc, Timestamp } from 'firebase/firestore'
import { db } from './firebase'
import { assessCredit, type CreditAssessmentInput } from './credit-engine'

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface RetailerMetrics {
  retailerId: string
  organizationId: string
  businessTenureDays: number
  totalSalesVolume: number
  averageDailySales: number
  transactionConsistency: number
  totalOrders: number
  totalPOSTransactions: number
  totalDisbursements: number
  totalRepayments: number
  onTimeRepayments: number
  lateRepayments: number
  defaultedRepayments: number
  averageRepaymentLagDays: number
  currentPaymentStreak: number
  longestPaymentStreak: number
  creditUtilization: number
  outstandingBalance: number
  approvedAmount: number
  daysOverdue: number
  lastRepaymentDate?: Date
  lastDisbursementDate?: Date
}

export interface CreditScoreResult {
  success: boolean
  previousScore?: number
  newScore?: number
  scoreChange?: number
  previousTier?: string
  newTier?: string
  limitChange?: number
  error?: string
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get credit tier based on score
 */
function getCreditTier(score: number): { tier: string; maxCredit: number } {
  if (score >= 85) {
    return { tier: 'Elite', maxCredit: 500000 }
  } else if (score >= 70) {
    return { tier: 'Scale', maxCredit: 350000 }
  } else if (score >= 55) {
    return { tier: 'Growth', maxCredit: 250000 }
  } else {
    return { tier: 'Starter', maxCredit: 100000 }
  }
}

/**
 * Calculate business tenure in days
 */
function calculateBusinessTenure(createdAt: Timestamp | Date): number {
  const created = createdAt instanceof Timestamp ? createdAt.toDate() : createdAt
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - created.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

/**
 * Calculate transaction consistency (orders per day)
 */
function calculateConsistency(totalOrders: number, tenureDays: number): number {
  if (tenureDays === 0) return 0
  return totalOrders / tenureDays
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Fetch comprehensive retailer metrics from Firestore
 */
export async function fetchRetailerMetrics(
  retailerId: string,
  organizationId: string
): Promise<RetailerMetrics | null> {
  if (!db) {
    console.error('Firestore not initialized')
    return null
  }

  try {
    // Fetch retailer/organization data
    const orgDoc = await getDoc(doc(db, 'organizations', organizationId))
    if (!orgDoc.exists()) {
      console.error('Organization not found')
      return null
    }

    const orgData = orgDoc.data()
    const createdAt = orgData.createdAt || Timestamp.now()
    const tenureDays = calculateBusinessTenure(createdAt)

    // Fetch credit facility
    const facilitiesRef = collection(db, 'organizations', organizationId, 'credit_facilities')
    const facilityQuery = query(facilitiesRef, where('retailerId', '==', retailerId), where('status', '==', 'active'))
    const facilitySnapshot = await getDocs(facilityQuery)

    let facilityData: any = {}
    if (!facilitySnapshot.empty) {
      facilityData = facilitySnapshot.docs[0].data()
    }

    // Fetch POS transactions (for sales volume)
    const ordersRef = collection(db, 'organizations', organizationId, 'orders')
    const ordersSnapshot = await getDocs(ordersRef)
    
    const totalSalesVolume = ordersSnapshot.docs.reduce((sum, doc) => {
      const order = doc.data()
      return sum + (order.totalAmount || 0)
    }, 0)

    const totalPOSTransactions = ordersSnapshot.size
    const averageDailySales = tenureDays > 0 ? totalSalesVolume / tenureDays : 0
    const transactionConsistency = calculateConsistency(totalPOSTransactions, tenureDays)

    // Fetch disbursements
    const disbursementsRef = collection(db, 'organizations', organizationId, 'disbursements')
    const disbursementQuery = query(disbursementsRef, where('retailerId', '==', retailerId))
    const disbursementSnapshot = await getDocs(disbursementQuery)
    
    const totalDisbursements = disbursementSnapshot.size
    const lastDisbursement = disbursementSnapshot.docs
      .sort((a, b) => {
        const aDate = a.data().createdAt
        const bDate = b.data().createdAt
        return bDate?.toMillis() - aDate?.toMillis()
      })[0]

    // Fetch repayment schedules
    const schedulesRef = collection(db, 'organizations', organizationId, 'repayment_schedules')
    const schedulesSnapshot = await getDocs(schedulesRef)

    let totalRepayments = 0
    let onTimeRepayments = 0
    let lateRepayments = 0
    let defaultedRepayments = 0
    let totalLagDays = 0
    let lastRepaymentDate: Date | undefined

    schedulesSnapshot.docs.forEach((doc) => {
      const schedule = doc.data()
      if (schedule.status === 'paid') {
        totalRepayments++
        const dueDate = schedule.dueDate instanceof Timestamp ? schedule.dueDate.toDate() : new Date(schedule.dueDate)
        const paidDate = schedule.paidAt instanceof Timestamp ? schedule.paidAt.toDate() : new Date(schedule.paidAt)
        
        const lagDays = Math.ceil((paidDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
        totalLagDays += lagDays

        if (lagDays <= 0) {
          onTimeRepayments++
        } else if (lagDays <= 7) {
          lateRepayments++
        } else {
          defaultedRepayments++
        }

        if (!lastRepaymentDate || paidDate > lastRepaymentDate) {
          lastRepaymentDate = paidDate
        }
      }
    })

    const averageRepaymentLagDays = totalRepayments > 0 ? totalLagDays / totalRepayments : 0

    // Calculate days overdue (oldest overdue payment)
    const now = new Date()
    let daysOverdue = 0
    schedulesSnapshot.docs.forEach((doc) => {
      const schedule = doc.data()
      if (schedule.status === 'pending' || schedule.status === 'overdue') {
        const dueDate = schedule.dueDate instanceof Timestamp ? schedule.dueDate.toDate() : new Date(schedule.dueDate)
        if (dueDate < now) {
          const overdue = Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
          if (overdue > daysOverdue) {
            daysOverdue = overdue
          }
        }
      }
    })

    const metrics: RetailerMetrics = {
      retailerId,
      organizationId,
      businessTenureDays: tenureDays,
      totalSalesVolume,
      averageDailySales,
      transactionConsistency,
      totalOrders: totalPOSTransactions,
      totalPOSTransactions,
      totalDisbursements,
      totalRepayments,
      onTimeRepayments,
      lateRepayments,
      defaultedRepayments,
      averageRepaymentLagDays,
      currentPaymentStreak: facilityData.metrics?.currentStreak || 0,
      longestPaymentStreak: facilityData.metrics?.longestStreak || 0,
      creditUtilization: facilityData.creditUtilization || 0,
      outstandingBalance: facilityData.outstandingBalance || 0,
      approvedAmount: facilityData.approvedAmount || 0,
      daysOverdue,
      lastRepaymentDate,
      lastDisbursementDate: lastDisbursement?.data().createdAt?.toDate(),
    }

    return metrics
  } catch (error) {
    console.error('Error fetching retailer metrics:', error)
    return null
  }
}

/**
 * Recalculate credit score for a retailer
 */
export async function recalculateCreditScore(
  retailerId: string,
  organizationId: string
): Promise<CreditScoreResult> {
  if (!db) {
    return {
      success: false,
      error: 'Firestore not initialized',
    }
  }

  try {
    // Fetch current score
    const scoresRef = collection(db, 'organizations', organizationId, 'credit_scores')
    const scoreQuery = query(scoresRef, where('retailerId', '==', retailerId))
    const scoreSnapshot = await getDocs(scoreQuery)

    let previousScore = 0
    let scoreDocRef: any = null

    if (!scoreSnapshot.empty) {
      const scoreDoc = scoreSnapshot.docs[0]
      scoreDocRef = scoreDoc.ref
      previousScore = scoreDoc.data().totalScore || 0
    }

    // Fetch retailer metrics
    const metrics = await fetchRetailerMetrics(retailerId, organizationId)
    if (!metrics) {
      return {
        success: false,
        error: 'Failed to fetch retailer metrics',
      }
    }

    // Calculate new credit score using existing credit-engine
    const assessmentInput: CreditAssessmentInput = {
      retailerId,
      trailingVolume90d: metrics.totalSalesVolume,
      trailingGrowthRate: 0, // Would need historical comparison
      orders90d: metrics.totalOrders,
      averageOrderValue: metrics.totalOrders > 0 ? metrics.totalSalesVolume / metrics.totalOrders : 0,
      onTimePaymentRate: metrics.totalRepayments > 0 ? metrics.onTimeRepayments / metrics.totalRepayments : 1.0,
      disputeRate: 0, // Not currently tracked
      repaymentLagDays: metrics.averageRepaymentLagDays,
      creditUtilization: metrics.creditUtilization,
      currentOutstanding: metrics.outstandingBalance,
      existingCreditLimit: metrics.approvedAmount,
      consecutiveOnTimePayments: metrics.currentPaymentStreak,
      daysSinceSignup: metrics.businessTenureDays,
      sectorRisk: 'medium', // Default to medium risk
    }

    const scoreResult = assessCredit(assessmentInput)
    const newScore = scoreResult.score

    // Determine tier changes
    const previousTierInfo = getCreditTier(previousScore)
    const newTierInfo = getCreditTier(newScore)
    const limitChange = newTierInfo.maxCredit - previousTierInfo.maxCredit

    // Update or create credit score document
    const scoreData = {
      retailerId,
      organizationId,
      totalScore: newScore,
      tierLabel: scoreResult.tier.label,
      tierMinScore: scoreResult.tier.minScore,
      recommendedLimit: scoreResult.recommendedLimit,
      breakdown: scoreResult.breakdown,
      alerts: scoreResult.alerts,
      previousScore,
      scoreChange: newScore - previousScore,
      maxCreditLimit: newTierInfo.maxCredit,
      calculatedAt: Timestamp.now(),
      metrics: {
        businessTenureDays: metrics.businessTenureDays,
        totalSalesVolume: metrics.totalSalesVolume,
        averageDailySales: metrics.averageDailySales,
        totalRepayments: metrics.totalRepayments,
        onTimeRepayments: metrics.onTimeRepayments,
        lateRepayments: metrics.lateRepayments,
        creditUtilization: metrics.creditUtilization,
        daysOverdue: metrics.daysOverdue,
      },
      updatedAt: Timestamp.now(),
    }

    if (scoreDocRef) {
      await updateDoc(scoreDocRef, scoreData)
    } else {
      const newScoreDocRef = doc(scoresRef)
      await setDoc(newScoreDocRef, {
        ...scoreData,
        createdAt: Timestamp.now(),
      })
    }

    // If tier improved, update facility limit
    if (limitChange > 0) {
      const facilitiesRef = collection(db, 'organizations', organizationId, 'credit_facilities')
      const facilityQuery = query(facilitiesRef, where('retailerId', '==', retailerId), where('status', '==', 'active'))
      const facilitySnapshot = await getDocs(facilityQuery)

      if (!facilitySnapshot.empty) {
        const facilityDoc = facilitySnapshot.docs[0]
        const currentLimit = facilityDoc.data().approvedAmount || 0

        // Only increase limit if new tier allows higher
        if (newTierInfo.maxCredit > currentLimit) {
          await updateDoc(facilityDoc.ref, {
            approvedAmount: newTierInfo.maxCredit,
            availableCredit: newTierInfo.maxCredit - (facilityDoc.data().outstandingBalance || 0),
            'limitHistory': [
              ...(facilityDoc.data().limitHistory || []),
              {
                previousLimit: currentLimit,
                newLimit: newTierInfo.maxCredit,
                reason: `Score improved from ${previousScore} to ${newScore}. Tier upgraded to ${newTierInfo.tier}`,
                changedAt: Timestamp.now(),
                changedBy: 'system',
              },
            ],
            updatedAt: Timestamp.now(),
          })
        }
      }
    }

    return {
      success: true,
      previousScore,
      newScore,
      scoreChange: newScore - previousScore,
      previousTier: previousTierInfo.tier,
      newTier: newTierInfo.tier,
      limitChange,
    }
  } catch (error: any) {
    console.error('Error recalculating credit score:', error)
    return {
      success: false,
      error: error.message || 'Failed to recalculate credit score',
    }
  }
}

/**
 * Recalculate credit score after repayment (triggered by webhook/API)
 */
export async function recalculateAfterRepayment(
  retailerId: string,
  organizationId: string
): Promise<CreditScoreResult> {
  console.log('Recalculating credit score after repayment:', { retailerId, organizationId })
  return await recalculateCreditScore(retailerId, organizationId)
}

/**
 * Batch recalculate credit scores for all active facilities
 * (Can be run as a cron job/scheduled task)
 */
export async function batchRecalculateScores(organizationId: string): Promise<{
  success: boolean
  processed: number
  errors: number
  results: CreditScoreResult[]
}> {
  if (!db) {
    return {
      success: false,
      processed: 0,
      errors: 1,
      results: [],
    }
  }

  try {
    // Fetch all active facilities
    const facilitiesRef = collection(db, 'organizations', organizationId, 'credit_facilities')
    const facilityQuery = query(facilitiesRef, where('status', '==', 'active'))
    const facilitySnapshot = await getDocs(facilityQuery)

    const results: CreditScoreResult[] = []
    let processed = 0
    let errors = 0

    // Process each retailer
    for (const facilityDoc of facilitySnapshot.docs) {
      const facility = facilityDoc.data()
      const retailerId = facility.retailerId

      try {
        const result = await recalculateCreditScore(retailerId, organizationId)
        results.push(result)
        
        if (result.success) {
          processed++
        } else {
          errors++
        }
      } catch (error) {
        console.error(`Error recalculating score for retailer ${retailerId}:`, error)
        errors++
      }
    }

    return {
      success: true,
      processed,
      errors,
      results,
    }
  } catch (error: any) {
    console.error('Error in batch recalculation:', error)
    return {
      success: false,
      processed: 0,
      errors: 1,
      results: [],
    }
  }
}
